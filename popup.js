// Popup page logic — fully synchronous init, no async/await

const $ = id => document.getElementById(id);
let privacyModeEnabled = false;
let darkModeEnabled = false;

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
          const errMsg = chrome.runtime.lastError.message;
          if (errMsg.includes('context invalidated')) {
            console.warn('Extension context invalidated, reloading...');
            location.reload();
            return;
          }
          resolve({ success: false, error: errMsg });
        } else if (!response) {
          resolve({ success: false, error: window.t('noResponse') });
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      if (e.message.includes('context invalidated')) {
        console.warn('Extension context invalidated, reloading...');
        location.reload();
        return;
      }
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
          const errMsg = chrome.runtime.lastError.message;
          if (errMsg.includes('context invalidated')) {
            console.warn('Extension context invalidated in storage.get, reloading...');
            location.reload();
            return;
          }
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
      if (e.message.includes('context invalidated')) {
        console.warn('Extension context invalidated in storage.get, reloading...');
        location.reload();
        return;
      }
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

// normalizeTagList, normalizeServers, getAllTagsFromServers → shared.js

function updatePrivacyToggle() {
  const btn = $('privacyToggle');
  if (!btn) return;
  btn.classList.toggle('active', privacyModeEnabled);
  btn.setAttribute('aria-pressed', String(privacyModeEnabled));
  btn.title = privacyModeEnabled ? window.t('privacyOn') : window.t('privacyOff');
  btn.setAttribute('aria-label', window.t('togglePrivacy'));
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

function updateThemeToggle() {
  const btn = $('themeToggle');
  if (!btn) return;
  btn.textContent = darkModeEnabled ? '☀' : '☾';
  btn.title = darkModeEnabled ? window.t('lightMode') : window.t('darkMode');
  btn.setAttribute('aria-label', btn.title);
}

function applyTheme() {
  document.body.classList.toggle('dark', darkModeEnabled);
  updateThemeToggle();
}

function setDarkMode(enabled, persist) {
  darkModeEnabled = Boolean(enabled);
  applyTheme();
  if (persist) {
    chrome.storage.local.set({ darkModeEnabled });
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

const themeToggle = $('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', e => {
    e.preventDefault();
    setDarkMode(!darkModeEnabled, true);
  });
}

// ---- Feedback section binding ----

const GITHUB_ISSUES_URL = 'https://github.com/bingege2025/SolusVM-Sidebar-Dashboard/issues';
const GITHUB_NEW_ISSUE_URL = 'https://github.com/bingege2025/SolusVM-Sidebar-Dashboard/issues/new';
const FORUM_URL = 'https://lowendtalk.com/discussion/217453/idea-discussion-a-minimalist-chrome-sidepanel-dashboard-for-managing-multi-solusvm-racknerd-apis#latest';
const DEV_EMAIL = 'renyanbin.wang@gmail.com';

function buildIssueUrl() {
  const version = chrome.runtime.getManifest().version;
  const title = '[Feedback] ';
  const body = [
    'What happened?',
    '',
    '',
    'Provider / panel:',
    '- Provider:',
    'Panel type: (auto-detected)',
    '',
    'Extension:',
    `- Version: ${version}`,
    `- Language: ${window.currentLang || 'en'}`,
    '',
    'Please do not include API keys, API hashes, tokens, IP addresses, hostnames, or other sensitive information.'
  ].join('\n');

  return `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function initFeedbackSection() {
  const t = window.t;
  const feedbackBugText = $('feedbackBugText');
  const feedbackForumText = $('feedbackForumText');
  const feedbackEmailText = $('feedbackEmailText');
  const feedbackBugBtn = $('feedbackBugBtn');
  const feedbackForumBtn = $('feedbackForumBtn');
  const feedbackEmailBtn = $('feedbackEmailBtn');
  if (feedbackBugText) feedbackBugText.textContent = t('feedbackBug');
  if (feedbackForumText) feedbackForumText.textContent = t('feedbackForum');
  if (feedbackEmailText) feedbackEmailText.textContent = t('feedbackEmail');
  // 更新反馈链接的 title 属性
  if (feedbackBugBtn) feedbackBugBtn.title = t('feedbackBugTitle');
  if (feedbackForumBtn) feedbackForumBtn.title = t('feedbackForumTitle');
  if (feedbackEmailBtn) feedbackEmailBtn.title = t('feedbackEmailTitle');
}

// 绑定反馈按钮点击事件
const feedbackBugBtn = $('feedbackBugBtn');
if (feedbackBugBtn) {
  feedbackBugBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: buildIssueUrl() });
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
    const subject = encodeURIComponent(`VPS Dashboard v${version} - Feedback`);
    const body = encodeURIComponent(`\n\n---\nExtension Version: v${version}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`);
    chrome.tabs.create({ url: `mailto:${DEV_EMAIL}?subject=${subject}&body=${body}` });
  });
}

// ---- Main initialization (fully synchronous, no await) ----

(function init() {
  const main = $('main');
  const statusBar = $('statusBar');
  if (!main) return;

  const t = window.t;

  // 将 lang 与其他数据一起读取，确保渲染前语言已就绪
  safeStorageGet(['servers', 'currentServerId', 'defaultServerId', 'tags', 'privacyModeEnabled', 'darkModeEnabled', 'apiUrl', 'apiKey', 'apiHash', 'lang'], data => {
    if (!data) {
      // Storage timed out or errored — show retry prompt
      main.innerHTML = `
        <div class="error">
          ${t('storageError')} 
          <a href="#" id="retryLink" style="color:#4a90d9;">${t('retry')}</a>
        </div>`;
      const retryLink = $('retryLink');
      if (retryLink) retryLink.addEventListener('click', e => { e.preventDefault(); init(); });
      return;
    }

    // 第一时间设置语言，确保后续所有 t() 调用使用正确的语言
    window.currentLang = data.lang || 'en';
    darkModeEnabled = Boolean(data.darkModeEnabled);
    applyTheme();

    // 更新所有静态 UI 文本
    if (settingsBtn) settingsBtn.title = t('settings');
    const searchInput = $('serverSearchInput');
    if (searchInput) searchInput.placeholder = t('searchPlaceholder');
    updatePrivacyToggle();
    initFeedbackSection();
    // 更新页面标题
    document.title = t('popupTitle') || 'VPS Dashboard';

    let list = data.servers || [];
    // Smooth compatibility migration from legacy flat keys
    if (list.length === 0 && data.apiUrl && data.apiKey && data.apiHash) {
      const oldServer = {
        id: 'server_' + Date.now(),
        name: 'Default Server',
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        apiHash: data.apiHash,
        panel_type: 'solusvm',
        tags: []
      };
      list = [oldServer];
      data.currentServerId = oldServer.id;
      chrome.storage.local.set({
        servers: list,
        currentServerId: oldServer.id,
        tags: []
      }, () => {
        chrome.storage.local.remove(['apiUrl', 'apiKey', 'apiHash']);
      });
    }

    const normalizedServers = normalizeServers(list);
    privacyModeEnabled = Boolean(data.privacyModeEnabled);
    const allTags = getAllTagsFromServers(normalizedServers);
    
    const serversChanged = JSON.stringify(data.servers) !== JSON.stringify(normalizedServers);
    const tagsChanged = JSON.stringify(data.tags || []) !== JSON.stringify(allTags);
    if (serversChanged || tagsChanged) {
      chrome.storage.local.set({ servers: normalizedServers, tags: allTags });
    }

    data.servers = normalizedServers;

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

  // Single call — getStatus and getInfo return same data for all panels
  sendMessage('getInfo').then(infoRes => {
    if (!infoRes.success) throw new Error(infoRes.error);

    const freshData = {
      ...infoRes.data,
      status: infoRes.data.status,
      statusmsg: infoRes.data.statusmsg,
      vmstat: infoRes.data.vmstat,
      vmstate: infoRes.data.vmstate,
      state: infoRes.data.state,
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

  const candidates = [
    status.vmstat,
    info.vmstat,
    status.statusmsg,
    info.statusmsg,
    status.vmstate,
    info.vmstate,
    status.state,
    info.state
  ].filter(v => v && typeof v === 'string' && v.toLowerCase() !== 'success');

  const isOnline = candidates.some(val => {
    const v = String(val).toLowerCase();
    return v.includes('online') || v.includes('running') || v.includes('active') || v.includes('started') || v.includes('booted') || v === 'up';
  });

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
      <div class="bulk-bar">
        <button id="bulkRefreshBtn">🔄 ${t('bulkRefresh')}</button>
        <button class="bulk-reboot" id="bulkRebootBtn">🔁 ${t('bulkReboot')}</button>
        <button class="bulk-shutdown" id="bulkShutdownBtn">⏹ ${t('bulkShutdown')}</button>
      </div>
      <div class="bulk-result" id="bulkResultHost"></div>
      <div id="confirmPanelHost"></div>
    </div>`;

  applyPrivacyMode();

  const hostname = info.hostname || '-';

  $('refreshBtn').addEventListener('click', () => refreshInfo(t, main, $('statusBar'), true));
  $('rebootBtn').addEventListener('click', () => {
    showInlineConfirm({
      message: t('confirmReboot', { hostname }),
      actionLabel: t('btnReboot'),
      danger: false,
      onConfirm: () => doAction('reboot', t('reboot'), t, main)
    });
  });
  if (isOnline) {
    const btn = $('shutdownBtn');
    if (btn) btn.addEventListener('click', () => {
      showInlineConfirm({
        message: t('confirmShutdown', { hostname }),
        actionLabel: t('btnShutdown'),
        danger: true,
        onConfirm: () => doAction('shutdown', t('shutdown'), t, main)
      });
    });
  } else {
    const btn = $('bootBtn');
    if (btn) btn.addEventListener('click', () => doAction('boot', t('boot'), t, main));
  }

  // Bulk action buttons
  const bulkRefreshBtn = $('bulkRefreshBtn');
  if (bulkRefreshBtn) bulkRefreshBtn.addEventListener('click', () => doBulkAction('bulkRefresh', t('bulkRefresh'), t, main));
  const bulkRebootBtn = $('bulkRebootBtn');
  if (bulkRebootBtn) bulkRebootBtn.addEventListener('click', () => {
    showInlineConfirm({
      message: t('confirmBulkReboot'),
      actionLabel: t('bulkReboot'),
      danger: false,
      onConfirm: () => doBulkAction('bulkReboot', t('bulkReboot'), t, main)
    });
  });
  const bulkShutdownBtn = $('bulkShutdownBtn');
  if (bulkShutdownBtn) bulkShutdownBtn.addEventListener('click', () => {
    showInlineConfirm({
      message: t('confirmBulkShutdown'),
      actionLabel: t('bulkShutdown'),
      danger: true,
      onConfirm: () => doBulkAction('bulkShutdown', t('bulkShutdown'), t, main)
    });
  });
}

function showInlineConfirm({ message, actionLabel, danger, onConfirm }) {
  const host = $('confirmPanelHost');
  if (!host) return;
  host.innerHTML = `
    <div class="confirm-panel ${danger ? 'danger' : ''}">
      <div class="confirm-message">${escapeHtml(message)}</div>
      <div class="confirm-actions">
        <button type="button" class="btn-confirm-cancel" id="confirmCancelBtn">${escapeHtml(window.t('btnCancel'))}</button>
        <button type="button" class="btn-confirm-action ${danger ? 'danger' : ''}" id="confirmActionBtn">${escapeHtml(actionLabel)}</button>
      </div>
    </div>`;

  const cancelBtn = $('confirmCancelBtn');
  const actionBtn = $('confirmActionBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      host.innerHTML = '';
    });
  }
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      host.innerHTML = '';
      onConfirm();
    });
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

// ---- Bulk operations ----

function doBulkAction(action, label, t, main) {
  t = t || window.t;
  main = main || $('main');
  const resultHost = $('bulkResultHost');
  if (resultHost) resultHost.innerHTML = `<span style="color:#999;">⏳ ${label}...</span>`;

  sendMessage(action).then(res => {
    if (!res.success) {
      if (resultHost) resultHost.innerHTML = `<span class="err">❌ ${res.error}</span>`;
      return;
    }
    const results = res.data || [];
    const okCount = results.filter(r => r.success).length;
    const errCount = results.filter(r => !r.success).length;

    let html = '';
    results.forEach(r => {
      html += r.success
        ? `<div class="ok">✅ ${escapeHtml(r.name)}</div>`
        : `<div class="err">❌ ${escapeHtml(r.name)}: ${escapeHtml(r.error)}</div>`;
    });

    if (resultHost) resultHost.innerHTML = html;
    setTimeout(() => refreshInfo(t, main, $('statusBar'), true), action === 'bulkRefresh' ? 1000 : 5000);
  });
}
