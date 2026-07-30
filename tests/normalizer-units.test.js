const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBackground() {
  const context = {
    console,
    URLSearchParams,
    TextEncoder,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    AbortController,
    Date,
    fetch: async () => { throw new Error('no network in unit test'); },
    importScripts(...files) {
      for (const f of files) {
        const p = path.join(__dirname, '..', f);
        vm.runInContext(fs.readFileSync(p, 'utf8'), context, { filename: p });
      }
    },
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      storage: {
        local: {
          get(_keys, callback) { callback({ servers: [], currentServerId: null }); },
          set(_value, callback) { if (callback) callback(); },
          remove(_keys, callback) { if (callback) callback(); }
        }
      }
    }
  };
  vm.createContext(context);
  const backgroundPath = path.join(__dirname, '..', 'background.js');
  vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), context, { filename: backgroundPath });
  return context;
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

function testVirtualizorUnits() {
  const ctx = loadBackground();
  // ram = MB, disk_space = GB, bandwidth = GB
  const s = ctx.normalizeVirtualizorServer({
    vpsid: 'v1', hostname: 'vps', status: '1', ips: '1.2.3.4', os_name: 'CentOS',
    ram: 2048, disk_space: 40, bandwidth: 2, bandwidth_used: 1
  });
  assert.strictEqual(s.mem, `0,${2048 * MB},${2048 * MB},0`, 'Virtualizor mem should be 2 GB in bytes');
  assert.strictEqual(s.hdd, `0,${40 * GB},${40 * GB},0`, 'Virtualizor hdd should be 40 GB in bytes');
  // used/total in bytes, percent = 50
  assert.strictEqual(s.bw, `${1 * GB},${2 * GB},${2 * GB},50`, 'Virtualizor bw should be 1/2 GB in bytes');
}

function testHetznerUnits() {
  const ctx = loadBackground();
  // memory/disk = GB; traffic in bytes from server detail
  const s = ctx.normalizeHetznerServer({
    id: 1, name: 'srv', status: 'running',
    public_net: { ipv4: { ip: '1.2.3.4' } },
    server_type: { memory: 4, disk: 40 },
    image: { name: 'Ubuntu' },
    outgoing_traffic: 1000000000, ingoing_traffic: 1000000000
  });
  assert.strictEqual(s.mem, `0,${4 * GB},${4 * GB},0`, 'Hetzner mem should be 4 GB in bytes');
  assert.strictEqual(s.hdd, `0,${40 * GB},${40 * GB},0`, 'Hetzner hdd should be 40 GB in bytes');
  assert.strictEqual(s.bw, `0,${2000000000},${2000000000},0`, 'Hetzner bw should sum traffic bytes');
}

function testLightsailUnits() {
  const ctx = loadBackground();
  // ramSizeInGb/diskSizeGb = GB; monthlyTransfer.gbAllowed = quota GB
  const s = ctx.normalizeLightsailServer({
    name: 'inst', state: { name: 'running' },
    hardware: { ramSizeInGb: 2, disks: [{ sizeInGb: 40 }] },
    networking: { monthlyTransfer: { gbAllowed: 3 } },
    publicIpAddress: '1.2.3.4', blueprintName: 'Ubuntu'
  });
  assert.strictEqual(s.mem, `0,${2 * GB},${2 * GB},0`, 'Lightsail mem should be 2 GB in bytes');
  assert.strictEqual(s.hdd, `0,${40 * GB},${40 * GB},0`, 'Lightsail hdd should be 40 GB in bytes');
  assert.strictEqual(s.bw, `0,${3 * GB},${3 * GB},0`, 'Lightsail bw should be 3 GB quota in bytes');
}

async function run() {
  testVirtualizorUnits();
  testHetznerUnits();
  testLightsailUnits();
  console.log('normalizer-units tests passed');
}

run().catch(err => { console.error(err); process.exit(1); });
