// Popup page logic — fully synchronous init, no async/await

const $ = id => document.getElementById(id);
let privacyModeEnabled = false;

// Global exception handlers
window.onerror = function(message, source, lineno, colno, error) {
  console.error(`Error: ${message} at ${lineno}:${colno}`);
  const main = document.getElementById('main');
  if (main) main.innerHTML = `<div class="error">❌ ${message}</div>`;
};
window.onunhandledrejection = function(event) {
  console.error('Promise Error:', event.reason);
  const main = document.getElementById('main');
  if (main) main.innerHTML = `<div class="error">❌ ${event.reason}</div>`;
};

// ---- Utility functions ----

function formatSize(bytes) {
  const val = parseFloat(bytes);
  if (isNaN(val)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = val, idx = 0;
  while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx++; }
  return `${size.toFixed(size % 1 === 0 ? 0 : 2)} ${units[idx]}`;
}

function formatResource(val) {
  if (!val || typeof val !== 'string') return 'N/A';
  const parts = val.split(',');
  if (parts.length < 4) return val;
  const [a, b, c, d] = parts;
  const va = parseFloat(a);
  const vb = parseFloat(b);
  const vc = parseFloat(c);
  const totalVal = Math.max(va, vb, vc);
  const usedVal = Math.min(va, vb, vc);
  const percent = d;
  if (isNaN(totalVal) || totalVal === 0) return 'N/A';
  if (usedVal === 0) {
    return formatSize(totalVal);
  }
  return `${formatSize(usedVal)} / ${formatSize(totalVal)} (${percent}%)`;
}

// Send message to background service worker (Promise-based, with safety net)
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

// Safe storage.local.get with timeout fallback
function safeStorageGet(keys, callback, timeoutMs) {
  timeoutMs = timeoutMs || 2000;
  let fired = false;
  const timer = setTimeout(() => {
    if (!fired) {
      fired = true;
      console.warn('chrome.storage.local.get timed out for keys:', keys);
      callback(null);
    }
  }, timeoutMs);

  try {
    chrome.storage.local.get(keys, data => {
      clearTimeout(timer);
      if (!fired) {
        fired = true;
        if (chrome.runtime.lastError) {
          console.error('storage.get error:', chrome.runtime.lastError);
          callback(null);
        } else {
          callback(data || {});
        }
      }
    });
  } catch (e) {
    clearTimeout(timer);
    if (!fired) {
      fired = true;
      console.error('storage.get exception:', e);
      callback(null);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
}

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

function normalizeServers(list) {
  return (Array.isArray(list) ? list : []).map(server => ({
    ...server,
    tags: normalizeTagList(server.tags)
  }));
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

function updatePrivacyToggle() {
  const btn = $('privacyToggle');
  if (!btn) return;
  btn.classList.toggle('active', privacyModeEnabled);
  btn.setAttribute('aria-pressed', String(privacyModeEnabled));
  btn.title = privacyModeEnabled ? 'Privacy mode on' : 'Privacy mode off';
}

function applyPrivacyMode() {
  document.querySelectorAll('.privacy-field').forEach(el => {
    el.classList.toggle('blur-text', privacyModeEnabled);
  });
  updatePrivacyToggle();
}

function setPrivacyMode(enabled, persist) {
  privacyModeEnabled = Boolean(enabled);
  applyPrivacyMode();
  if (persist) {
    chrome.storage.local.set({ privacyModeEnabled });
  }
}

// ---- UI binding ----

const settingsBtn = $('settingsBtn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// ---- Feedback section binding ----

const GITHUB_ISSUES_URL = 'https://github.com/bingege2025/SolusVM-Sidebar-Dashboard/issues';
const FORUM_URL = 'https://lowendtalk.com/discussion/217453/idea-discussion-a-minimalist-chrome-sidepanel-dashboard-for-managing-multi-solusvm-racknerd-apis#latest';
const DEV_EMAIL = 'renyanbin.wang@gmail.com';

function initFeedbackSection() {
  const t = window.t;
  const feedbackBugText = $('feedbackBugText');
  const feedbackForumText = $('feedbackForumText');
  const feedbackEmailText = $('feedbackEmailText');
  if (feedbackBugText) feedbackBugText.textContent = t('feedbackBug');
  if (feedbackForumText) feedbackForumText.textContent = t('feedbackForum');
  if (feedbackEmailText) feedbackEmailText.textContent = t('feedbackEmail');
}

// 绑定反馈按钮点击事件
const feedbackBugBtn = $('feedbackBugBtn');
if (feedbackBugBtn) {
  feedbackBugBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: GITHUB_ISSUES_URL });
  });
}

const feedbackForumBtn = $('feedbackForumBtn');
if (feedbackForumBtn) {
  feedbackForumBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: FORUM_URL });
  });
}

const feedbackEmailBtn = $('feedbackEmailBtn');
if (feedbackEmailBtn) {
  feedbackEmailBtn.addEventListener('click', e => {
    e.preventDefault();
    const version = chrome.runtime.getManifest().version;
    const subject = encodeURIComponent(`SolusVM Extension v${version} - Feedback`);
    const body = encodeURIComponent(`\n\n---\nExtension Version: v${version}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`);
    chrome.tabs.create({ url: `mailto:${DEV_EMAIL}?subject=${subject}&body=${body}` });
  });
}

// ---- Main initialization (fully synchronous, no await) ----

(function init() {
  const main = $('main');
  const statusBar = $('statusBar');
  if (!main) return;

  // Step 1: Fire-and-forget language init (do NOT block on it)
  // window.t() already works with the default 'en' set in i18n.js
  if (typeof window.initI18n === 'function') {
    window.initI18n(() => {
      // Update settings button title once language is loaded
      if (settingsBtn) settingsBtn.title = window.t('settings');
      // 更新反馈区域国际化文本
      initFeedbackSection();
    });
  }

  // We can use t() immediately because currentLang defaults to 'en'
  // and the dictionary is loaded synchronously via i18n.js
  const t = window.t;

  // Step 2: Load servers from storage (with timeout protection)
  safeStorageGet(['servers', 'currentServerId', 'defaultServerId', 'tags', 'privacyModeEnabled'], data => {
    if (!data) {
      // Storage timed out or errored — show retry prompt
      main.innerHTML = `
        <div class="error">
          ⚠️ Unable to read storage. 
          <a href="#" id="retryLink" style="color:#4a90d9;">Retry</a>
        </div>`;
      const retryLink = $('retryLink');
      if (retryLink) retryLink.addEventListener('click', e => { e.preventDefault(); init(); });
      return;
    }

    data.servers = normalizeServers(data.servers);
    privacyModeEnabled = Boolean(data.privacyModeEnabled);
    const allTags = getAllTagsFromServers(data.servers);
    if (JSON.stringify(data.tags || []) !== JSON.stringify(allTags)) {
      chrome.storage.local.set({ servers: data.servers, tags: allTags });
    }

    if (!data.servers || data.servers.length === 0) {
      main.innerHTML = `
        <div class="no-config">
          <p>${t('noConfig')}</p>
          <p style="margin-top:8px;"><a href="#" id="goConfig">${t('goConfig')}</a></p>
        </div>`;
      const goConfig = $('goConfig');
      if (goConfig) goConfig.addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
      if (statusBar) statusBar.style.display = 'none';
      const selectedName = $('selectedServerName');
      if (selectedName) selectedName.textContent = t('noServers');
      return;
    }

    // Determine active server
    let activeId = data.currentServerId;
    if (data.defaultServerId && data.servers.some(s => s.id === data.defaultServerId)) {
      activeId = data.defaultServerId;
      chrome.storage.local.set({ currentServerId: activeId });
    }
    if (!activeId || !data.servers.some(s => s.id === activeId)) {
      activeId = data.servers[0].id;
      chrome.storage.local.set({ currentServerId: activeId });
    }

    // Render custom searchable dropdown
    const customSelect = $('customSelect');
    const selectTrigger = $('selectTrigger');
    const selectedServerName = $('selectedServerName');
    const selectDropdown = $('selectDropdown');
    const serverSearchInput = $('serverSearchInput');
    const privacyToggle = $('privacyToggle');
    const tagFilter = $('tagFilter');
    const selectOptions = $('selectOptions');

    if (customSelect && selectTrigger && selectedServerName && selectDropdown && serverSearchInput && selectOptions) {
      serverSearchInput.placeholder = t('searchPlaceholder') || 'Search servers...';
      let activeTag = '';

      const renderTagFilter = () => {
        if (!tagFilter) return;
        const tagsMarkup = [
          `<button type="button" class="tag-pill ${activeTag === '' ? 'active' : ''}" data-tag="">${escapeHtml(t('allTags') || 'All')}</button>`,
          ...allTags.map(tag => (
            `<button type="button" class="tag-pill ${tag.toLowerCase() === activeTag.toLowerCase() ? 'active' : ''}" data-tag="${escapeHtml(tag)}" title="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
          ))
        ].join('');

        tagFilter.innerHTML = tagsMarkup;
        tagFilter.querySelectorAll('.tag-pill').forEach(pill => {
          pill.addEventListener('click', e => {
            e.stopPropagation();
            activeTag = pill.dataset.tag || '';
            renderTagFilter();
            renderOptions(serverSearchInput.value);
          });
        });
      };
      
      const renderOptions = (query) => {
        const normalizedQuery = query.trim().toLowerCase();
        const normalizedTag = activeTag.toLowerCase();
        const filtered = data.servers.filter(s => {
          const searchableText = [
            s.name,
            s.apiUrl,
            s.apiKey,
            ...(s.tags || [])
          ].filter(Boolean).join(' ').toLowerCase();
          const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
          const matchesTag = !normalizedTag || (s.tags || []).some(tag => tag.toLowerCase() === normalizedTag);
          return matchesSearch && matchesTag;
        });
        if (filtered.length === 0) {
          selectOptions.innerHTML = `<div class="select-option no-results">${t('noTagMatches') || t('noServers')}</div>`;
          return;
        }
        selectOptions.innerHTML = filtered.map(s => 
          `<div class="select-option ${s.id === activeId ? 'selected' : ''}" data-id="${escapeHtml(s.id)}">${escapeHtml(s.name)}</div>`
        ).join('');

        const optionNodes = selectOptions.querySelectorAll('.select-option:not(.no-results)');
        optionNodes.forEach(node => {
          node.addEventListener('click', e => {
            const newId = node.getAttribute('data-id');
            activeId = newId;
            chrome.storage.local.set({ currentServerId: newId }, () => {
              customSelect.classList.remove('open');
              selectDropdown.style.display = 'none';
              serverSearchInput.value = '';
              const activeServer = data.servers.find(s => s.id === activeId);
              selectedServerName.textContent = activeServer ? activeServer.name : (t('noServers'));
              refreshInfo(t, main, statusBar);
            });
          });
        });
      };

      const activeServer = data.servers.find(s => s.id === activeId);
      selectedServerName.textContent = activeServer ? activeServer.name : (t('noServers'));
      renderTagFilter();
      renderOptions('');

      if (!selectTrigger.dataset.listenerBound) {
        selectTrigger.addEventListener('click', e => {
          e.stopPropagation();
          const isOpen = customSelect.classList.contains('open');
          if (isOpen) {
            customSelect.classList.remove('open');
            selectDropdown.style.display = 'none';
          } else {
            customSelect.classList.add('open');
            selectDropdown.style.display = 'block';
            serverSearchInput.focus();
            serverSearchInput.select();
          }
        });
        selectTrigger.dataset.listenerBound = 'true';
      }

      if (!serverSearchInput.dataset.listenerBound) {
        serverSearchInput.addEventListener('input', e => {
          renderOptions(e.target.value);
        });
        serverSearchInput.addEventListener('click', e => e.stopPropagation());
        serverSearchInput.dataset.listenerBound = 'true';
      }

      if (privacyToggle && !privacyToggle.dataset.listenerBound) {
        privacyToggle.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          setPrivacyMode(!privacyModeEnabled, true);
        });
        privacyToggle.dataset.listenerBound = 'true';
      }

      applyPrivacyMode();

      if (!window.clickOutsideListenerBound) {
        document.addEventListener('click', () => {
          customSelect.classList.remove('open');
          selectDropdown.style.display = 'none';
          serverSearchInput.value = '';
          renderOptions('');
        });
        window.clickOutsideListenerBound = true;
      }
    }

    refreshInfo(t, main, statusBar);
  }, 2000);
})();

// ---- Refresh server info ----

function refreshInfo(t, main, statusBar, bypassCache) {
  t = t || window.t;
  main = main || $('main');
  statusBar = statusBar || $('statusBar');
  if (!main || !statusBar) return;

  safeStorageGet(['servers', 'currentServerId'], data => {
    if (!data) return;
    const currentId = data.currentServerId || (data.servers && data.servers[0] ? data.servers[0].id : null);
    if (!currentId) return;

    const cacheKey = 'cache_' + currentId;

    if (!bypassCache) {
      safeStorageGet(cacheKey, cacheData => {
        const cached = cacheData ? cacheData[cacheKey] : null;
        loadFresh(currentId, cacheKey, cached, t, main, statusBar);
      }, 1000);
    } else {
      loadFresh(currentId, cacheKey, null, t, main, statusBar);
    }
  }, 1500);
}

function loadFresh(currentId, cacheKey, cachedData, t, main, statusBar) {
  if (cachedData) {
    renderServerInfo(cachedData, cachedData, t, main);
    statusBar.style.display = 'block';
    statusBar.textContent = t('lastUpdatedCache', { time: cachedData.lastUpdated || 'Unknown' });
  } else {
    main.innerHTML = `<div class="loading">${t('loading')}</div>`;
  }

  Promise.all([
    sendMessage('getStatus'),
    sendMessage('getInfo')
  ]).then(([statusRes, infoRes]) => {
    if (!statusRes.success) throw new Error(statusRes.error);
    if (!infoRes.success) throw new Error(infoRes.error);

    const freshData = {
      ...infoRes.data,
      status: statusRes.data.status,
      statusmsg: statusRes.data.statusmsg,
      vmstate: statusRes.data.vmstate,
      lastUpdated: new Date().toLocaleTimeString()
    };

    chrome.storage.local.set({ [cacheKey]: freshData }, () => {
      renderServerInfo(freshData, freshData, t, main);
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

// ---- Render server info ----

function renderServerInfo(status, info, t, main) {
  t = t || window.t;
  main = main || $('main');
  if (!main) return;
  console.log('[DEBUG] renderServerInfo: status =', status, 'info =', info);
  const isOnline = status.statusmsg === 'online' || status.vmstate === 'online' || status.status === 'online' || status.vmstate === 'running';

  main.innerHTML = `
    <div class="content">
      <div class="info-grid">
        <span class="label">${t('hostname')}</span>
        <span class="value privacy-field">${escapeHtml(info.hostname || '-')}</span>
        <span class="label">${t('status')}</span>
        <span class="value"><span class="status-badge ${isOnline ? 'online' : 'offline'}">${isOnline ? t('online') : t('offline')}</span></span>
        <span class="label">${t('ip')}</span>
        <span class="value privacy-field">${escapeHtml(info.ipaddress || status.ip || '-')}</span>
        <span class="label">${t('os')}</span>
        <span class="value">${escapeHtml(info.os || info.template || '-')}</span>
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
        ${isOnline
          ? `<button class="btn-shutdown" id="shutdownBtn">${t('btnShutdown')}</button>`
          : `<button class="btn-boot" id="bootBtn">${t('btnBoot')}</button>`
        }
      </div>
    </div>`;

  applyPrivacyMode();

  $('refreshBtn').addEventListener('click', () => refreshInfo(t, main, $('statusBar'), true));
  $('rebootBtn').addEventListener('click', () => doAction('reboot', t('reboot'), t, main));
  if (isOnline) {
    const btn = $('shutdownBtn');
    if (btn) btn.addEventListener('click', () => doAction('shutdown', t('shutdown'), t, main));
  } else {
    const btn = $('bootBtn');
    if (btn) btn.addEventListener('click', () => doAction('boot', t('boot'), t, main));
  }
}

// ---- Execute operation ----

function doAction(action, label, t, main) {
  t = t || window.t;
  main = main || $('main');
  if (!main) return;
  main.innerHTML = `<div class="loading">${t('loadingAction', { action: label })}</div>`;

  sendMessage(action).then(res => {
    if (res.success) {
      main.innerHTML = `<div class="loading">${t('sentAction', { action: label })}</div>`;
      setTimeout(() => refreshInfo(t, main, $('statusBar'), true), 5000);
    } else {
      main.innerHTML = `<div class="error">${t('actionFail', { action: label, error: res.error })}</div>`;
    }
  });
}
