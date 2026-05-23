// Popup 页面逻辑

const $ = id => document.getElementById(id);

// 全局异常捕获，避免静默卡死
window.onerror = function(message, source, lineno, colno, error) {
  const errMsg = `Error: ${message} at ${lineno}:${colno}`;
  console.error(errMsg);
  const main = document.getElementById('main');
  if (main) {
    main.innerHTML = `<div class="error">❌ ${errMsg}</div>`;
  }
};

// 初始化语言（带超时保护）
function initI18n() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('initI18n timeout, using default language');
      window.currentLang = 'en';
      t = window.t;
      resolve();
    }, 3000);
    
    try {
      window.initI18n(() => {
        clearTimeout(timeout);
        const btn = $('settingsBtn');
        if (btn) {
          btn.title = window.t('settings');
        }
        resolve();
      });
    } catch (e) {
      clearTimeout(timeout);
      console.error('initI18n error:', e);
      window.currentLang = 'en';
      t = window.t;
      resolve();
    }
  });
}

// t 函数将在 initI18n 后使用 window.t
let t;

// 字节数格式化
function formatSize(bytes) {
  const val = parseFloat(bytes);
  if (isNaN(val)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = val;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(size % 1 === 0 ? 0 : 2)} ${units[idx]}`;
}

// 格式化 SolusVM 资源字段（Total,Used,Free,Percent）
function formatResource(val) {
  if (!val || typeof val !== 'string') return '-';
  const parts = val.split(',');
  if (parts.length < 4) return val;
  const [total, used, free, percent] = parts;
  return `${formatSize(used)} / ${formatSize(total)} (${percent}%)`;
}

// 打开设置页
const settingsBtn = $('settingsBtn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// 初始化
async function init() {
  try {
    await initI18n();
    // 确保 t 函数可用
    t = window.t;
  } catch (e) {
    console.error('initI18n error:', e);
    // 即使初始化失败，也尝试使用 t
    t = window.t;
  }
  const main = $('main');
  const serverSelect = $('serverSelect');
  if (!main) return;
  
  // 使用 Promise 包装存储读取，带超时保护
  const loadStorage = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('读取配置超时，请刷新页面'));
    }, 5000);
    
    try {
      chrome.storage.local.get(['servers', 'currentServerId', 'defaultServerId'], data => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(data || {});
        }
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
  
  try {
    const data = await loadStorage();
    
    if (!data.servers || data.servers.length === 0) {
      main.innerHTML = `
        <div class="no-config">
          <p>${t('noConfig')}</p>
          <p style="margin-top:8px;"><a href="#" id="goConfig">${t('goConfig')}</a></p>
        </div>`;
      const goConfig = document.getElementById('goConfig');
      if (goConfig) {
        goConfig.addEventListener('click', e => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
        });
      }
      const statusBar = $('statusBar');
      if (statusBar) statusBar.style.display = 'none';
      if (serverSelect) serverSelect.innerHTML = `<option disabled selected>${t('noServers')}</option>`;
      return;
    }

    // 处理默认服务器
    let activeId = data.currentServerId;
    if (data.defaultServerId) {
      const defaultExists = data.servers.some(s => s.id === data.defaultServerId);
      if (defaultExists) {
        activeId = data.defaultServerId;
        chrome.storage.local.set({ currentServerId: activeId });
      }
    }

    if (!activeId || !data.servers.some(s => s.id === activeId)) {
      activeId = data.servers[0].id;
      chrome.storage.local.set({ currentServerId: activeId });
    }
    
    // 渲染服务器下拉选择框
    if (serverSelect) {
      serverSelect.innerHTML = data.servers.map(s => 
        `<option value="${s.id}" ${s.id === activeId ? 'selected' : ''}>${s.name}</option>`
      ).join('');
      
      // 绑定切换事件
      if (!serverSelect.dataset.listenerBound) {
        serverSelect.addEventListener('change', e => {
          const newId = e.target.value;
          chrome.storage.local.set({ currentServerId: newId }, () => {
            refreshInfo();
          });
        });
        serverSelect.dataset.listenerBound = 'true';
      }
    }
    
    refreshInfo();
  } catch (e) {
    console.error('init storage error:', e);
    main.innerHTML = `<div class="error">❌ ${e.message || '加载失败，请刷新重试'}</div>`;
    if (serverSelect) serverSelect.innerHTML = `<option disabled selected>加载失败</option>`;
  }
}

// 刷新服务器信息
function refreshInfo(bypassCache = false) {
  const main = $('main');
  const statusBar = $('statusBar');
  if (!main || !statusBar) return;

  // 包装存储读取为 Promise，带超时
  const loadStorage = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('读取配置超时'));
    }, 5000);
    
    try {
      chrome.storage.local.get(['servers', 'currentServerId'], data => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(data || {});
        }
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });

  loadStorage().then(data => {
    const currentId = data.currentServerId || (data.servers && data.servers[0] ? data.servers[0].id : null);
    if (!currentId) {
      main.innerHTML = `<div class="error">❌ 未找到服务器配置</div>`;
      return;
    }

    const cacheKey = 'cache_' + currentId;
    
    if (!bypassCache) {
      // 读取缓存
      chrome.storage.local.get(cacheKey, cacheResult => {
        const cachedData = cacheResult && cacheResult[cacheKey];
        loadFreshData(currentId, cacheKey, cachedData);
      });
    } else {
      loadFreshData(currentId, cacheKey, null);
    }
  }).catch(err => {
    console.error('refreshInfo error:', err);
    main.innerHTML = `<div class="error">❌ ${err.message}</div>`;
  });

  function loadFreshData(currentId, cacheKey, cachedData) {
    // 如果有缓存，先渲染缓存以秒开
    if (cachedData) {
      renderServerInfo(cachedData, cachedData);
      statusBar.style.display = 'block';
      statusBar.textContent = t('lastUpdatedCache', { time: cachedData.lastUpdated || '未知' });
    } else {
      main.innerHTML = `<div class="loading">${t('loading')}</div>`;
    }

    // 并行拉取最新数据，解决某些 SolusVM 不包含 vmstate 的 Bug
    Promise.all([
      sendMessage('getStatus'),
      sendMessage('getInfo')
    ]).then(([statusRes, infoRes]) => {
      if (!statusRes.success) throw new Error(statusRes.error);
      if (!infoRes.success) throw new Error(infoRes.error);

      const statusData = statusRes.data;
      const infoData = infoRes.data;

      // 拼合最新数据
      const freshData = {
        ...infoData,
        status: statusData.status,
        statusmsg: statusData.statusmsg,
        vmstate: statusData.vmstate,
        lastUpdated: new Date().toLocaleTimeString('zh-CN')
      };

      // 写入缓存并刷新渲染
      chrome.storage.local.set({ [cacheKey]: freshData }, () => {
        renderServerInfo(freshData, freshData);
        statusBar.style.display = 'block';
        statusBar.textContent = t('lastUpdated', { time: freshData.lastUpdated });
      });
    }).catch(err => {
      if (cachedData) {
        statusBar.style.display = 'block';
        statusBar.textContent = t('updateFail', { error: err.message });
      } else {
        main.innerHTML = `<div class="error">❌ ${err.message}</div>`;
      }
    });
  }
}

// 渲染服务器信息
function renderServerInfo(status, info) {
  const main = $('main');
  if (!main) return;
  const isOnline = status.statusmsg === 'online' || status.vmstate === 'online' || status.status === 'online' || status.vmstate === 'running';
  
  main.innerHTML = `
    <div class="content">
      <div class="info-grid">
        <span class="label">${t('hostname')}</span>
        <span class="value">${info.hostname || '-'}</span>
        <span class="label">${t('status')}</span>
        <span class="value"><span class="status-badge ${isOnline ? 'online' : 'offline'}">${isOnline ? t('online') : t('offline')}</span></span>
        <span class="label">${t('ip')}</span>
        <span class="value">${info.ipaddress || status.ip || '-'}</span>
        <span class="label">${t('os')}</span>
        <span class="value">${info.os || '-'}</span>
        <span class="label">${t('mem')}</span>
        <span class="value">${formatResource(info.mem)}</span>
        <span class="label">${t('hdd')}</span>
        <span class="value">${formatResource(info.hdd)}</span>
        <span class="label">${t('bw')}</span>
        <span class="value">${formatResource(info.bw)}</span>
      </div>
      <div class="actions">
        <button class="btn-refresh" id="refreshBtn">${t('btnRefresh')}</button>
        <button class="btn-reboot" id="rebootBtn">${t('btnReboot')}</button>
        ${isOnline ? 
          `<button class="btn-shutdown" id="shutdownBtn">${t('btnShutdown')}</button>` :
          `<button class="btn-boot" id="bootBtn">${t('btnBoot')}</button>`
        }
      </div>
    </div>`;
  
  // 绑定按钮事件
  const refreshBtn = $('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => refreshInfo(true));
  
  const rebootBtn = $('rebootBtn');
  if (rebootBtn) rebootBtn.addEventListener('click', () => doAction('reboot', t('reboot')));
  
  if (isOnline) {
    const shutdownBtn = $('shutdownBtn');
    if (shutdownBtn) shutdownBtn.addEventListener('click', () => doAction('shutdown', t('shutdown')));
  } else {
    const bootBtn = $('bootBtn');
    if (bootBtn) bootBtn.addEventListener('click', () => doAction('boot', t('boot')));
  }
}

// 执行操作（重启/开机/关机）
async function doAction(action, label) {
  const main = $('main');
  if (!main) return;
  main.innerHTML = `<div class="loading">${t('loadingAction', { action: label })}</div>`;
  
  const res = await sendMessage(action);
  if (res.success) {
    main.innerHTML = `<div class="loading">${t('sentAction', { action: label })}</div>`;
    await new Promise(r => setTimeout(r, 5000));
    await refreshInfo(true);
  } else {
    main.innerHTML = `<div class="error">${t('actionFail', { action: label, error: res.error })}</div>`;
  }
}

// 发送消息到 background
function sendMessage(action) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ action }, response => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else if (!response) {
          resolve({ success: false, error: 'No response from background script' });
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

init();
