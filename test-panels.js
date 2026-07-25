/**
 * Local mock test for all panel frameworks
 * Run: node test-panels.js
 */

// ─── Mock global APIs ───────────────────────────────────────

global.crypto = {
  subtle: {
    digest: async (algo, buf) => {
      const { createHash } = require('crypto');
      const hash = createHash('sha256').update(Buffer.from(buf)).digest('hex');
      return Buffer.from(hash, 'hex');
    },
    importKey: async () => ({}),
    sign: async () => new Uint8Array(32).fill(0x42)
  }
};
global.TextEncoder = require('util').TextEncoder;

let fetchCalls = [];
global.fetch = async (url, opts = {}) => {
  fetchCalls.push({ url, method: opts.method || 'GET' });
  throw new Error(`fetch not mocked for: ${url}`);
};

// Mock chrome.storage.local
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb({}),
      set: (data, cb) => cb && cb(),
      remove: (keys, cb) => cb && cb()
    }
  },
  runtime: {
    lastError: null
  }
};

// ─── Import shared functions ─────────────────────────────────
eval(require('fs').readFileSync(__dirname + '/shared.js', 'utf8'));

// ─── Extract & test panel normalizers ─────────────────────────
const bg = require('fs').readFileSync(__dirname + '/background.js', 'utf8');

// Evaluate background.js functions into our scope
function evalBgFunc(funcName) {
  const match = bg.match(new RegExp(`function ${funcName}[^{]*\\{[\\s\\S]*?\\n(?=function |async function |\\/\\/ |$)`));
  if (!match) throw new Error(`Function ${funcName} not found`);
  return match[0];
}

eval(evalBgFunc('pickFirstDefined'));
eval(evalBgFunc('bytesResource'));
eval(evalBgFunc('normalizeVirtualizorServer'));
eval(evalBgFunc('normalizeProxmoxServer'));
eval(evalBgFunc('normalizeHetznerServer'));
eval(evalBgFunc('normalizeDOServer'));
eval(evalBgFunc('normalizeLightsailServer'));

// ─── Test cases ──────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'mismatch'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

console.log('\n═══ Virtualizor ───────────────────────────────────');
test('normalizeVirtualizorServer — online', () => {
  const result = normalizeVirtualizorServer({
    vpsid: '42',
    hostname: 'my-vps.example.com',
    status: '1',
    ips: '1.2.3.4,5.6.7.8',
    os_name: 'Ubuntu 22.04',
    ram: '2048',
    disk_space: '50',
    bandwidth: '2000',
    bandwidth_used: '150'
  });
  assertEq(result.id, '42');
  assertEq(result.status, 'online');
  assertEq(result.hostname, 'my-vps.example.com');
  assertEq(result.ipaddress, '1.2.3.4');
  assert(result.mem.includes('2048'), 'mem should contain 2048');
  assert(result.hdd.includes('51200'), 'hdd should be disk_space*1024');
  assert(result.bw.length > 0, 'bw should not be empty');
});

test('normalizeVirtualizorServer — offline', () => {
  const result = normalizeVirtualizorServer({ vpsid: '7', hostname: 'off', status: '0', ips: '', ram: '1024', disk_space: '25', bandwidth: '1000', bandwidth_used: '0' });
  assertEq(result.status, 'offline');
});

test('normalizeVirtualizorServer — suspended', () => {
  const result = normalizeVirtualizorServer({ vpsid: '7', hostname: 's', status: '2', ips: '', ram: '512', disk_space: '10', bandwidth: '500', bandwidth_used: '0' });
  assertEq(result.status, 'suspended');
});

console.log('\n═══ Proxmox ───────────────────────────────────────');
test('normalizeProxmoxServer — running', () => {
  const result = normalizeProxmoxServer({
    vmid: 100,
    name: 'web-server',
    status: 'running',
    qmpstatus: 'running',
    maxmem: 2147483648,  // 2 GB in bytes
    maxdisk: 32212254720, // 30 GB in bytes
    ip: '10.0.0.5'
  });
  assertEq(result.id, '100');
  assertEq(result.status, 'online');
  assertEq(result.hostname, 'web-server');
  assertEq(result.ipaddress, '10.0.0.5');
  assert(result.mem.includes('2048'), 'maxmem should be 2048 MB');
  assert(result.hdd.includes('30720'), 'maxdisk should be 30720 MB');
});

test('normalizeProxmoxServer — stopped', () => {
  const result = normalizeProxmoxServer({ vmid: 101, name: 'db', status: 'stopped', maxmem: 1073741824, maxdisk: 10737418240, ip: '' });
  assertEq(result.status, 'offline');
});

test('normalizeProxmoxServer — paused', () => {
  const result = normalizeProxmoxServer({ vmid: 102, name: 'cache', status: 'paused', maxmem: 0, maxdisk: 0, ip: '' });
  assertEq(result.status, 'paused');
  assertEq(result.mem, '0,0,0,0');
});

console.log('\n═══ Hetzner Cloud ─────────────────────────────────');
test('normalizeHetznerServer — running', () => {
  const result = normalizeHetznerServer({
    id: 12345678,
    name: 'hetzner-box',
    status: 'running',
    public_net: { ipv4: { ip: '116.203.x.x' } },
    server_type: { memory: 4, disk: 40 },
    image: { name: 'ubuntu-22.04' }
  });
  assertEq(result.id, '12345678');
  assertEq(result.status, 'online');
  assertEq(result.hostname, 'hetzner-box');
  assertEq(result.ipaddress, '116.203.x.x');
  assert(result.mem.includes('4096'), 'memory 4GB = 4096MB');
  assert(result.hdd.includes('40960'), 'disk 40GB = 40960MB');
});

test('normalizeHetznerServer — off', () => {
  const result = normalizeHetznerServer({ id: 1, name: 'stopped', status: 'off', public_net: { ipv4: {} }, server_type: { memory: 0, disk: 0 }, image: {} });
  assertEq(result.status, 'offline');
});

test('normalizeHetznerServer — starting', () => {
  const result = normalizeHetznerServer({ id: 2, name: 'booting', status: 'starting', public_net: { ipv4: {} }, server_type: { memory: 0, disk: 0 }, image: {} });
  assertEq(result.status, 'pending');
});

console.log('\n═══ DigitalOcean ──────────────────────────────────');
test('normalizeDOServer — active', () => {
  const result = normalizeDOServer({
    id: 987654321,
    name: 'do-droplet',
    status: 'active',
    memory: 1024,
    disk: 25,
    networks: { v4: [{ type: 'public', ip_address: '167.99.x.x' }, { type: 'private', ip_address: '10.0.0.1' }] },
    image: { distribution: 'Ubuntu', name: '22.04 (LTS) x64' }
  });
  assertEq(result.id, '987654321');
  assertEq(result.status, 'online');
  assertEq(result.ipaddress, '167.99.x.x');
  assert(result.mem.includes('1024'), 'memory 1024MB');
  assert(result.hdd.includes('25600'), 'disk 25GB = 25600MB');
});

test('normalizeDOServer — off', () => {
  const result = normalizeDOServer({ id: 1, name: 'off', status: 'off', memory: 0, disk: 0, networks: { v4: [] }, image: {} });
  assertEq(result.status, 'offline');
});

test('normalizeDOServer — new (pending)', () => {
  const result = normalizeDOServer({ id: 2, name: 'new', status: 'new', memory: 0, disk: 0, networks: { v4: [] }, image: {} });
  assertEq(result.status, 'pending');
});

console.log('\n═══ AWS Lightsail ─────────────────────────────────');
test('normalizeLightsailServer — running', () => {
  const result = normalizeLightsailServer({
    name: 'lightsail-instance',
    arn: 'arn:aws:lightsail:us-east-1:123:Instance/abc',
    state: { name: 'running' },
    publicIpAddress: '3.90.x.x',
    blueprintName: 'ubuntu_22_04',
    hardware: { ramSizeInGb: 1, disks: [{ sizeInGb: 40 }] }
  });
  assertEq(result.id, 'lightsail-instance');
  assertEq(result.status, 'online');
  assertEq(result.hostname, 'lightsail-instance');
  assertEq(result.ipaddress, '3.90.x.x');
  assert(result.mem.includes('1024'), '1GB = 1024MB');
  assert(result.hdd.includes('40960'), '40GB = 40960MB');
});

test('normalizeLightsailServer — stopped', () => {
  const result = normalizeLightsailServer({ name: 'stopped', state: { name: 'stopped' }, hardware: { disks: [] } });
  assertEq(result.status, 'offline');
});

test('normalizeLightsailServer — rebooting', () => {
  const result = normalizeLightsailServer({ name: 'rebooting', state: { name: 'rebooting' }, hardware: { disks: [] } });
  assertEq(result.status, 'online'); // rebooting mapped to online
});

test('normalizeLightsailServer — pending', () => {
  const result = normalizeLightsailServer({ name: 'pending', state: { name: 'pending' }, hardware: { disks: [] } });
  assertEq(result.status, 'pending');
});

// ─── Result ──────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} total`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
