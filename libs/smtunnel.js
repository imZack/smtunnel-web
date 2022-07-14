import * as mqtt from 'async-mqtt';
import * as Promise from 'bluebird';

class SMtunnel {
  regexList = [
    /^stunnelv1\.0\/(?<group>.+?)\/(?<device>.+?)\/(?<uuid>.+)\/(?<session>.+)\/(?<action>.+)$/,
    /^stunnelv1\.0\/(?<group>.+?)\/(?<device>.+?)\/state$/,
  ];

  constructor(mqttConnStr) {
    this.sessionMap = {};
    this.groupDeviceMap = {};
    this.mqttConnStr = mqttConnStr || 'ws://10.123.12.140:8083/mqtt';
    this.connceted = false;
  }

  async createSession(group, device, term, mqttConnStr) {
    console.log(`createSession [${group}/${device}] mqtt://${mqttConnStr}`);
    const uuid = window.crypto.randomUUID();
    this.sessionMap[uuid] = {
      uuid,
      group,
      device,
      term,
      mqttClient: mqtt.connect(mqttConnStr, {
        keepalive: 60,
        will: {
          topic: `stunnelv1.0/${group}/${device}/${uuid}/logout`,
          payload: null,
          qos: 1,
        },
      }),
      write: [],
      read: [],
    };

    const session = this.sessionMap[uuid];
    session.mqttClient.on('message', async (topic, message) => {
      if (!session.term) {
        console.log('session.term not existed. buffering...');
        session.write.push(message.toString());
        return;
      }

      await session.term.write(session.write.join(''));
      session.write.length = 0;
      await session.term.write(message.toString());
    });

    await session.mqttClient.subscribe(`stunnelv1.0/${group}/${device}/${uuid}/1/out`);
    await session.mqttClient.publish(
      `stunnelv1.0/${session.group}/${session.device}/${uuid}/login`,
      JSON.stringify({
        id: uuid,
        online: true,
        maxPacketSize: 0,
        sshDirect: true,
      }),
    );

    return session;
  }

  async destroySession(uuid) {
    console.log('destroySession', uuid);
    const session = this.sessionMap[uuid];
    await session.mqttClient.end();
    session.term.reset();
    delete this.sessionMap[uuid];
  }

  async scan() {
    console.log('scan started.');
    const scanClient = mqtt.connect(this.mqttConnStr);
    scanClient.on('connect', async () => {
      console.log('Broker connected.');
      await scanClient.subscribe('stunnelv1.0/+/+/state', (err) => {
        if (err) {
          console.error(err);
          return;
        }

        console.log('topic [stunnelv1.0/+/+/state] subscribed.');
      });
    });

    scanClient.on('message', async (topic, message) => {
      let topicParsed;
      for (let i = 0; i < this.regexList.length && !topicParsed; i += 1) {
        topicParsed = this.regexList[i].exec(topic);
      }

      if (!topicParsed) {
        console.log(`Can't parse ${topic}, skip`);
        return;
      }

      const {
        group,
        device,
      } = topicParsed.groups;

      console.log(`Found: ${group}/${device}`);
      console.log(message.toString());

      // Update groupDeviceMap
      const deviceDetail = JSON.parse(message);
      this.groupDeviceMap[group] = this.groupDeviceMap[group] || {};
      this.groupDeviceMap[group][device] = deviceDetail;
      deviceDetail.group = group;
      deviceDetail.device = device;
    });

    await new Promise((r) => setTimeout(r, 3000));
    scanClient.end();

    console.log('scan ended.');
    return this.groupDeviceMap;
  }

  async ssh(group, device, term) {
    const session = await this.createSession(group, device, term, this.mqttConnStr);
    session.term = term;

    term.onKey(async (ev) => {
      if (!this.sessionMap[session.uuid]) return;

      const { key } = ev;
      await session.mqttClient.publish(
        `stunnelv1.0/${session.group}/${session.device}/${session.uuid}/1/in`,
        `${key}`,
      );

      // if (ev.key.charCodeAt(0) === 13) {
      //   await session.mqttClient.publish(
      //     `stunnelv1.0/${session.group}/${session.device}/${session.uuid}/1/in`,
      //     `${session.read.join('')}\n`,
      //   );
      //   session.read.length = 0;
      //   return;
      // }

      // session.read.push(key);
    });
  }

  async stop() {
    await Promise.map(
      Object.keys(this.sessionMap),
      async (uuid) => this.destroySession(uuid),
    );
  }

  getGroupDeviceMap() {
    return { ...this.groupDeviceMap };
  }

  getGroupDeviceList() {
    const result = [];
    Object.keys(this.groupDeviceMap).forEach((group) => {
      const devices = Object.keys(this.groupDeviceMap[group]);
      devices.forEach((device) => {
        result.push(this.groupDeviceMap[group][device]);
      });
    });

    return result;
  }
}

export default SMtunnel;
