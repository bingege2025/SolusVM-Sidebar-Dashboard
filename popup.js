// Popup page logic — fully synchronous init, no async/await

const $ = id => document.getElementById(id);
let privacyModeEnabled = false;
let darkModeEnabled = false;
let allServers = [];

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
function sendMessage(action, extraData) {
  extraData = extraData || {};
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ action, ...extraData }, response => {
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

// normalizeTagList, normalizeServers, getAllTagsFromServers, PROVIDER_META, getProviderMeta → shared.js

// Deterministic hue (0-359) from tag name — same tag always gets the same chip color
function getTagHue(tag) {
  let hash = 0;
  const str = String(tag);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

// Update the header selector trigger: provider logo + name (line 1), server alias (line 2)
function updateTriggerDisplay(server) {
  const triggerLogo = $('triggerLogo');
  const providerEl = $('selectedProviderName');
  const aliasEl = $('selectedServerName');
  const meta = server ? getProviderMeta(server.panel_type) : null;
  if (triggerLogo) triggerLogo.src = meta ? meta.logo : PROVIDER_META_DEFAULT.logo;
  if (providerEl) providerEl.textContent = meta ? meta.name : '';
  if (aliasEl) aliasEl.textContent = server ? server.name : window.t('noServers');
}

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
  btn.innerHTML = lucideIcon(darkModeEnabled ? 'sun' : 'moon', 14);
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

const GITHUB_NEW_ISSUE_URL = 'https://github.com/bingege2025/VPS-Sidebar-Dashboard/issues/new';
const DEV_EMAIL = 'renyanbin.wang@gmail.com';

// Pre-filled GitHub issue templates — minimize what the user has to type so they can submit in seconds.
function buildIssueUrl(type) {
  const version = chrome.runtime.getManifest().version;
  const lang = window.currentLang || 'en';
  const ua = navigator.userAgent;

  let title, body;
  if (type === 'provider') {
    title = '[Provider Request] ';
    body = [
      'Thanks for helping improve VPS Dashboard! Just tell us which provider you would like — everything else is optional.',
      '',
      '**Which provider?**',
      '- Provider / brand name: ',
      '- Panel or API type (SolusVM, Virtualizor, custom, etc.): ',
      '- Public API documentation URL (optional): ',
      '',
      '**Why do you need it?** (optional, one line is fine)',
      '- ',
      '',
      '---',
      `Extension Version: v${version}`,
      `Language: ${lang}`,
      '',
      'Please do not include API keys, API hashes, tokens, IP addresses, or hostnames.'
    ].join('\n');
  } else { // 'bug'
    title = '[Bug] ';
    body = [
      '**What happened?**',
      '(steps to reproduce, if any)',
      '',
      '**Expected behavior**',
      '- ',
      '',
      '**Actual behavior**',
      '- ',
      '',
      '**Provider / panel**',
      '- Provider: ',
      '- Panel type: (auto-detected)',
      '',
      '---',
      `Extension Version: v${version}`,
      `Language: ${lang}`,
      `Browser: ${ua}`,
      '',
      'Please do not include API keys, API hashes, tokens, IP addresses, or hostnames.'
    ].join('\n');
  }

  return `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function initFeedbackSection() {
  const t = window.t;
  const feedbackProviderText = $('feedbackProviderText');
  const feedbackBugText = $('feedbackBugText');
  const feedbackEmailText = $('feedbackEmailText');
  const feedbackProviderBtn = $('feedbackProviderBtn');
  const feedbackBugBtn = $('feedbackBugBtn');
  const feedbackEmailBtn = $('feedbackEmailBtn');
  if (feedbackProviderText) feedbackProviderText.textContent = t('feedbackProvider');
  if (feedbackBugText) feedbackBugText.textContent = t('feedbackBug');
  if (feedbackEmailText) feedbackEmailText.textContent = t('feedbackEmail');
  if (feedbackProviderBtn) feedbackProviderBtn.title = t('feedbackProviderTitle');
  if (feedbackBugBtn) feedbackBugBtn.title = t('feedbackBugTitle');
  if (feedbackEmailBtn) feedbackEmailBtn.title = t('feedbackEmailTitle');
}

// Bind feedback button clicks
const feedbackProviderBtn = $('feedbackProviderBtn');
if (feedbackProviderBtn) {
  feedbackProviderBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: buildIssueUrl('provider') });
  });
}

const feedbackBugBtn = $('feedbackBugBtn');
if (feedbackBugBtn) {
  feedbackBugBtn.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: buildIssueUrl('bug') });
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
  safeStorageGet(['servers', 'currentServerId', 'defaultServerId', 'tags', 'privacyModeEnabled', 'darkModeEnabled', 'apiUrl', 'apiKey', 'apiHash', 'lang', 'recentServerIds'], data => {
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
    allServers = normalizedServers;
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
      updateTriggerDisplay(null);
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
      let recentIds = (Array.isArray(data.recentServerIds) ? data.recentServerIds : [])
        .filter(id => data.servers.some(s => s.id === id))
        .slice(0, 5);

      const kbdHint = $('searchKbdHint');
      const updateKbdHint = () => {
        if (!kbdHint) return;
        kbdHint.textContent = serverSearchInput.value.trim() ? '↵' : 'esc';
      };

      const renderTagFilter = () => {
        if (!tagFilter) return;
        const tagsMarkup = [
          `<button type="button" class="tag-pill tag-all ${activeTag === '' ? 'active' : ''}" data-tag="">${escapeHtml(t('allTags') || 'All')}</button>`,
          ...allTags.map(tag => (
            `<button type="button" class="tag-pill ${tag.toLowerCase() === activeTag.toLowerCase() ? 'active' : ''}" data-tag="${escapeHtml(tag)}" title="${escapeHtml(tag)}" style="--chip-h: ${getTagHue(tag)}">${escapeHtml(tag)}</button>`
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
      
      const optionHtml = (s) => {
        const meta = getProviderMeta(s.panel_type);
        return `<div class="select-option ${s.id === activeId ? 'selected' : ''}" data-id="${escapeHtml(s.id)}">` +
          `<img class="option-logo" src="${meta.logo}" alt="">` +
          `<div class="option-text">` +
            `<span class="option-provider">${escapeHtml(meta.name)}</span>` +
            `<span class="option-alias">${escapeHtml(s.name)}</span>` +
          `</div></div>`;
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
        // Raycast-style "Recent" group: only when browsing (no query / no tag filter)
        const recentServers = recentIds.map(id => filtered.find(s => s.id === id)).filter(Boolean);
        const restServers = filtered.filter(s => !recentIds.includes(s.id));
        const showGroups = !normalizedQuery && !normalizedTag && recentServers.length > 0 && restServers.length > 0;
        if (showGroups) {
          selectOptions.innerHTML =
            `<div class="select-group-label">${escapeHtml(t('recentServers') || 'Recent')}</div>` +
            recentServers.map(optionHtml).join('') +
            `<div class="select-group-label">${escapeHtml(t('allServers') || 'All Servers')}</div>` +
            restServers.map(optionHtml).join('');
        } else {
          selectOptions.innerHTML = filtered.map(optionHtml).join('');
        }

        const optionNodes = selectOptions.querySelectorAll('.select-option:not(.no-results)');
        optionNodes.forEach(node => {
          node.addEventListener('click', e => {
            const newId = node.getAttribute('data-id');
            activeId = newId;
            recentIds = [newId, ...recentIds.filter(id => id !== newId)].slice(0, 5);
            chrome.storage.local.set({ currentServerId: newId, recentServerIds: recentIds }, () => {
              customSelect.classList.remove('open');
              selectDropdown.style.display = 'none';
              serverSearchInput.value = '';
              updateKbdHint();
              const activeServer = data.servers.find(s => s.id === activeId);
              updateTriggerDisplay(activeServer);
              refreshInfo(t, main, statusBar);
            });
          });
        });
      };

      const activeServer = data.servers.find(s => s.id === activeId);
      updateTriggerDisplay(activeServer);
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
            updateKbdHint();
          }
        });
        selectTrigger.dataset.listenerBound = 'true';
      }

      if (!serverSearchInput.dataset.listenerBound) {
        serverSearchInput.addEventListener('input', e => {
          renderOptions(e.target.value);
          updateKbdHint();
        });
        serverSearchInput.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            customSelect.classList.remove('open');
            selectDropdown.style.display = 'none';
            serverSearchInput.value = '';
            renderOptions('');
            updateKbdHint();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const first = selectOptions.querySelector('.select-option:not(.no-results)');
            if (first) first.click();
          }
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
    if (v.includes('offline') || v.includes('stopped') || v.includes('shutdown') || v === 'down') return false;
    return v.includes('online') || v.includes('running') || v.includes('active') || v.includes('started') || v.includes('booted') || v === 'up';
  });

  // Detect transitional states (e.g. EC2: pending / stopping / shutting-down)
  // Power actions are not allowed in these states — AWS rejects them.
  let transitionState = null;
  const isTransitioning = !isOnline && candidates.some(val => {
    const v = String(val).toLowerCase();
    if (['pending', 'stopping', 'shutting', 'starting', 'rebooting', 'initializing'].some(kw => v.includes(kw))) {
      transitionState = String(val);
      return true;
    }
    return false;
  });

  main.innerHTML = `
    <div class="content" id="serverDetail">
      <div class="info-grid">
        <span class="label">${t('hostname')}</span>
        <span class="value privacy-field" data-field="hostname">${escapeHtml(info.hostname || '-')}</span>
        <span class="label">${t('status')}</span>
        <span class="value"><span class="status-badge ${isOnline ? 'online' : (isTransitioning ? 'transitioning' : 'offline')}" data-field="status">${isOnline ? t('online') : (isTransitioning ? escapeHtml(transitionState) : t('offline'))}</span></span>
        <span class="label">${t('ip')}</span>
        <span class="value privacy-field" data-field="ip">${escapeHtml(info.ipaddress || status.ip || '-')}</span>
        <span class="label">${t('os')}</span>
        <span class="value" data-field="os">${escapeHtml(info.os || info.template || '-')}</span>
        <span class="label">${t('mem')}</span>
        <span class="value" data-field="mem">${formatResource(info.mem)}</span>
        <span class="label">${t('hdd')}</span>
        <span class="value" data-field="hdd">${formatResource(info.hdd)}</span>
        <span class="label">${t('bw')}</span>
        <span class="value" data-field="bw">${formatResource(info.bw)}</span>
      </div>
      <div class="actions">
        <button class="btn-refresh" id="refreshBtn">${lucideIcon('refresh', 15)}${t('btnRefresh')}</button>
        ${isTransitioning
          ? `<button class="btn-transitioning" id="transitioningBtn" disabled>${lucideIcon('loader', 15)}${t('stateTransitioning', { state: escapeHtml(transitionState) })}</button>`
          : isOnline
          ? `<button class="btn-reboot" id="rebootBtn">${lucideIcon('reboot', 15)}${t('btnReboot')}</button>
             <button class="btn-shutdown" id="shutdownBtn">${lucideIcon('power', 15)}${t('btnShutdown')}</button>`
          : `<button class="btn-boot" id="bootBtn">${lucideIcon('play', 15)}${t('btnBoot')}</button>`
        }
      </div>
      <div id="confirmPanelHost"></div>
      <div class="batch-select-panel">
        <div class="batch-select-bar">
          <span class="batch-hint">${t('batchSelectHint')}</span>
          <button type="button" class="batch-toggle" id="batchSelectAllBtn">${t('selectAll')}</button>
        </div>
        <div class="batch-server-list" id="batchServerList">
          ${allServers.map(s => `
            <label class="batch-server-row">
              <input type="checkbox" class="batch-checkbox" value="${escapeHtml(s.id)}">
              <span class="batch-server-name">${escapeHtml(s.name)}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="bulk-bar">
        <button id="batchRefreshBtn">${lucideIcon('refresh', 14)}${t('batchRefresh')}</button>
        <button class="bulk-reboot" id="batchRebootBtn">${lucideIcon('reboot', 14)}${t('batchReboot')}</button>
        <button class="bulk-shutdown" id="batchShutdownBtn">${lucideIcon('power', 14)}${t('batchShutdown')}</button>
      </div>
      <div class="bulk-result" id="bulkResultHost"></div>
    </div>`;

  applyPrivacyMode();

  const hostname = info.hostname || '-';

  $('refreshBtn').addEventListener('click', () => doAction('refresh', t('btnRefresh'), t, main));
  if (isTransitioning) {
    // No power actions while transitioning — auto refresh to pick up the settled state
    setTimeout(() => silentUpdateCurrentServer(t), 8000);
  } else if (isOnline) {
    const rebootBtn = $('rebootBtn');
    if (rebootBtn) rebootBtn.addEventListener('click', () => {
      showInlineConfirm({
        message: t('confirmReboot', { hostname }),
        actionLabel: t('btnReboot'),
        danger: false,
        onConfirm: () => doAction('reboot', t('reboot'), t, main)
      });
    });
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

  // Batch selection: select all / deselect all
  const batchSelectAllBtn = $('batchSelectAllBtn');
  const batchServerList = $('batchServerList');
  if (batchSelectAllBtn && batchServerList) {
    let allSelected = false;
    batchSelectAllBtn.addEventListener('click', () => {
      allSelected = !allSelected;
      const checkboxes = batchServerList.querySelectorAll('.batch-checkbox');
      checkboxes.forEach(cb => { cb.checked = allSelected; });
      batchSelectAllBtn.textContent = allSelected ? t('deselectAll') : t('selectAll');
    });
  }

  // Batch action buttons
  function getSelectedServerIds() {
    const checkboxes = document.querySelectorAll('#batchServerList .batch-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  const batchRefreshBtn = $('batchRefreshBtn');
  if (batchRefreshBtn) batchRefreshBtn.addEventListener('click', () => {
    const ids = getSelectedServerIds();
    if (ids.length === 0) return;
    doBulkAction('batchRefresh', t('batchRefresh'), t, main, ids);
  });
  const batchRebootBtn = $('batchRebootBtn');
  if (batchRebootBtn) batchRebootBtn.addEventListener('click', () => {
    const ids = getSelectedServerIds();
    if (ids.length === 0) return;
    showInlineConfirm({
      message: t('confirmBatchReboot'),
      actionLabel: t('batchReboot'),
      danger: false,
      onConfirm: () => doBulkAction('batchReboot', t('batchReboot'), t, main, ids)
    });
  });
  const batchShutdownBtn = $('batchShutdownBtn');
  if (batchShutdownBtn) batchShutdownBtn.addEventListener('click', () => {
    const ids = getSelectedServerIds();
    if (ids.length === 0) return;
    showInlineConfirm({
      message: t('confirmBatchShutdown'),
      actionLabel: t('batchShutdown'),
      danger: true,
      onConfirm: () => doBulkAction('batchShutdown', t('batchShutdown'), t, main, ids)
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

  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
  const statusBar = $('statusBar');
  if (statusBar) {
    statusBar.style.display = 'block';
    statusBar.textContent = `⏳ ${label}...`;
  }

  if (action === 'refresh') {
    silentUpdateCurrentServer(t);
    return;
  }

  // Reboot / shutdown / boot
  sendMessage(action).then(res => {
    if (res.success) {
      if (statusBar) statusBar.textContent = t('sentAction', { action: label });
      setTimeout(() => silentUpdateCurrentServer(t), 5000);
    } else {
      if (statusBar) statusBar.textContent = t('actionFail', { action: label, error: res.error });
    }
  });
}

// ---- Bulk operations ----

function doBulkAction(action, label, t, main, serverIds) {
  t = t || window.t;
  main = main || $('main');
  const resultHost = $('bulkResultHost');
  if (resultHost) resultHost.innerHTML = `<span style="color:#999;">⏳ ${label}...</span>`;

  sendMessage(action, { serverIds }).then(res => {
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

    if (resultHost) {
      resultHost.innerHTML = html;
      resultHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (action === 'batchRefresh') {
      setTimeout(() => silentUpdateCurrentServer(t), 1000);
    } else {
      setTimeout(() => silentUpdateCurrentServer(t), 5000);
    }
  });
}

// Silently refresh current server info without full page re-render
async function silentUpdateCurrentServer(t) {
  t = t || window.t;
  const statusBar = $('statusBar');

  try {
    const [statusRes, infoRes] = await Promise.all([
      sendMessage('getStatus'),
      sendMessage('getInfo')
    ]);

    if (!infoRes.success) return;

    const status = statusRes.success ? statusRes.data : {};
    const info = infoRes.data;

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

    const isOnline = candidates.some(v => {
      const lower = v.toLowerCase();
      if (['offline', 'stopped', 'shutdown'].some(kw => lower.includes(kw)) || lower === 'down') return false;
      return ['online', 'running', 'active', 'started', 'booted'].some(kw => lower.includes(kw));
    }) || String(status.statusmsg || '').toLowerCase() === 'up';

    // Detect transitional states (e.g. EC2: pending / stopping / shutting-down)
    let transitionState = null;
    const isTransitioning = !isOnline && candidates.some(val => {
      const v = String(val).toLowerCase();
      if (['pending', 'stopping', 'shutting', 'starting', 'rebooting', 'initializing'].some(kw => v.includes(kw))) {
        transitionState = String(val);
        return true;
      }
      return false;
    });

    // Update status badge
    const statusBadge = document.querySelector('[data-field="status"]');
    if (statusBadge) {
      statusBadge.className = `status-badge ${isOnline ? 'online' : (isTransitioning ? 'transitioning' : 'offline')}`;
      statusBadge.textContent = isOnline ? t('online') : (isTransitioning ? transitionState : t('offline'));
    }

    // Update action buttons based on online state
    const actionsEl = document.querySelector('.actions');
    if (actionsEl) {
      const hostname = info.hostname || '';
      const powerHtml = isTransitioning
        ? `<button class="btn-transitioning" id="transitioningBtn" disabled>${lucideIcon('loader', 15)}${t('stateTransitioning', { state: escapeHtml(transitionState) })}</button>`
        : isOnline
        ? `<button class="btn-reboot" id="rebootBtn">${lucideIcon('reboot', 15)}${t('btnReboot')}</button>
           <button class="btn-shutdown" id="shutdownBtn">${lucideIcon('power', 15)}${t('btnShutdown')}</button>`
        : `<button class="btn-boot" id="bootBtn">${lucideIcon('play', 15)}${t('btnBoot')}</button>`;
      actionsEl.innerHTML = `
        <button class="btn-refresh" id="refreshBtn">${lucideIcon('refresh', 15)}${t('btnRefresh')}</button>
        ${powerHtml}
      `;
      // Re-bind action events
      $('refreshBtn').addEventListener('click', () => doAction('refresh', t('btnRefresh'), t, $('main')));
      if (isTransitioning) {
        // Keep polling until the state settles
        setTimeout(() => silentUpdateCurrentServer(t), 8000);
      } else if (isOnline) {
        const rebootBtn = $('rebootBtn');
        if (rebootBtn) rebootBtn.addEventListener('click', () => {
          showInlineConfirm({
            message: t('confirmReboot', { hostname }),
            actionLabel: t('btnReboot'),
            danger: false,
            onConfirm: () => doAction('reboot', t('reboot'), t, $('main'))
          });
        });
        const shutdownBtn = $('shutdownBtn');
        if (shutdownBtn) shutdownBtn.addEventListener('click', () => {
          showInlineConfirm({
            message: t('confirmShutdown', { hostname }),
            actionLabel: t('btnShutdown'),
            danger: true,
            onConfirm: () => doAction('shutdown', t('shutdown'), t, $('main'))
          });
        });
      } else {
        const bootBtn = $('bootBtn');
        if (bootBtn) bootBtn.addEventListener('click', () => doAction('boot', t('boot'), t, $('main')));
      }
    }

    // Update cache
    safeStorageGet(['servers', 'currentServerId'], storageData => {
      if (!storageData) return;
      const currentId = storageData.currentServerId || (storageData.servers && storageData.servers[0] ? storageData.servers[0].id : null);
      if (!currentId) return;
      const cacheKey = 'cache_' + currentId;
      const freshData = {
        ...info,
        status: status.status || info.status,
        statusmsg: status.statusmsg || info.statusmsg,
        vmstat: status.vmstat || info.vmstat,
        vmstate: status.vmstate || info.vmstate,
        state: status.state || info.state,
        lastUpdated: new Date().toLocaleTimeString()
      };
      chrome.storage.local.set({ [cacheKey]: freshData });
    });

    // Update status bar
    if (statusBar) {
      statusBar.style.display = 'block';
      statusBar.textContent = t('lastUpdated', { time: new Date().toLocaleTimeString() });
    }

    // Re-apply privacy mode
    applyPrivacyMode();
  } catch (e) {
    console.error('silentUpdateCurrentServer error:', e);
  }
}
