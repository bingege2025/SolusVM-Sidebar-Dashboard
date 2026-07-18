const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    text: async () => JSON.stringify(body)
  };
}

function loadBackground(fetchImpl) {
  const context = {
    console,
    URLSearchParams,
    fetch: fetchImpl,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        }
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback({ servers: [], currentServerId: null });
          },
          set(_value, callback) {
            if (callback) callback();
          },
          remove(_keys, callback) {
            if (callback) callback();
          }
        }
      }
    }
  };

  vm.createContext(context);
  const backgroundPath = path.join(__dirname, '..', 'background.js');
  vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), context, {
    filename: backgroundPath
  });
  return context;
}

async function run() {
  await testFullServerUrl();
  await testBaseUrlDiscovery();
  await testMultipleServerGuard();
  await testPowerActionUrl();
  await testPowerActionRequiresFullServerUrl();
  console.log('solusvm2-driver tests passed');
}

async function testFullServerUrl() {
  const calls = [];
  const context = loadBackground(async (url, options) => {
    calls.push({ url, options });
    assert.strictEqual(url, 'https://panel.example.com/api/v1/servers/123');
    assert.strictEqual(options.method, 'GET');
    assert.strictEqual(options.headers.Authorization, 'Bearer token-123');
    return jsonResponse(200, {
      data: {
        id: 123,
        name: 'demo-vps',
        state: 'running',
        ip_addresses: [{ ip: '203.0.113.10' }],
        os: 'Debian 12',
        memory: { used: 536870912, total: 1073741824 },
        disk: { used: 10737418240, total: 21474836480 },
        bandwidth: { used: 1099511627776, total: 2199023255552 }
      }
    });
  });

  const result = await context.testConnection({
    panel_type: 'solusvm2',
    apiUrl: 'https://panel.example.com/api/v1/servers/123',
    apiKey: 'token-123',
    apiHash: ''
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(result.id, 123);
  assert.strictEqual(result.hostname, 'demo-vps');
  assert.strictEqual(result.status, 'running');
  assert.strictEqual(result.ipaddress, '203.0.113.10');
  assert.strictEqual(result.mem, '536870912,1073741824,1073741824,50');
  assert.strictEqual(result.hdd, '10737418240,21474836480,21474836480,50');
  assert.strictEqual(result.bw, '1099511627776,2199023255552,2199023255552,50');
}

async function testBaseUrlDiscovery() {
  const calls = [];
  const context = loadBackground(async (url, options) => {
    calls.push({ url, options });
    assert.strictEqual(url, 'https://panel.example.com/api/v1/servers');
    assert.strictEqual(options.headers.Authorization, 'Bearer token-abc');
    return jsonResponse(200, {
      data: [{
        uuid: 'uuid-1',
        hostname: 'single-vps',
        power_state: 'started',
        ip: '198.51.100.20'
      }]
    });
  });

  const result = await context.testConnection({
    panel_type: 'solusvm2',
    apiUrl: 'https://panel.example.com',
    apiKey: 'token-abc',
    apiHash: ''
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(result.id, 'uuid-1');
  assert.strictEqual(result.hostname, 'single-vps');
  assert.strictEqual(result.status, 'started');
  assert.strictEqual(result.ipaddress, '198.51.100.20');
}

async function testMultipleServerGuard() {
  const context = loadBackground(async () => jsonResponse(200, {
    data: [{ id: 1 }, { id: 2 }]
  }));

  await assert.rejects(
    () => context.testConnection({
      panel_type: 'solusvm2',
      apiUrl: 'https://panel.example.com',
      apiKey: 'token-abc',
      apiHash: ''
    }),
    /Multiple SolusVM 2 servers found/
  );
}

async function testPowerActionUrl() {
  const calls = [];
  const context = loadBackground(async (url, options) => {
    calls.push({ url, options });
    assert.strictEqual(url, 'https://panel.example.com/api/v1/servers/123/restart');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers.Authorization, 'Bearer token-123');
    return jsonResponse(200, { status: 'success' });
  });

  const result = await context.callSolusVM2Action('reboot', {
    panel_type: 'solusvm2',
    apiUrl: 'https://panel.example.com/api/v1/servers/123',
    apiKey: 'token-123',
    apiHash: ''
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(result.status, 'success');
}

async function testPowerActionRequiresFullServerUrl() {
  const context = loadBackground(async () => jsonResponse(200, {}));

  await assert.rejects(
    () => context.callSolusVM2Action('shutdown', {
      panel_type: 'solusvm2',
      apiUrl: 'https://panel.example.com',
      apiKey: 'token-abc',
      apiHash: ''
    }),
    /power actions require a full virtual server API URL/
  );
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
