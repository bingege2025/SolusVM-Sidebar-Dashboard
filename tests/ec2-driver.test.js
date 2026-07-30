const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function xmlResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    text: async () => body
  };
}

function loadBackground(fetchImpl) {
  const context = {
    console,
    URLSearchParams,
    TextEncoder,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    AbortController,
    Date,
    fetch: fetchImpl,
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
  vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), context, {
    filename: backgroundPath
  });
  return context;
}

const DESCRIBE_INSTANCES_XML = `<?xml version="1.0"?>
<DescribeInstancesResponse>
  <reservationSet>
    <item>
      <instancesSet>
        <item>
          <instanceId>i-0abc123</instanceId>
          <instanceType>t3.micro</instanceType>
          <instanceState><code>16</code><name>running</name></instanceState>
          <ipAddress>1.2.3.4</ipAddress>
          <tagSet>
            <item><key>Name</key><value>my-ec2</value></item>
          </tagSet>
          <blockDeviceMapping>
            <item>
              <deviceName>/dev/xvda</deviceName>
              <ebs><volumeId>vol-1</volumeId><status>attached</status></ebs>
            </item>
          </blockDeviceMapping>
        </item>
      </instancesSet>
    </item>
  </reservationSet>
</DescribeInstancesResponse>`;

const DESCRIBE_VOLUMES_XML = `<?xml version="1.0"?>
<DescribeVolumesResponse>
  <volumeSet>
    <item><volumeId>vol-1</volumeId><size>30</size></item>
    <item><volumeId>vol-2</volumeId><size>10</size></item>
  </volumeSet>
</DescribeVolumesResponse>`;

function cloudWatchXml(sums) {
  const members = sums.map(s => `<member><Sum>${s}</Sum><Unit>Bytes</Unit></member>`).join('');
  return `<?xml version="1.0"?>
<GetMetricStatisticsResponse>
  <GetMetricStatisticsResult><Datapoints>${members}</Datapoints></GetMetricStatisticsResult>
</GetMetricStatisticsResponse>`;
}

async function testEC2DiskAndBandwidth() {
  const calls = [];
  const context = loadBackground(async (url, options = {}) => {
    const body = String(options.body || '');
    calls.push({ url, body });
    if (url.includes('monitoring.')) {
      // NetworkIn: 1 GiB, NetworkOut: 2 GiB (split across datapoints)
      if (body.includes('MetricName=NetworkIn')) return xmlResponse(200, cloudWatchXml([1073741824]));
      return xmlResponse(200, cloudWatchXml([1073741824, 1073741824]));
    }
    if (body.includes('Action=DescribeInstances')) return xmlResponse(200, DESCRIBE_INSTANCES_XML);
    if (body.includes('Action=DescribeVolumes')) return xmlResponse(200, DESCRIBE_VOLUMES_XML);
    throw new Error('Unexpected request: ' + url + ' ' + body);
  });

  const server = await context.getEC2Single({
    apiUrl: 'us-east-1',
    apiKey: 'AKIAEXAMPLE',
    apiHash: 'secret'
  });

  assert.strictEqual(server.id, 'i-0abc123');
  assert.strictEqual(server.hostname, 'my-ec2');
  assert.strictEqual(server.status, 'online');
  // mem: t3.micro = 1024 MB → bytes
  assert.strictEqual(server.mem, `0,${1024 * 1024 * 1024},${1024 * 1024 * 1024},0`);
  // hdd: 30 + 10 GiB → bytes
  const hddBytes = 40 * 1024 * 1024 * 1024;
  assert.strictEqual(server.hdd, `0,${hddBytes},${hddBytes},0`);
  // bw: 3 GiB month-to-date traffic
  const bwBytes = 3 * 1073741824;
  assert.strictEqual(server.bw, `0,${bwBytes},${bwBytes},0`);

  // DescribeVolumes must filter by the instance id
  const volCall = calls.find(c => c.body.includes('Action=DescribeVolumes'));
  assert.ok(volCall.body.includes('attachment.instance-id'));
  assert.ok(volCall.body.includes('i-0abc123'));
  // CloudWatch must query both metrics with the instance dimension
  const cwCalls = calls.filter(c => c.url.includes('monitoring.'));
  assert.strictEqual(cwCalls.length, 2);
  assert.ok(cwCalls.every(c => c.body.includes('i-0abc123')));
}

async function testEC2GracefulDegradation() {
  // DescribeVolumes / CloudWatch failures must NOT break status refresh
  const context = loadBackground(async (url, options = {}) => {
    const body = String(options.body || '');
    if (url.includes('monitoring.')) {
      return xmlResponse(403, '<ErrorResponse><Error><Code>AccessDenied</Code><Message>no cloudwatch perm</Message></Error></ErrorResponse>');
    }
    if (body.includes('Action=DescribeInstances')) return xmlResponse(200, DESCRIBE_INSTANCES_XML);
    if (body.includes('Action=DescribeVolumes')) {
      return xmlResponse(403, '<Response><Errors><Error><Code>UnauthorizedOperation</Code><Message>no ec2:DescribeVolumes</Message></Error></Errors></Response>');
    }
    throw new Error('Unexpected request: ' + url + ' ' + body);
  });

  const server = await context.getEC2Single({
    apiUrl: 'us-east-1',
    apiKey: 'AKIAEXAMPLE',
    apiHash: 'secret'
  });

  assert.strictEqual(server.status, 'online');
  assert.strictEqual(server.hdd, '0,0,0,0'); // shown as N/A, but refresh still works
  assert.strictEqual(server.bw, '0,0,0,0');
}

async function run() {
  await testEC2DiskAndBandwidth();
  await testEC2GracefulDegradation();
  console.log('ec2-driver tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
