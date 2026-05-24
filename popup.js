// Popup page logic

const $ = id => document.getElementById(id);

let initStep = 'Starting...';

// Global exception handler to prevent silent freeze
window.onerror = function(message, source, lineno, colno, error) {
  const errMsg = `Error: ${message} at ${lineno}:${colno}`;
  console.error(errMsg);
  const main = document.getElementById('main');
  if (main) {
    main.innerHTML = `<div class="error">❌ ${errMsg}</div>`;
  }
};

// Global exception handler for promises to prevent silent freeze
window.onunhandledrejection = function(event) {
  const errMsg = `Promise Error: ${event.reason}`;
  console.error(errMsg);
  const main = document.getElementById('main');
  if (main) {
    main.innerHTML = `<div class="error">❌ ${errMsg}</div>`;
  }
};

// Set a timeout to warn if initialization hangs
setTimeout(() => {
  const main = $('main');
  const serverSelect = $('serverSelect');
  if (main && serverSelect && serverSelect.innerHTML.includes('Loading servers...')) {
    main.innerHTML = `<div class="error">⏳ Loading timeout. Stuck at: ${initStep}</div>`;
  }
}, 4000);

// Initialize language
function initI18n() {
  return new Promise(resolve => {
    initStep = 'Initializing language (initI18n)...';
    window.initI18n(() => {
      const btn = $('settingsBtn');
      if (btn) {
        btn.title = window.t('settings');
      }
      resolve();
    });
  });
}

const t = window.t;

// Format byte size
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

// Format SolusVM resource field (Total, Used, Free, Percent)
function formatResource(val) {
  if (!val || typeof val !== 'string') return '-';
  const parts = val.split(',');
  if (parts.length < 4) return val;
  const [total, used, free, percent] = parts;
  return `${formatSize(used)} / ${formatSize(total)} (${percent}%)`;
}

// Open settings page
const settingsBtn = $('settingsBtn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// Initialization
async function init() {
  try {
    await initI18n();
  } catch (e) {
    console.error('initI18n error:', e);
  }
  const main = $('main');
  if (!main) return;
  
  // Traditional callback mechanism for maximum compatibility
  try {
    initStep = 'Retrieving servers from storage...';
    chrome.storage.local.get(['servers', 'currentServerId', 'defaultServerId'], data => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      data = data || {};
      initStep = 'Checking servers data...';
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
        const serverSelect = $('serverSelect');
        if (serverSelect) serverSelect.innerHTML = `<option disabled selected>${t('noServers')}</option>`;
        return;
      }

      // Handle default server
      initStep = 'Handling default server...';
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
      
      // Render server dropdown selection
      initStep = 'Rendering server select dropdown...';
      const serverSelect = $('serverSelect');
      if (serverSelect) {
        serverSelect.innerHTML = data.servers.map(s => 
          `<option value="${s.id}" ${s.id === activeId ? 'selected' : ''}>${s.name}</option>`
        ).join('');
        
        // Bind switch event
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
      
      initStep = 'Refreshing server info...';
      refreshInfo();
    });
  } catch (e) {
    console.error('init storage error:', e);
  }
}

// Refresh server details
function refreshInfo(bypassCache = false) {
  const main = $('main');
  const statusBar = $('statusBar');
  if (!main || !statusBar) return;
  
  try {
    initStep = 'Getting current server ID...';
    chrome.storage.local.get(['servers', 'currentServerId'], data => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      data = data || {};
      const currentId = data.currentServerId || (data.servers && data.servers[0] ? data.servers[0].id : null);
      if (!currentId) return;

      const cacheKey = 'cache_' + currentId;
      
      if (!bypassCache) {
        initStep = 'Loading cache...';
        chrome.storage.local.get(cacheKey, cacheResult => {
          if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
          cacheResult = cacheResult || {};
          const cachedData = cacheResult[cacheKey];
          loadFreshData(currentId, cacheKey, cachedData);
        });
      } else {
        loadFreshData(currentId, cacheKey, null);
      }
    });
  } catch (e) {
    console.error('refreshInfo storage error:', e);
  }

  function loadFreshData(currentId, cacheKey, cachedData) {
    // If cache exists, render it first for instant load
    if (cachedData) {
      renderServerInfo(cachedData, cachedData);
      statusBar.style.display = 'block';
      statusBar.textContent = t('lastUpdatedCache', { time: cachedData.lastUpdated || 'Unknown' });
    } else {
      main.innerHTML = `<div class="loading">${t('loading')}</div>`;
    }

    // Fetch latest data in parallel to resolve bugs where some SolusVM panels do not include vmstate
    initStep = 'Sending API requests to background...';
    Promise.all([
      sendMessage('getStatus'),
      sendMessage('getInfo')
    ]).then(([statusRes, infoRes]) => {
      initStep = 'API response received. Rendering...';
      if (!statusRes.success) throw new Error(statusRes.error);
      if (!infoRes.success) throw new Error(infoRes.error);

      const statusData = statusRes.data;
      const infoData = infoRes.data;

      // Combine latest data
      const freshData = {
        ...infoData,
        status: statusData.status,
        statusmsg: statusData.statusmsg,
        vmstate: statusData.vmstate,
        lastUpdated: new Date().toLocaleTimeString()
      };

      // Write to cache and refresh rendering
      chrome.storage.local.set({ [cacheKey]: freshData }, () => {
        renderServerInfo(freshData, freshData);
        statusBar.style.display = 'block';
        statusBar.textContent = t('lastUpdated', { time: freshData.lastUpdated });
        initStep = 'Finished!';
      });
    }).catch(err => {
      initStep = 'Error: ' + err.message;
      if (cachedData) {
        statusBar.style.display = 'block';
        statusBar.textContent = t('updateFail', { error: err.message });
      } else {
        main.innerHTML = `<div class="error">❌ ${err.message}</div>`;
      }
    });
  }
}

// Render server details
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
  
  // Bind button click events
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

// Execute operation (Reboot/Boot/Shutdown)
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

// Send message to background service worker
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
