/**
 * Background Service Worker
 * Handles all SolusVM API calls
 */

// normalizeTagList, normalizeServers, getAllTagsFromServers → shared.js
importScripts('shared.js');

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

// ─── VirtFusion API ──────────────────────────────────────────────
// VirtFusion: REST API with Bearer token auth at /api/v1

function requireVirtFusionConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('VirtFusion configuration is incomplete. API URL and API token are required');
  }
}

function normalizeVirtFusionBaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  url = url.replace(/\/api\/v\d+\/?$/, '');
  return url;
}

function normalizeVirtFusionConfiguredUrl(config) {
  const raw = config.apiUrl.trim().replace(/\/$/, '');
  if (/\/api\/v\d+\//.test(raw)) return raw;
  return normalizeVirtFusionBaseUrl(config) + '/api/v1';
}

function getVirtFusionHeaders(config) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };
}

async function fetchVirtFusion(url, config, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: getVirtFusionHeaders(config),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`VirtFusion API returned non-JSON response from ${url}`);
    }
  }

  if (!response.ok) {
    const msg = data.message || data.error || response.statusText || 'Request failed';
    throw new Error(`VirtFusion API request failed: ${response.status} ${msg}`);
  }

  return data;
}

function normalizeVirtFusionServer(server = {}) {
  const status = String(pickFirstDefined(
    server.state,
    server.status,
    server.power_state
  ) || '').toLowerCase();

  const ips = pickFirstDefined(
    server.ipAddresses, server.ip_addresses,
    (server.network && server.network.ipv4 && server.network.ipv4.address)
  );
  const firstIp = Array.isArray(ips)
    ? pickFirstDefined(ips[0] && (ips[0].ip || ips[0].address), ips[0])
    : ips;

  const memory = pickFirstDefined(server.memory, server.ram);
  const disk = pickFirstDefined(server.disk, server.hdd, server.storage);
  const bandwidth = pickFirstDefined(server.bandwidth, server.traffic);

  // Map VirtFusion statuses to SolusVM-compatible statuses
  const statusMap = {
    'online': 'online',
    'running': 'online',
    'offline': 'offline',
    'stopped': 'offline',
    'suspended': 'suspended',
    'complete': 'online',
    'building': 'building',
    'installing': 'building',
    'unknown': 'unknown'
  };
  const mappedStatus = statusMap[status] || status;

  return {
    id: pickFirstDefined(server.id, server.uuid),
    hostname: pickFirstDefined(server.hostname, server.name, server.fqdn),
    status: mappedStatus,
    statusmsg: status || 'unknown',
    vmstate: status || 'unknown',
    ipaddress: firstIp,
    ip: firstIp,
    os: pickFirstDefined(server.os, server.template),
    template: pickFirstDefined(server.template),
    mem: typeof memory === 'object'
      ? bytesResource(pickFirstDefined(memory.used, memory.usage), pickFirstDefined(memory.total, memory.limit))
      : bytesResource(undefined, memory),
    hdd: typeof disk === 'object'
      ? bytesResource(pickFirstDefined(disk.used, disk.usage), pickFirstDefined(disk.total, disk.limit))
      : bytesResource(undefined, disk),
    bw: typeof bandwidth === 'object'
      ? bytesResource(pickFirstDefined(bandwidth.used, bandwidth.usage), pickFirstDefined(bandwidth.total, bandwidth.limit))
      : bytesResource(undefined, bandwidth)
  };
}

async function getVirtFusionServerList(config) {
  requireVirtFusionConfig(config);
  const url = normalizeVirtFusionBaseUrl(config) + '/api/v1/servers?type=full';
  let response;
  try {
    response = await fetchVirtFusion(url, config);
  } catch (e) {
    // Fallback: try without type=full
    response = await fetchVirtFusion(normalizeVirtFusionBaseUrl(config) + '/api/v1/servers', config);
  }

  const servers = firstArray(response.data || response);
  if (servers.length === 0) {
    throw new Error('No servers found from VirtFusion API');
  }
  return servers.map(s => normalizeVirtFusionServer(s));
}

async function getVirtFusionSingle(config) {
  requireVirtFusionConfig(config);
  const configuredUrl = normalizeVirtFusionConfiguredUrl(config);

  // If URL points to a specific server (e.g. /api/v1/servers/69)
  if (/\/api\/v\d+\/servers\/\d+/.test(configuredUrl)) {
    const url = configuredUrl + '?remoteState=true';
    const response = await fetchVirtFusion(url, config);
    const server = (response.data || response);
    return normalizeVirtFusionServer(server);
  }

  // Otherwise get server list
  const servers = await getVirtFusionServerList(config);
  if (servers.length === 1) return servers[0];
  throw new Error('Multiple VirtFusion servers found. Please use a full server API URL (e.g. https://panel.example.com/api/v1/servers/123)');
}

async function callVirtFusionAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireVirtFusionConfig(config);
  const configuredUrl = normalizeVirtFusionConfiguredUrl(config);

  if (!/\/api\/v\d+\/servers\/\d+/.test(configuredUrl)) {
    throw new Error('VirtFusion power actions require a full server API URL, for example https://panel.example.com/api/v1/servers/123');
  }

  const actionPaths = {
    reboot: 'restart',
    boot: 'boot',
    shutdown: 'shutdown'
  }[action];

  if (!actionPaths) {
    throw new Error(`Unsupported VirtFusion action: ${action}`);
  }

  return await fetchVirtFusion(`${configuredUrl}/power/${actionPaths}`, config, { method: 'POST' });
}

// ─── Virtualizor API ───────────────────────────────────────────
// Virtualizor enduser: GET with query params, api=json&apikey=...&apipass=...

function requireVirtualizorConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('Virtualizor configuration is incomplete. API URL, API Key, and API Password are required');
  }
}

function normalizeVirtualizorBaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  if (!url.includes('/index.php')) {
    url = url + '/index.php';
  }
  return url;
}

async function fetchVirtualizor(config, params) {
  const baseUrl = normalizeVirtualizorBaseUrl(config);
  const query = new URLSearchParams({
    api: 'json',
    apikey: config.apiKey,
    apipass: config.apiHash,
    ...params
  });
  const url = baseUrl + '?' + query.toString();

  const response = await fetch(url);
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`Virtualizor API returned non-JSON: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = data.error || data.message || `HTTP ${response.status}`;
    throw new Error(`Virtualizor API error: ${msg}`);
  }
  // Virtualizor returns error in JSON body even with 200
  if (data.error) {
    const msgs = Array.isArray(data.error) ? data.error.join(', ') : data.error;
    throw new Error(`Virtualizor error: ${msgs}`);
  }
  return data;
}

function normalizeVirtualizorServer(raw) {
  // raw comes from listvs response: vps array items
  const statusMap = { '1': 'online', '0': 'offline', '2': 'suspended' };
  const status = statusMap[raw.status] || 'unknown';

  return {
    id: raw.vpsid,
    hostname: raw.hostname || raw.vps_name,
    status: status,
    statusmsg: status === 'online' ? 'running' : (status === 'offline' ? 'stopped' : status),
    vmstate: status,
    ipaddress: (raw.ips || '').split(',')[0].trim(),
    ip: (raw.ips || '').split(',')[0].trim(),
    os: raw.os_name || raw.os_distro,
    template: raw.os_name || raw.os_distro,
    mem: bytesResource(undefined, Number(raw.ram || 0)),
    hdd: bytesResource(undefined, Number(raw.disk_space || 0) * 1024),
    bw: bytesResource(Number(raw.bandwidth_used || 0) * 1024, Number(raw.bandwidth || 0) * 1024)
  };
}

async function getVirtualizorSingle(config) {
  requireVirtualizorConfig(config);
  const data = await fetchVirtualizor(config, { act: 'listvs' });

  const vpsList = data.vps || [];
  // Also check single vps response
  const singleVps = data.vs;
  if (singleVps && !Array.isArray(singleVps)) {
    // Merge vs_info into the vps object
    const info = data.vs_info || {};
    return normalizeVirtualizorServer({ ...singleVps, ...info });
  }

  if (vpsList.length === 0) {
    throw new Error('No VPS found in Virtualizor account');
  }
  if (vpsList.length > 1) {
    throw new Error('Multiple VPS found. Currently only single-VPS accounts are supported.');
  }
  return normalizeVirtualizorServer(vpsList[0]);
}

async function callVirtualizorAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireVirtualizorConfig(config);

  const actionMap = {
    'reboot': 'restart',
    'boot': 'start',
    'shutdown': 'stop'
  };
  const act = actionMap[action];
  if (!act) throw new Error(`Unsupported Virtualizor action: ${action}`);

  // Get VPS ID first
  const listData = await fetchVirtualizor(config, { act: 'listvs' });
  const vpsList = listData.vps || [];
  let vpsId;
  if (vpsList.length > 0) {
    vpsId = vpsList[0].vpsid;
  } else if (listData.vs && listData.vs.vpsid) {
    vpsId = listData.vs.vpsid;
  } else {
    throw new Error('No VPS found for action');
  }

  return await fetchVirtualizor(config, { act, svs: String(vpsId) });
}

// ─── Proxmox VE API ────────────────────────────────────────────
// Proxmox: REST API with API token auth, lists VMs via nodes/{node}/qemu

function requireProxmoxConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('Proxmox configuration is incomplete. API URL and API Token are required');
  }
}

function normalizeProxmoxBaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  if (!url.includes('/api2/json')) {
    url = url + '/api2/json';
  }
  return url;
}

async function fetchProxmox(url, config, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `PVEAPIToken=${config.apiKey}`
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`Proxmox API returned non-JSON: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = (data.errors && data.errors.message) || data.message || `HTTP ${response.status}`;
    throw new Error(`Proxmox API error: ${msg}`);
  }
  return data;
}

async function getProxmoxNodes(config) {
  const baseUrl = normalizeProxmoxBaseUrl(config);
  const data = await fetchProxmox(baseUrl + '/nodes', config);
  return (data.data || []).map(n => n.node);
}

function normalizeProxmoxServer(raw) {
  const statusMap = {
    'running': 'online',
    'stopped': 'offline',
    'paused': 'paused'
  };
  const status = statusMap[raw.status] || raw.status || 'unknown';

  // Memory in bytes → MB
  const maxmem = raw.maxmem ? Math.round(raw.maxmem / 1048576) : 0;
  // Disk in bytes → MB
  const maxdisk = raw.maxdisk ? Math.round(raw.maxdisk / 1048576) : 0;

  return {
    id: String(raw.vmid),
    hostname: raw.name,
    status: status,
    statusmsg: raw.status || 'unknown',
    vmstate: raw.qmpstatus || raw.status || 'unknown',
    ipaddress: raw.ip || '',
    ip: raw.ip || '',
    os: raw.os || '',
    template: raw.template || '',
    mem: bytesResource(undefined, maxmem),
    hdd: bytesResource(undefined, maxdisk),
    bw: bytesResource(undefined, 0)
  };
}

async function getProxmoxSingle(config) {
  requireProxmoxConfig(config);
  const baseUrl = normalizeProxmoxBaseUrl(config);

  // Check if URL already points to a specific VM
  const vmMatch = baseUrl.match(/\/nodes\/([^/]+)\/(?:qemu|lxc)\/(\d+)\/status\/current/);
  if (vmMatch) {
    const data = await fetchProxmox(baseUrl, config);
    return normalizeProxmoxServer(data.data || {});
  }

  // Auto-discover: list nodes → list VMs
  const nodes = await getProxmoxNodes(config);
  if (nodes.length === 0) throw new Error('No Proxmox nodes found');

  let allVms = [];
  for (const node of nodes) {
    const qemuData = await fetchProxmox(baseUrl + `/nodes/${node}/qemu`, config);
    allVms.push(...(qemuData.data || []).map(v => ({ ...v, _node: node })));
    const lxcData = await fetchProxmox(baseUrl + `/nodes/${node}/lxc`, config);
    allVms.push(...(lxcData.data || []).map(v => ({ ...v, _node: node })));
  }

  if (allVms.length === 0) throw new Error('No VMs/containers found on Proxmox');
  if (allVms.length > 1) throw new Error('Multiple VMs found. Currently only single-VM setups are supported.');

  const vm = allVms[0];
  // Get detailed status
  const vmType = vm.type || 'qemu'; // lxc or qemu
  const statusData = await fetchProxmox(baseUrl + `/nodes/${vm._node}/${vmType}/${vm.vmid}/status/current`, config);
  return normalizeProxmoxServer(statusData.data || vm);
}

async function callProxmoxAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireProxmoxConfig(config);
  const baseUrl = normalizeProxmoxBaseUrl(config);

  const actionMap = {
    'reboot': 'reboot',
    'boot': 'start',
    'shutdown': 'stop'
  };
  const pmAction = actionMap[action];
  if (!pmAction) throw new Error(`Unsupported Proxmox action: ${action}`);

  // Discover VM ID
  const nodes = await getProxmoxNodes(config);
  for (const node of nodes) {
    const qemuData = await fetchProxmox(baseUrl + `/nodes/${node}/qemu`, config);
    const lxcData = await fetchProxmox(baseUrl + `/nodes/${node}/lxc`, config);
    const allVms = [...(qemuData.data || []), ...(lxcData.data || [])];
    if (allVms.length > 0) {
      const vm = allVms[0];
      const vmType = vm.type || 'qemu';
      return await fetchProxmox(baseUrl + `/nodes/${node}/${vmType}/${vm.vmid}/status/${pmAction}`, config, { method: 'POST' });
    }
  }
  throw new Error('No VMs found for action');
}

// ─── Hetzner Cloud API ─────────────────────────────────────────
// Hetzner Cloud: REST API, Bearer token, list /servers

function requireHetznerConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('Hetzner Cloud configuration is incomplete. API URL and API Token are required');
  }
}

function normalizeHetznerBaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  if (!url.includes('/v1')) url = url + '/v1';
  return url;
}

async function fetchHetzner(url, config, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`Hetzner API returned non-JSON: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = (data.error && data.error.message) || data.message || `HTTP ${response.status}`;
    throw new Error(`Hetzner API error: ${msg}`);
  }
  return data;
}

function normalizeHetznerServer(raw) {
  const statusMap = { 'running': 'online', 'off': 'offline', 'starting': 'pending', 'stopping': 'pending' };
  const status = statusMap[raw.status] || raw.status || 'unknown';
  const publicNet = raw.public_net || {};
  const ipv4 = publicNet.ipv4 || {};
  const serverType = raw.server_type || {};
  const image = raw.image || {};
  const memory = serverType.memory || 0; // GB
  const disk = serverType.disk || 0; // GB

  return {
    id: String(raw.id),
    hostname: raw.name,
    status,
    statusmsg: raw.status || 'unknown',
    vmstate: raw.status || 'unknown',
    ipaddress: ipv4.ip || '',
    ip: ipv4.ip || '',
    os: image.name || image.os_flavor || '',
    template: image.name || '',
    mem: bytesResource(undefined, memory * 1024),
    hdd: bytesResource(undefined, disk * 1024),
    bw: bytesResource(undefined, 0)
  };
}

async function getHetznerSingle(config) {
  requireHetznerConfig(config);
  const baseUrl = normalizeHetznerBaseUrl(config);

  // Direct URL for single server
  const idMatch = baseUrl.match(/\/servers\/(\d+)/);
  if (idMatch) {
    const data = await fetchHetzner(baseUrl, config);
    return normalizeHetznerServer(data.server || {});
  }

  const data = await fetchHetzner(baseUrl + '/servers', config);
  const servers = data.servers || [];
  if (servers.length === 0) throw new Error('No Hetzner Cloud servers found');
  if (servers.length > 1) throw new Error('Multiple Hetzner servers found. Currently only single-server setups are supported.');
  return normalizeHetznerServer(servers[0]);
}

async function callHetznerAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireHetznerConfig(config);
  const baseUrl = normalizeHetznerBaseUrl(config);

  const actionMap = {
    'reboot': 'reboot',
    'boot': 'poweron',
    'shutdown': 'shutdown'
  };
  const hAction = actionMap[action];
  if (!hAction) throw new Error(`Unsupported Hetzner action: ${action}`);

  const listData = await fetchHetzner(baseUrl + '/servers', config);
  const servers = listData.servers || [];
  if (servers.length === 0) throw new Error('No Hetzner servers found');

  const serverId = servers[0].id;
  return await fetchHetzner(baseUrl + `/servers/${serverId}/actions/${hAction}`, config, { method: 'POST' });
}

// ─── DigitalOcean API ──────────────────────────────────────────
// DigitalOcean: REST API, Bearer token, list /droplets

function requireDOConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('DigitalOcean configuration is incomplete. API URL and API Token are required');
  }
}

function normalizeDOBaseUrl(config) {
  let url = config.apiUrl.trim().replace(/\/$/, '');
  if (!url.includes('/v2')) url = url + '/v2';
  return url;
}

async function fetchDO(url, config, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`DigitalOcean API returned non-JSON: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = data.message || `HTTP ${response.status}`;
    throw new Error(`DigitalOcean API error: ${msg}`);
  }
  return data;
}

function normalizeDOServer(raw) {
  const statusMap = { 'active': 'online', 'off': 'offline', 'new': 'pending', 'archive': 'offline' };
  const status = statusMap[raw.status] || raw.status || 'unknown';
  const networks = raw.networks || {};
  const v4 = networks.v4 || [];
  const publicV4 = v4.find(n => n.type === 'public') || v4[0] || {};
  const image = raw.image || {};
  const memory = raw.memory || 0; // MB
  const disk = raw.disk || 0; // GB

  return {
    id: String(raw.id),
    hostname: raw.name,
    status,
    statusmsg: raw.status || 'unknown',
    vmstate: raw.status || 'unknown',
    ipaddress: publicV4.ip_address || '',
    ip: publicV4.ip_address || '',
    os: image.distribution || image.name || '',
    template: image.name || image.distribution || '',
    mem: bytesResource(undefined, memory),
    hdd: bytesResource(undefined, disk * 1024),
    bw: bytesResource(undefined, 0)
  };
}

async function getDOSingle(config) {
  requireDOConfig(config);
  const baseUrl = normalizeDOBaseUrl(config);

  const idMatch = baseUrl.match(/\/droplets\/(\d+)/);
  if (idMatch) {
    const data = await fetchDO(baseUrl, config);
    return normalizeDOServer(data.droplet || {});
  }

  const data = await fetchDO(baseUrl + '/droplets', config);
  const droplets = data.droplets || [];
  if (droplets.length === 0) throw new Error('No DigitalOcean droplets found');
  if (droplets.length > 1) throw new Error('Multiple droplets found. Currently only single-droplet setups are supported.');
  return normalizeDOServer(droplets[0]);
}

async function callDOAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireDOConfig(config);
  const baseUrl = normalizeDOBaseUrl(config);

  const actionMap = {
    'reboot': 'reboot',
    'boot': 'power_on',
    'shutdown': 'shutdown'
  };
  const doAction = actionMap[action];
  if (!doAction) throw new Error(`Unsupported DigitalOcean action: ${action}`);

  const listData = await fetchDO(baseUrl + '/droplets', config);
  const droplets = listData.droplets || [];
  if (droplets.length === 0) throw new Error('No droplets found');

  return await fetchDO(baseUrl + `/droplets/${droplets[0].id}/actions`, config, {
    method: 'POST',
    body: { type: doAction }
  });
}

// ─── AWS Lightsail API ──────────────────────────────────────────
// AWS Lightsail: JSON-RPC over HTTPS with AWS Signature V4 auth

// --- AWS SigV4 signing utilities (Web Crypto API) ---

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(key, data) {
  const enc = new TextEncoder();
  const keyData = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

async function hmacHex(key, data) {
  const sig = await hmacSign(key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmacSign('AWS4' + key, dateStamp);
  const kRegion = await hmacSign(kDate, regionName);
  const kService = await hmacSign(kRegion, serviceName);
  return hmacSign(kService, 'aws4_request');
}

async function signAWSRequest(accessKeyId, secretAccessKey, region, target, body) {
  const service = 'lightsail';
  const host = `${service}.${region}.amazonaws.com`;
  const contentType = 'application/x-amz-json-1.1';
  const amzTarget = `Lightsail_20161128.${target}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  const payloadHash = await sha256(body);

  const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    endpoint: `https://${host}/`,
    headers: {
      'Content-Type': contentType,
      'X-Amz-Date': amzDate,
      'X-Amz-Target': amzTarget,
      'Authorization': authorizationHeader
    }
  };
}

// --- Lightsail config & fetch ---

function requireLightsailConfig(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('AWS Lightsail configuration is incomplete. Region, Access Key ID, and Secret Access Key are required');
  }
}

function normalizeLightsailServer(raw) {
  const state = (raw.state && raw.state.name) || 'unknown';
  const statusMap = {
    'running': 'online',
    'pending': 'pending',
    'stopped': 'offline',
    'stopping': 'offline',
    'rebooting': 'online'
  };
  const mappedStatus = statusMap[state] || state;

  const hardware = raw.hardware || {};
  const disks = hardware.disks || [];
  const diskSizeGb = disks.length > 0 ? (disks[0].sizeInGb || 0) : 0;

  return {
    id: raw.name || raw.arn,
    hostname: raw.name,
    status: mappedStatus,
    statusmsg: state,
    vmstate: state,
    ipaddress: raw.publicIpAddress,
    ip: raw.publicIpAddress,
    os: raw.blueprintName,
    template: raw.blueprintName,
    mem: bytesResource(undefined, (hardware.ramSizeInGb || 0) * 1024),
    hdd: bytesResource(undefined, diskSizeGb * 1024),
    bw: bytesResource(undefined, 0)
  };
}

function parseAWSRegion(raw) {
  let cleaned = (raw || '').trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  const regionMatch = cleaned.match(/([a-z]{2}-[a-z]+-\d+)/i);
  if (regionMatch) {
    return regionMatch[1].toLowerCase();
  }
  return cleaned.split('/')[0].split('?')[0].toLowerCase() || 'us-east-1';
}

function parseEC2RegionAndInstance(rawUrl) {
  const region = parseAWSRegion(rawUrl);
  let targetInstanceId = null;
  let cleaned = (rawUrl || '').trim().replace(/^https?:\/\//i, '');

  const instMatch = cleaned.match(/(i-[0-9a-fA-Z]+)/);
  if (instMatch) {
    targetInstanceId = instMatch[1];
  }
  return { region, targetInstanceId };
}

async function getLightsailSingle(config) {
  requireLightsailConfig(config);
  const region = parseAWSRegion(config.apiUrl);
  const body = '{}';
  const { endpoint, headers } = await signAWSRequest(config.apiKey, config.apiHash, region, 'GetInstances', body);

  const response = await fetch(endpoint, { method: 'POST', headers, body });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`AWS Lightsail API returned non-JSON: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = data.message || data.__type || `HTTP ${response.status}`;
    throw new Error(`AWS Lightsail API error: ${msg}`);
  }

  const instances = data.instances || [];
  if (instances.length === 0) {
    throw new Error('No Lightsail instances found in this region');
  }
  if (instances.length > 1) {
    throw new Error('Multiple Lightsail instances found. Currently only single-instance accounts are supported.');
  }
  return normalizeLightsailServer(instances[0]);
}

async function callLightsailAction(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireLightsailConfig(config);
  const region = parseAWSRegion(config.apiUrl);

  const actionMap = {
    'reboot': 'RebootInstance',
    'boot': 'StartInstance',
    'shutdown': 'StopInstance'
  };
  const apiAction = actionMap[action];
  if (!apiAction) throw new Error(`Unsupported Lightsail action: ${action}`);

  // Fetch instance name first
  const listBody = '{}';
  const { endpoint: listEp, headers: listHeaders } = await signAWSRequest(config.apiKey, config.apiHash, region, 'GetInstances', listBody);
  const listResp = await fetch(listEp, { method: 'POST', headers: listHeaders, body: listBody });
  const listData = await listResp.json();
  const instances = listData.instances || [];
  if (instances.length === 0) throw new Error('No Lightsail instances found');

  const instanceName = instances[0].name;
  const actionBody = JSON.stringify({ instanceName });

  const { endpoint, headers } = await signAWSRequest(config.apiKey, config.apiHash, region, apiAction, actionBody);
  const response = await fetch(endpoint, { method: 'POST', headers, body: actionBody });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`AWS Lightsail ${action} error: ${text.substring(0, 200)}`);
    }
  }
  if (!response.ok) {
    const msg = data.message || data.__type || `HTTP ${response.status}`;
    throw new Error(`AWS Lightsail ${action} error: ${msg}`);
  }
  return data;
}

// ─── AWS EC2 API ──────────────────────────────────────────────
// EC2 uses query-based API with SigV4 over POST

async function signEC2Request(accessKeyId, secretAccessKey, region, params) {
  const service = 'ec2';
  const host = `ec2.${region}.amazonaws.com`;
  const contentType = 'application/x-www-form-urlencoded';

  const bodyParams = new URLSearchParams({ Version: '2016-11-15', ...params });
  bodyParams.sort();
  const body = bodyParams.toString();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';

  const payloadHash = await sha256(body);
  const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  return {
    endpoint: `https://${host}/`,
    headers: {
      'Content-Type': contentType,
      'X-Amz-Date': amzDate,
      'Authorization': `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    body
  };
}

async function fetchEC2WithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...options,
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeEC2Endpoint(endpoint) {
  try {
    const probeUrl = `${endpoint}?Action=DescribeRegions&Version=2016-11-15`;
    await fetchEC2WithTimeout(probeUrl, { method: 'GET' }, 5000);
    return true;
  } catch (e) {
    return false;
  }
}

function requireEC2Config(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('AWS EC2 configuration is incomplete. Region, Access Key ID, and Secret Access Key are required');
  }
}

function normalizeEC2Server(raw) {
  const state = (raw.State && raw.State.Name) || 'unknown';
  const statusMap = {
    'running': 'online',
    'pending': 'pending',
    'stopped': 'offline',
    'stopping': 'offline',
    'terminated': 'offline',
    'shutting-down': 'offline'
  };
  const mappedStatus = statusMap[state] || state;

  // Name from Tags
  const tags = raw.Tags || [];
  const nameTag = tags.find(t => t.Key === 'Name');
  const hostname = nameTag ? nameTag.Value : raw.InstanceId;

  const instanceType = raw.InstanceType || '';

  return {
    id: raw.InstanceId,
    hostname,
    status: mappedStatus,
    statusmsg: state,
    vmstate: state,
    ipaddress: raw.PublicIpAddress || '',
    ip: raw.PublicIpAddress || '',
    os: instanceType,
    template: instanceType,
    mem: bytesResource(undefined, 0),
    hdd: bytesResource(undefined, 0),
    bw: bytesResource(undefined, 0)
  };
}

// In-flight EC2 request dedup — avoid concurrent DescribeInstances
const _ec2Inflight = new Map();

async function fetchEC2(region, accessKeyId, secretAccessKey, params) {
  const cacheKey = `${region}|${params.Action || ''}|${params.InstanceId || ''}`;
  if (_ec2Inflight.has(cacheKey)) {
    console.log('[EC2] dedup — reusing in-flight request:', cacheKey);
    return await _ec2Inflight.get(cacheKey);
  }

  const promise = (async () => {
    console.log('[EC2] fetchEC2 starting for', params.Action, 'region:', region);
    const postRequest = await signEC2Request(accessKeyId, secretAccessKey, region, params);

    let response;
    try {
      response = await fetchEC2WithTimeout(postRequest.endpoint, {
        method: 'POST',
        headers: postRequest.headers,
        body: postRequest.body
      }, 10000);
    } catch (e) {
      const endpointReachable = await probeEC2Endpoint(postRequest.endpoint);
      const hint = endpointReachable
        ? 'Endpoint reachable. Check AWS credentials (Access Key / Secret Key), permissions, or region.'
        : `Endpoint unreachable (${postRequest.endpoint}). Check network, VPN/proxy, or region name (e.g. us-east-1, ap-northeast-2).`;
      throw new Error(`AWS EC2 network error: ${e.message || e}. ${hint}`);
    }
    const text = await response.text();

    if (!response.ok) {
      const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
      const msgMatch = text.match(/<Message>([^<]+)<\/Message>/);
      const code = codeMatch ? codeMatch[1] : `HTTP ${response.status}`;
      const msg = msgMatch ? msgMatch[1] : text.substring(0, 200);
      throw new Error(`AWS EC2 error: ${code} — ${msg}`);
    }

    const instances = [];
    const instSetRegex = /<instancesSet>([\s\S]*?)<\/instancesSet>/g;
    let instSetMatch;
    while ((instSetMatch = instSetRegex.exec(text)) !== null) {
      const instSetXml = instSetMatch[1];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(instSetXml)) !== null) {
        const instXml = itemMatch[1];
        const parseTag = (tag) => {
          const m = instXml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
          return m ? m[1] : '';
        };
        const stateMatch = instXml.match(/<name>([^<]+)<\/name>/);
        const tagRegex = /<item>\s*<key>Name<\/key>\s*<value>([^<]+)<\/value>\s*<\/item>/;
        const nameMatch = instXml.match(tagRegex);

        instances.push({
          InstanceId: parseTag('instanceId'),
          State: { Name: stateMatch ? stateMatch[1] : 'unknown' },
          PublicIpAddress: parseTag('ipAddress'),
          InstanceType: parseTag('instanceType'),
          Tags: nameMatch ? [{ Key: 'Name', Value: nameMatch[1] }] : []
        });
      }
    }

    return { Reservations: [{ Instances: instances }] };
  })();

  _ec2Inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    _ec2Inflight.delete(cacheKey);
  }
}
async function getEC2Single(config) {
  requireEC2Config(config);
  const { region, targetInstanceId } = parseEC2RegionAndInstance(config.apiUrl);

  const data = await fetchEC2(region, config.apiKey, config.apiHash, { Action: 'DescribeInstances' });
  const reservations = data.Reservations || [];
  const instances = reservations.flatMap(r => r.Instances || []);

  const runningInstances = instances.filter(i => {
    const state = (i.State && i.State.Name) || '';
    return state !== 'terminated';
  });

  if (runningInstances.length === 0) {
    throw new Error('No running EC2 instances found in this region');
  }

  // If user specified an instance ID, find that one
  if (targetInstanceId) {
    const match = runningInstances.find(i => i.InstanceId === targetInstanceId);
    if (!match) {
      throw new Error(`EC2 instance ${targetInstanceId} not found or not running. Available: ${runningInstances.map(i => i.InstanceId).join(', ')}`);
    }
    return normalizeEC2Server(match);
  }

  // Single instance — auto-pick
  if (runningInstances.length === 1) {
    return normalizeEC2Server(runningInstances[0]);
  }

  // Multiple instances — list them and ask user to specify
  const ids = runningInstances.map(i => i.InstanceId).join(', ');
  throw new Error(`Multiple EC2 instances found (${runningInstances.length}). Enter the instance ID in the URL: region/instance-id. Available: ${ids}`);
}

async function callEC2Action(action, configOverride) {
  const config = configOverride || await getActiveServerConfig();
  requireEC2Config(config);
  const { region, targetInstanceId } = parseEC2RegionAndInstance(config.apiUrl);

  const actionMap = {
    'reboot': 'RebootInstances',
    'boot': 'StartInstances',
    'shutdown': 'StopInstances'
  };
  const apiAction = actionMap[action];
  if (!apiAction) throw new Error(`Unsupported EC2 action: ${action}`);

  // If user specified an instance ID, use it directly
  if (targetInstanceId) {
    return await fetchEC2(region, config.apiKey, config.apiHash, {
      Action: apiAction,
      'InstanceId.1': targetInstanceId
    });
  }

  // Otherwise discover from list
  const listData = await fetchEC2(region, config.apiKey, config.apiHash, { Action: 'DescribeInstances' });
  const reservations = listData.Reservations || [];
  const instances = reservations.flatMap(r => r.Instances || []);
  const runningInstances = instances.filter(i => {
    const state = (i.State && i.State.Name) || '';
    return state !== 'terminated';
  });
  if (runningInstances.length === 0) throw new Error('No EC2 instances found');
  if (runningInstances.length > 1) throw new Error('Multiple instances found — specify instance ID in URL: region/instance-id');

  return await fetchEC2(region, config.apiKey, config.apiHash, {
    Action: apiAction,
    'InstanceId.1': runningInstances[0].InstanceId
  });
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
    solusvm2: config => getSolusVM2Server(config),
    virtfusion: config => getVirtFusionSingle(config),
    virtualizor: config => getVirtualizorSingle(config),
    proxmox: config => getProxmoxSingle(config),
    hetzner: config => getHetznerSingle(config),
    digitalocean: config => getDOSingle(config),
    lightsail: config => getLightsailSingle(config),
    ec2: config => getEC2Single(config)
  });
}

// Get server details
async function getServerInfo() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('info', { status: 'true', bw: 'true', hdd: 'true', mem: 'true', ipaddr: 'true' }, config),
    solusvm2: config => getSolusVM2Server(config),
    virtfusion: config => getVirtFusionSingle(config),
    virtualizor: config => getVirtualizorSingle(config),
    proxmox: config => getProxmoxSingle(config),
    hetzner: config => getHetznerSingle(config),
    digitalocean: config => getDOSingle(config),
    lightsail: config => getLightsailSingle(config),
    ec2: config => getEC2Single(config)
  });
}

// Get server status
async function getServerStatus() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('status', {}, config),
    solusvm2: config => getSolusVM2Server(config),
    virtfusion: config => getVirtFusionSingle(config),
    virtualizor: config => getVirtualizorSingle(config),
    proxmox: config => getProxmoxSingle(config),
    hetzner: config => getHetznerSingle(config),
    digitalocean: config => getDOSingle(config),
    lightsail: config => getLightsailSingle(config),
    ec2: config => getEC2Single(config)
  });
}

// Reboot server
async function rebootServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('reboot', {}, config),
    solusvm2: config => callSolusVM2Action('reboot', config),
    virtfusion: config => callVirtFusionAction('reboot', config),
    virtualizor: config => callVirtualizorAction('reboot', config),
    proxmox: config => callProxmoxAction('reboot', config),
    hetzner: config => callHetznerAction('reboot', config),
    digitalocean: config => callDOAction('reboot', config),
    lightsail: config => callLightsailAction('reboot', config),
    ec2: config => callEC2Action('reboot', config)
  });
}

// Boot server
async function bootServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('boot', {}, config),
    solusvm2: config => callSolusVM2Action('boot', config),
    virtfusion: config => callVirtFusionAction('boot', config),
    virtualizor: config => callVirtualizorAction('boot', config),
    proxmox: config => callProxmoxAction('boot', config),
    hetzner: config => callHetznerAction('boot', config),
    digitalocean: config => callDOAction('boot', config),
    lightsail: config => callLightsailAction('boot', config),
    ec2: config => callEC2Action('boot', config)
  });
}

// Shutdown server
async function shutdownServer() {
  return await withActivePanel({
    solusvm: config => callSolusVM1('shutdown', {}, config),
    solusvm2: config => callSolusVM2Action('shutdown', config),
    virtfusion: config => callVirtFusionAction('shutdown', config),
    virtualizor: config => callVirtualizorAction('shutdown', config),
    proxmox: config => callProxmoxAction('shutdown', config),
    hetzner: config => callHetznerAction('shutdown', config),
    digitalocean: config => callDOAction('shutdown', config),
    lightsail: config => callLightsailAction('shutdown', config),
    ec2: config => callEC2Action('shutdown', config)
  });
}

// Test the connection status of temporary configuration
async function testConnection(config) {
  const panelType = getPanelType(config);
  const handlers = {
    solusvm: () => {
      requireSolusVM1Config(config);
      return callSolusVM1('info', {}, config);
    },
    solusvm2: () => getSolusVM2Server(config),
    virtfusion: () => getVirtFusionSingle(config),
    virtualizor: () => getVirtualizorSingle(config),
    proxmox: () => getProxmoxSingle(config),
    hetzner: () => getHetznerSingle(config),
    digitalocean: () => getDOSingle(config),
    lightsail: () => getLightsailSingle(config),
    ec2: () => getEC2Single(config)
  };
  const handler = handlers[panelType];
  if (!handler) throw new Error(`Unknown panel type: ${panelType}`);
  return await handler();
}

// ─── Bulk operations ───────────────────────────────────────────

function getAllServerConfigs() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['servers'], data => {
      const list = data.servers || [];
      resolve(list);
    });
  });
}

const PANEL_HANDLERS = {
  solusvm: {
    info: config => callSolusVM1('info', { status: 'true', bw: 'true', hdd: 'true', mem: 'true', ipaddr: 'true' }, config),
    status: config => callSolusVM1('status', {}, config),
    reboot: config => callSolusVM1('reboot', {}, config),
    boot: config => callSolusVM1('boot', {}, config),
    shutdown: config => callSolusVM1('shutdown', {}, config)
  },
  solusvm2: {
    info: config => getSolusVM2Server(config),
    status: config => getSolusVM2Server(config),
    reboot: config => callSolusVM2Action('reboot', config),
    boot: config => callSolusVM2Action('boot', config),
    shutdown: config => callSolusVM2Action('shutdown', config)
  },
  virtfusion: {
    info: config => getVirtFusionSingle(config),
    status: config => getVirtFusionSingle(config),
    reboot: config => callVirtFusionAction('reboot', config),
    boot: config => callVirtFusionAction('boot', config),
    shutdown: config => callVirtFusionAction('shutdown', config)
  },
  virtualizor: {
    info: config => getVirtualizorSingle(config),
    status: config => getVirtualizorSingle(config),
    reboot: config => callVirtualizorAction('reboot', config),
    boot: config => callVirtualizorAction('boot', config),
    shutdown: config => callVirtualizorAction('shutdown', config)
  },
  proxmox: {
    info: config => getProxmoxSingle(config),
    status: config => getProxmoxSingle(config),
    reboot: config => callProxmoxAction('reboot', config),
    boot: config => callProxmoxAction('boot', config),
    shutdown: config => callProxmoxAction('shutdown', config)
  },
  hetzner: {
    info: config => getHetznerSingle(config),
    status: config => getHetznerSingle(config),
    reboot: config => callHetznerAction('reboot', config),
    boot: config => callHetznerAction('boot', config),
    shutdown: config => callHetznerAction('shutdown', config)
  },
  digitalocean: {
    info: config => getDOSingle(config),
    status: config => getDOSingle(config),
    reboot: config => callDOAction('reboot', config),
    boot: config => callDOAction('boot', config),
    shutdown: config => callDOAction('shutdown', config)
  },
  lightsail: {
    info: config => getLightsailSingle(config),
    status: config => getLightsailSingle(config),
    reboot: config => callLightsailAction('reboot', config),
    boot: config => callLightsailAction('boot', config),
    shutdown: config => callLightsailAction('shutdown', config)
  },
  ec2: {
    info: config => getEC2Single(config),
    status: config => getEC2Single(config),
    reboot: config => callEC2Action('reboot', config),
    boot: config => callEC2Action('boot', config),
    shutdown: config => callEC2Action('shutdown', config)
  }
};

async function bulkRefresh() {
  const configs = await getAllServerConfigs();
  const results = [];
  for (const cfg of configs) {
    try {
      const panel = PANEL_HANDLERS[cfg.panel_type] || PANEL_HANDLERS.solusvm;
      const data = await panel.status(cfg);
      results.push({ name: cfg.name, success: true, data });
    } catch (e) {
      results.push({ name: cfg.name, success: false, error: e.message });
    }
  }
  return results;
}

async function bulkAction(action) {
  const configs = await getAllServerConfigs();
  const results = [];
  for (const cfg of configs) {
    try {
      const panel = PANEL_HANDLERS[cfg.panel_type] || PANEL_HANDLERS.solusvm;
      await panel[action](cfg);
      results.push({ name: cfg.name, success: true });
    } catch (e) {
      results.push({ name: cfg.name, success: false, error: e.message });
    }
  }
  return results;
}

// Listen for messages from popup / options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    getStatus: getServerStatus,
    getInfo: getServerInfo,
    reboot: rebootServer,
    boot: bootServer,
    shutdown: shutdownServer,
    bulkRefresh,
    bulkReboot: () => bulkAction('reboot'),
    bulkShutdown: () => bulkAction('shutdown'),
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
