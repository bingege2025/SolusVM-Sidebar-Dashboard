/**
 * Background Service Worker
 * 处理所有 SolusVM API 调用
 */

// 检查并迁移旧数据结构
function checkAndMigrateConfig(callback) {
  chrome.storage.local.get(['apiUrl', 'apiKey', 'apiHash', 'servers'], data => {
    if (!data.servers && data.apiUrl && data.apiKey && data.apiHash) {
      const defaultServer = {
        id: 'server_' + Date.now(),
        name: '默认服务器',
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

// 获取当前活跃的服务器配置（通过原生 Promise 保证安全 await）
function getActiveServerConfig() {
  return new Promise((resolve, reject) => {
    checkAndMigrateConfig(() => {
      chrome.storage.local.get(['servers', 'currentServerId'], data => {
        if (!data.servers || data.servers.length === 0) {
          reject(new Error('请先在设置中配置 API 信息'));
          return;
        }
        const activeServer = data.servers.find(s => s.id === data.currentServerId) || data.servers[0];
        if (!activeServer) {
          reject(new Error('当前选中的服务器配置不完整'));
        } else {
          resolve(activeServer);
        }
      });
    });
  });
}

// API 调用封装
async function callSolusVM(command, extraParams = {}) {
  const config = await getActiveServerConfig();
  
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('当前选中的服务器配置不完整，请前往设置重新配置');
  }

  let url = config.apiUrl.trim();
  // 移除可能存在的末尾斜杠
  url = url.replace(/\/$/, '');
  // 如果不包含 /api/client/command.php，则自动补全
  if (!url.includes('/api/client/command.php')) {
    // 移除可能存在的末尾 /api 或 /api/
    url = url.replace(/\/api$/, '');
    url = url + '/api/client/command.php';
  }

  const params = new URLSearchParams();
  params.append('key', config.apiKey);
  params.append('hash', config.apiHash);
  params.append('action', command); // SolusVM Client API 参数为 action
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
    throw new Error(`API 请求失败: ${response.status}`);
  }
  
  const text = await response.text();
  const result = parseApiResponse(text);
  if (result.status && result.status !== 'success') {
    throw new Error(result.statusmsg || '操作失败');
  }
  return result;
}

// 解析 SolusVM API 返回的文本，兼容 XML 格式和 key,value 键值对格式
function parseApiResponse(text) {
  text = text.trim();
  if (text.startsWith('<')) {
    const result = {};
    // 正则提取扁平的 XML 节点（如 <hostname>vps.test.com</hostname>）
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

// 获取服务器列表
async function listServers() {
  return await callSolusVM('list');
}

// 获取服务器信息
async function getServerInfo() {
  return await callSolusVM('info', { status: 'true', bw: 'true' });
}

// 获取服务器状态
async function getServerStatus() {
  return await callSolusVM('status');
}

// 重启服务器
async function rebootServer() {
  return await callSolusVM('reboot');
}

// 开机
async function bootServer() {
  return await callSolusVM('boot');
}

// 关机
async function shutdownServer() {
  return await callSolusVM('shutdown');
}

// 测试临时配置的连接状态
async function testConnection(config) {
  if (!config || !config.apiUrl || !config.apiKey || !config.apiHash) {
    throw new Error('测试配置不完整');
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
    throw new Error(`API 连接失败: ${response.status}`);
  }

  const text = await response.text();
  const result = parseApiResponse(text);
  if (result.status && result.status !== 'success') {
    throw new Error(result.statusmsg || '连接失败');
  }
  return result;
}

// 监听来自 popup / options 的消息
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
    return true; // 异步响应
  }
});
