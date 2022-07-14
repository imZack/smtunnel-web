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
      connected: false,
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

  async disconnect() {
    const { smtunnel } = this.state;
    await smtunnel.stop();
    this.setState({
      isScanning: false,
      connected: false,
    });
  }

  async ssh(group, device) {
    const { smtunnel, term } = this.state;
    await smtunnel.ssh(group, device, term);
    this.setState({
      isScanning: false,
      connected: true,
    });
  }

  render() {
    const {
      fitAddon, smtunnel, deviceList, isScanning, connected,
    } = this.state;

    return (
      <div data-theme="dracula" className="container flex flex-col space-y-4 h-screen w-screen">
        <Head>
          <title>smtunnel web console</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div className="navbar bg-neutral text-neutral-content">
          <a className="btn btn-ghost normal-case text-xl" href="/">SSH via smtunnel</a>
        </div>

        <Resizable
          className="border-red-600"
          width={350}
          height={450}
          style={{
            padding: '0.4em',
            margin: '1em',
          }}
        >
          <div id="xterm-container" style={{ height: '100%', width: '100%' }} />
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
              className="input input-bordered w-full"
              disabled={connected || isScanning}
              onChange={this.handleMqttConnStrChange.bind(smtunnel)}
            />
          </div>
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary w-1/2"
              disabled={connected || isScanning}
              onClick={() => this.scan()}
            >
              Start / Scan
            </button>
            <button type="button" className="btn btn-secondary w-1/2" onClick={() => this.disconnect()}>Disconnect</button>
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
                        disabled={connected || row.status !== 'connected'}
                        onClick={async () => (
                          this.ssh(row.group, row.device)
                        )}
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
