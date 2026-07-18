/**
 * Background Service Worker
 * Handles all SolusVM API calls
 */

function normalizeTagList(value) {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || '').split(/[\s,，]+/);

  const seen = new Set();
  return rawTags
    .map(tag => String(tag).trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getAllTagsFromServers(list) {
  const seen = new Map();
  list.forEach(server => {
    normalizeTagList(server.tags).forEach(tag => {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    });
  });
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

function normalizeServers(list) {
  return (Array.isArray(list) ? list : []).map(server => ({
    id: server.id || 'server_' + Math.random().toString(36).substr(2, 9),
    name: server.name || 'Default Server',
    apiUrl: (server.apiUrl || '').trim(),
    apiKey: (server.apiKey || '').trim(),
    apiHash: (server.apiHash || '').trim(),
    panel_type: server.panel_type || 'solusvm',
    tags: normalizeTagList(server.tags)
  }));
}

// Check and migrate legacy data structures
function checkAndMigrateConfig(callback) {
  chrome.storage.local.get(['apiUrl', 'apiKey', 'apiHash', 'servers', 'tags'], data => {
    let list = data.servers || [];
    if (list.length === 0 && data.apiUrl && data.apiKey && data.apiHash) {
      const defaultServer = {
        id: 'server_' + Date.now(),
        name: 'Default Server',
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        apiHash: data.apiHash,
        panel_type: 'solusvm',
        tags: []
      };
      chrome.storage.local.set({
        servers: [defaultServer],
        tags: [],
        currentServerId: defaultServer.id
      }, () => {
        chrome.storage.local.remove(['apiUrl', 'apiKey', 'apiHash'], () => {
          if (callback) callback();
        });
      });
    } else {
      const normalizedServers = normalizeServers(list);
      const normalizedTags = getAllTagsFromServers(normalizedServers);
      const serversChanged = JSON.stringify(data.servers) !== JSON.stringify(normalizedServers);
      const tagsChanged = JSON.stringify(data.tags || []) !== JSON.stringify(normalizedTags);
      if (serversChanged || tagsChanged) {
        chrome.storage.local.set({
          servers: normalizedServers,
          tags: normalizedTags
        }, () => {
          if (callback) callback();
        });
      } else if (callback) {
        callback();
      }
    }
  });
}

// Get the currently active server configuration (using native Promise for safe await)
function getActiveServerConfig() {
  return new Promise((resolve, reject) => {
    checkAndMigrateConfig(() => {
      chrome.storage.local.get(['servers', 'currentServerId'], data => {
        if (!data.servers || data.servers.length === 0) {
          reject(new Error('Please configure API settings first'));
          return;
        }
        const activeServer = data.servers.find(s => s.id === data.currentServerId) || data.servers[0];
        if (!activeServer) {
          reject(new Error('Selected server configuration is incomplete'));
        } else {
          resolve(activeServer);
        }
      });
    });
  });
}

function getPanelType(config) {
  return (config && config.panel_type) || 'solusvm';
}

function requireSolusVM1Config(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('Selected SolusVM v1 configuration is incomplete, please reconfigure in settings');
  }
}

function requireSolusVM2Config(config) {
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('Selected SolusVM 2 configuration is incomplete. API URL and API token are required');
  }
}

function normalizeSolusVM1Url(config) {
  let url = config.apiUrl.trim();
  url = url.replace(/\/$/, '');
  if (!url.includes('/api/client/command.php')) {
    url = url.replace(/\/api$/, '');
    url = url + '/api/client/command.php';
  }
  return url;
}

// SolusVM v1 API call wrapper
async function callSolusVM1(command, extraParams = {}, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireSolusVM1Config(config);

  const url = normalizeSolusVM1Url(config);

  const params = new URLSearchParams();
  params.append('key', config.apiKey);
  params.append('hash', config.apiHash);
  params.append('action', command);
  for (const [key, value] of Object.entries(extraParams)) {
    params.append(key, value);
  }

  console.log(`[DEBUG] fetch ${command} → ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  }).catch(err => {
    console.error(`[ERROR] fetch failed for ${command}:`, err.message, 'URL:', url);
    throw err;
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  const text = await response.text();
  console.log(`[DEBUG] Raw response for action ${command}:`, text);
  const result = parseApiResponse(text);
  console.log(`[DEBUG] Parsed result for action ${command}:`, result);
  if (result.status && result.status !== 'success') {
    throw new Error(result.statusmsg || 'Operation failed');
  }
  return result;
}

function normalizeSolusVM2BaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  url = url.replace(/\/api\/v\d+\/?$/, '');
  return url;
}

function normalizeSolusVM2ConfiguredUrl(config) {
  const raw = config.apiUrl.trim().replace(/\/$/, '');
  if (/\/api\/v\d+\//.test(raw)) return raw;
  return normalizeSolusVM2BaseUrl(config) + '/api/v1';
}

function getSolusVM2Headers(config) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };
  return headers;
}

async function fetchSolusVM2Json(url, config, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: getSolusVM2Headers(config),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`SolusVM 2 API returned non-JSON response from ${url}`);
    }
  }

  if (!response.ok) {
    const msg = data.message || data.error || data.detail || response.statusText || 'Request failed';
    throw new Error(`SolusVM 2 API request failed: ${response.status} ${msg}`);
  }

  return data;
}

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const candidates = [
    value.data,
    value.items,
    value.results,
    value.servers,
    value.virtual_servers,
    value.virtualServers
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function pickFirstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function bytesResource(used, total) {
  if (used === undefined && total === undefined) return undefined;
  const usedVal = Number(used || 0);
  const totalVal = Number(total || 0);
  const percent = totalVal > 0 ? Math.round((usedVal / totalVal) * 100) : 0;
  return `${usedVal},${totalVal},${totalVal},${percent}`;
}

function normalizeSolusVM2Server(raw = {}) {
  const server = raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const status = String(pickFirstDefined(
    server.status,
    server.state,
    server.power_state,
    server.powerState,
    server.vm_state,
    server.vmState,
    server.compute_resource_status
  ) || '').toLowerCase();

  const ips = pickFirstDefined(server.ip_addresses, server.ipAddresses, server.ips, server.ip);
  const firstIp = Array.isArray(ips)
    ? pickFirstDefined(ips[0] && (ips[0].ip || ips[0].address), ips[0])
    : ips;

  const memory = pickFirstDefined(server.memory, server.ram, server.mem, server.resources && server.resources.memory);
  const disk = pickFirstDefined(server.disk, server.hdd, server.resources && server.resources.disk);
  const bandwidth = pickFirstDefined(server.bandwidth, server.traffic, server.bw, server.resources && server.resources.bandwidth);

  return {
    id: pickFirstDefined(server.id, server.uuid, server.server_id, server.virtual_server_id),
    hostname: pickFirstDefined(server.hostname, server.name, server.fqdn, server.domain),
    status: status || 'unknown',
    statusmsg: status || 'unknown',
    vmstate: status || 'unknown',
    ipaddress: firstIp,
    ip: firstIp,
    os: pickFirstDefined(server.os, server.operating_system, server.template && server.template.name, server.image && server.image.name),
    template: pickFirstDefined(server.template_name, server.template && server.template.name, server.image && server.image.name),
    mem: typeof memory === 'object'
      ? bytesResource(pickFirstDefined(memory.used, memory.usage, memory.consumed), pickFirstDefined(memory.total, memory.limit, memory.size))
      : bytesResource(undefined, memory),
    hdd: typeof disk === 'object'
      ? bytesResource(pickFirstDefined(disk.used, disk.usage, disk.consumed), pickFirstDefined(disk.total, disk.limit, disk.size))
      : bytesResource(undefined, disk),
    bw: typeof bandwidth === 'object'
      ? bytesResource(pickFirstDefined(bandwidth.used, bandwidth.usage, bandwidth.consumed), pickFirstDefined(bandwidth.total, bandwidth.limit, bandwidth.size))
      : bytesResource(undefined, bandwidth)
  };
}

async function getSolusVM2Server(config) {
  requireSolusVM2Config(config);
  const configuredUrl = normalizeSolusVM2ConfiguredUrl(config);

  if (/\/api\/v\d+\/.+\/[^/]+$/.test(configuredUrl) && !/\/api\/v\d+$/.test(configuredUrl)) {
    return normalizeSolusVM2Server(await fetchSolusVM2Json(configuredUrl, config));
  }

  const baseUrl = normalizeSolusVM2BaseUrl(config);
  const listEndpoints = [
    '/api/v1/servers'
  ];

  let lastError;
  for (const path of listEndpoints) {
    const url = baseUrl + path;
    try {
      const data = await fetchSolusVM2Json(url, config);
      const servers = firstArray(data);
      if (servers.length === 1) {
        return normalizeSolusVM2Server(servers[0]);
      }
      if (servers.length > 1) {
        throw new Error('Multiple SolusVM 2 servers found. Please use a full API URL for one virtual server instead of the account-level API URL.');
      }
      lastError = new Error(`No servers found from ${url}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Unable to discover SolusVM 2 server endpoint');
}

async function callSolusVM2Action(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireSolusVM2Config(config);
  const configuredUrl = normalizeSolusVM2ConfiguredUrl(config);

  if (!/\/api\/v\d+\/.+\/[^/]+$/.test(configuredUrl) || /\/api\/v\d+$/.test(configuredUrl)) {
    throw new Error('SolusVM 2 power actions require a full virtual server API URL, for example https://panel.example.com/api/v1/servers/123');
  }

  const actionPaths = {
    reboot: ['restart'],
    boot: ['start'],
    shutdown: ['stop']
  }[action] || [];

  let lastError;
  for (const actionPath of actionPaths) {
    try {
      return await fetchSolusVM2Json(`${configuredUrl}/${actionPath}`, config, { method: 'POST' });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Unsupported SolusVM 2 action: ${action}`);
}

async function withActivePanel(handlerByPanel) {
  const config = await getActiveServerConfig();
  const panelType = getPanelType(config);
  const handler = handlerByPanel[panelType] || handlerByPanel.solusvm;
  return await handler(config);
}

// Parse SolusVM API response, compatible with both XML and key-value formats
function parseApiResponse(text) {
  text = text.trim();
  if (text.startsWith('<')) {
    const result = {};
    // Regex to extract flat XML nodes (e.g., <hostname>vps.test.com</hostname>)
    const regex = /<([^>]+)>([^<]*)<\/\1>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      result[match[1]] = match[2];
    }
    return result;
  } else {
    const lines = text.split('\n');
    const result = {};
    for (const line of lines) {
      const idx = line.indexOf(',');
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }
}

// Get server list
async function listServers() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('list', {}, config),
    solusvm2: config => getSolusVM2Server(config)
  });
}

// Get server details
async function getServerInfo() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('info', { status: 'true', bw: 'true', hdd: 'true', mem: 'true', ipaddr: 'true' }, config),
    solusvm2: config => getSolusVM2Server(config)
  });
}

// Get server status
async function getServerStatus() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('status', {}, config),
    solusvm2: config => getSolusVM2Server(config)
  });
}

// Reboot server
async function rebootServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('reboot', {}, config),
    solusvm2: config => callSolusVM2Action('reboot', config)
  });
}

// Boot server
async function bootServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('boot', {}, config),
    solusvm2: config => callSolusVM2Action('boot', config)
  });
}

// Shutdown server
async function shutdownServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('shutdown', {}, config),
    solusvm2: config => callSolusVM2Action('shutdown', config)
  });
}

// Test the connection status of temporary configuration
async function testConnection(config) {
  if (getPanelType(config) === 'solusvm2') {
    return await getSolusVM2Server(config);
  }

  requireSolusVM1Config(config);
  const url = normalizeSolusVM1Url(config);

  const params = new URLSearchParams();
  params.append('key', config.apiKey);
  params.append('hash', config.apiHash);
  params.append('action', 'info');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    throw new Error(`API connection failed: ${response.status}`);
  }

  const text = await response.text();
  const result = parseApiResponse(text);
  if (result.status && result.status !== 'success') {
    throw new Error(result.statusmsg || 'Connection failed');
  }
  return result;
}

// Listen for messages from popup / options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    getStatus: getServerStatus,
    getInfo: getServerInfo,
    reboot: rebootServer,
    boot: bootServer,
    shutdown: shutdownServer,
    testConnection: () => testConnection(message.config)
  };

  const handler = handlers[message.action];
  if (handler) {
    handler()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Asynchronous response
  }
});
