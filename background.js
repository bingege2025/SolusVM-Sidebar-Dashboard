/**
 * Background Service Worker
 * Handles all SolusVM API calls
 */

// Check and migrate legacy data structures
function checkAndMigrateConfig(callback) {
  chrome.storage.local.get(['apiUrl', 'apiKey', 'apiHash', 'servers'], data => {
    if (!data.servers && data.apiUrl && data.apiKey && data.apiHash) {
      const defaultServer = {
        id: 'server_' + Date.now(),
        name: 'Default Server',
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        apiHash: data.apiHash
      };
      chrome.storage.local.set({
        servers: [defaultServer],
        currentServerId: defaultServer.id
      }, () => {
        chrome.storage.local.remove(['apiUrl', 'apiKey', 'apiHash'], () => {
          if (callback) callback();
        });
      });
    } else {
      if (callback) callback();
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

// API call wrapper
async function callSolusVM(command, extraParams = {}) {
  const config = await getActiveServerConfig();
  
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('Selected server configuration is incomplete, please reconfigure in settings');
  }

  let url = config.apiUrl.trim();
  // Remove trailing slash if present
  url = url.replace(/\/$/, '');
  // Auto-complete URL if it doesn't contain /api/client/command.php
  if (!url.includes('/api/client/command.php')) {
    // Remove trailing /api or /api/ if present
    url = url.replace(/\/api$/, '');
    url = url + '/api/client/command.php';
  }

  const params = new URLSearchParams();
  params.append('key', config.apiKey);
  params.append('hash', config.apiHash);
  params.append('action', command); // SolusVM Client API action parameter
  for (const [key, value] of Object.entries(extraParams)) {
    params.append(key, value);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  const text = await response.text();
  const result = parseApiResponse(text);
  if (result.status && result.status !== 'success') {
    throw new Error(result.statusmsg || 'Operation failed');
  }
  return result;
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
  return await callSolusVM('list');
}

// Get server details
async function getServerInfo() {
  return await callSolusVM('info', { status: 'true', bw: 'true' });
}

// Get server status
async function getServerStatus() {
  return await callSolusVM('status');
}

// Reboot server
async function rebootServer() {
  return await callSolusVM('reboot');
}

// Boot server
async function bootServer() {
  return await callSolusVM('boot');
}

// Shutdown server
async function shutdownServer() {
  return await callSolusVM('shutdown');
}

// Test the connection status of temporary configuration
async function testConnection(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('Test configuration is incomplete');
  }
  let url = config.apiUrl.trim().replace(/\/$/, '');
  if (!url.includes('/api/client/command.php')) {
    url = url.replace(/\/api$/, '');
    url = url + '/api/client/command.php';
  }

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
