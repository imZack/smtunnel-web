import Head from 'next/head';
import React from 'react';
import { Resizable } from 're-resizable';
import ResizeObserver from 'react-resize-observer';
import SMtunnel from '../libs/smtunnel';

export default class Index extends React.Component {
  constructor(props) {
    super(props);
    // const smtunnel = new SMtunnel('ws://api.bakebytes.io:1884');
    const smtunnel = new SMtunnel();
    this.state = {
      term: null,
      smtunnel,
      isScanning: false,
      deviceList: [],
    };
  }

  async componentDidMount() {
    const initTerminal = async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      const term = new Terminal({
        cursorBlink: 'block',
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      this.setState({
        term,
        fitAddon,
      });
    };

    await initTerminal();
    const { term, fitAddon } = this.state;
    term.open(document.getElementById('xterm-container'));
    fitAddon.fit();
  }

  handleMqttConnStrChange(e) {
    // eslint-disable-next-line react/no-unused-class-component-methods
    this.mqttConnStr = e.target.value;
  }

  async scan() {
    const { smtunnel } = this.state;
    this.setState({ isScanning: true });
    await smtunnel.scan();
    this.setState({
      deviceList: smtunnel.getGroupDeviceList(),
      isScanning: false,
    });
  }

  render() {
    const {
      fitAddon, smtunnel, term, deviceList, isScanning,
    } = this.state;

    return (
      <div className="container flex flex-col space-y-4">
        <Head>
          <title>smtunnel web console</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <h1 className="text-5xl font-sans text-center">SSH via smtunnel</h1>
        <Resizable
          className="border-red-600"
          width={350}
          height={450}
          style={{
            padding: '0.4em',
            margin: '1em',
          }}
        >
          <div id="xterm-container" style={{ overflow: 'hidden', height: '100%', width: '100%' }} />
          <ResizeObserver
            onResize={() => {
              if (fitAddon) {
                // console.log('fit!');
                fitAddon.fit();
              }
              // console.log('Resized. New bounds:', rect.width, 'x', rect.height);
            }}
            onPosition={() => {
              // console.log('Moved. New position:', rect.left, 'x', rect.top);
            }}
          />
        </Resizable>
        <div className="divider">Settings</div>
        <div className="grid grid-cols-2">
          <div>
            <input
              type="text"
              placeholder="ws://10.123.12.140:8083/mqtt"
              className="input input-bordered w-96 self-center"
              onChange={this.handleMqttConnStrChange.bind(smtunnel)}
            />
          </div>
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary"
              // disabled={smtunnel?.connected}
              onClick={() => this.scan()}
            >
              Start / Scan
            </button>
            <button type="button" className="btn btn-secondary" onClick={smtunnel.stop.bind(smtunnel)}>Disconnect</button>

          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-compact w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Group</th>
                <th>Device</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {
                deviceList.map((row) => (
                  <tr key={`${row.group}-${row.device}`}>
                    <th>#</th>
                    <td>{ row.group }</td>
                    <td>{ row.device }</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary"
                      // disabled={!smtunnel?.connected}
                        onClick={async () => (
                          smtunnel.ssh.apply(smtunnel, [row.group, row.device, term]))}
                      >
                        SSH
                      </button>
                    </td>
                    <td>{ row.status }</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        { isScanning ? <progress className="progress progress-info" /> : '' }
      </div>
    );
  }
}
