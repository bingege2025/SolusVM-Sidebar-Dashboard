// Options page logic — Multi-Panel Driver ready

const $ = id => document.getElementById(id);

let servers = [];
let editingServerId = null;
let defaultServerId = null;
let allTags = [];

const t = window.t;

// HTML escape to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function showMsg(text, ok) {
  const el = $('msg');
  if (el) {
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'err');
    el.style.display = 'block';
  }
}

function hideMsg() {
  const el = $('msg');
  if (el) {
    el.style.display = 'none';
  }
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

function persistServers(nextServers, currentServerId, callback) {
  allTags = getAllTagsFromServers(nextServers);
  chrome.storage.local.set({
    servers: nextServers,
    tags: allTags,
    currentServerId
  }, callback);
}

// Apply internationalization translations
function applyTranslations() {
  $('i18n_title').textContent = t('title');
  $('addBtn').textContent = t('btnAdd');
  $('i18n_labelName').textContent = t('labelName');
  $('i18n_hintName').textContent = t('hintName');
  $('i18n_labelPanelType').textContent = t('labelPanelType');
  $('i18n_hintPanelType').textContent = t('hintPanelType');
  $('i18n_labelUrl').textContent = t('labelUrl');
  $('i18n_hintUrl').textContent = t('hintUrl');
  $('i18n_labelKey').textContent = t('labelKey');
  $('i18n_hintKey').textContent = t('hintKey');
  $('i18n_labelHash').textContent = t('labelHash');
  $('i18n_hintHash').textContent = t('hintHash');
  $('i18n_labelTags').textContent = t('labelTags');
  $('i18n_hintTags').textContent = t('hintTags');
  
  $('saveBtn').textContent = t('btnSave');
  $('testBtn').textContent = t('btnTest');
  
  // placeholder
  $('serverName').placeholder = t('placeholderName');
  $('apiUrl').placeholder = t('placeholderUrl');
  $('apiKey').placeholder = t('placeholderKey');
  $('apiHash').placeholder = t('placeholderHash');
  $('serverTags').placeholder = t('placeholderTags');
  
  // Form title
  if (editingServerId) {
    const s = servers.find(item => item.id === editingServerId);
    $('formTitle').textContent = t('formTitleEdit', { name: s ? s.name : '' });
  } else {
    $('formTitle').textContent = t('formTitleAdd');
  }
  
  renderServerList();
}

// Render server list
function renderServerList() {
  const listEl = $('serverList');
  if (servers.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;color:#999;font-size:12px;padding:24px 0;">${t('emptyServers')}</div>`;
    return;
  }
  
  listEl.innerHTML = servers.map(s => {
    let host = s.apiUrl;
    try {
      const urlObj = new URL(s.apiUrl);
      host = urlObj.hostname;
    } catch (e) {}
    
    const isActive = s.id === editingServerId;
    const isDefault = s.id === defaultServerId;
    const panelLabel = (s.panel_type || 'solusvm').toUpperCase();
    
    return `
      <div class="server-item ${isActive ? 'active' : ''}" data-id="${s.id}">
        <div class="server-info">
          <div class="server-title-container">
            <span class="server-name">${escapeHtml(s.name)}</span>
            ${isDefault ? `<span class="badge-default">${t('badgeDefault')}</span>` : ''}
          </div>
          <span class="server-host">${escapeHtml(host)} · ${escapeHtml(panelLabel)}</span>
        </div>
        <div class="server-actions">
          <button class="btn-icon star ${isDefault ? 'active' : ''}" data-id="${s.id}" title="${t('tagDefault')}">${isDefault ? '★' : '☆'}</button>
          <button class="btn-icon del" data-id="${s.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind select event
  document.querySelectorAll('.server-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('del') || e.target.classList.contains('star')) return;
      selectServer(el.dataset.id);
    });
  });
  
  // Bind delete event
  document.querySelectorAll('.btn-icon.del').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      deleteServer(el.dataset.id);
    });
  });

  // Bind set-default event
  document.querySelectorAll('.btn-icon.star').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const serverId = el.dataset.id;
      const newDefaultId = defaultServerId === serverId ? null : serverId;
      
      chrome.storage.local.set({ defaultServerId: newDefaultId }, () => {
        defaultServerId = newDefaultId;
        renderServerList();
      });
    });
  });
}

// Select server for editing
function selectServer(id) {
  editingServerId = id;
  const s = servers.find(item => item.id === id);
  if (s) {
    $('formTitle').textContent = t('formTitleEdit', { name: s.name });
    $('serverName').value = s.name;
    $('apiUrl').value = s.apiUrl;
    $('apiKey').value = s.apiKey;
    $('apiHash').value = s.apiHash;
    // Load panel_type with fallback to 'solusvm'
    $('panelType').value = s.panel_type || 'solusvm';
    $('serverTags').value = normalizeTagList(s.tags).join(', ');
    
    document.querySelectorAll('.server-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
    hideMsg();
  }
}

// Switch to add-new form
function showNewForm() {
  editingServerId = null;
  $('formTitle').textContent = t('formTitleAdd');
  $('serverName').value = '';
  $('apiUrl').value = '';
  $('apiKey').value = '';
  $('apiHash').value = '';
  $('panelType').value = 'solusvm';
  $('serverTags').value = '';
  
  document.querySelectorAll('.server-item').forEach(el => {
    el.classList.remove('active');
  });
  hideMsg();
}

// Normalize all servers — ensure every node has panel_type (backward-compat)
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

// Load configuration and migrate from legacy versions
function loadConfig() {
  try {
    chrome.storage.local.get(['servers', 'currentServerId', 'defaultServerId', 'apiUrl', 'apiKey', 'apiHash', 'tags', 'lang'], data => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message;
        if (errMsg.includes('context invalidated')) {
          console.warn('Extension context invalidated, reloading...');
          location.reload();
          return;
        }
        console.error(chrome.runtime.lastError);
      }
      data = data || {};
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
        chrome.storage.local.set({
          servers: list,
          currentServerId: oldServer.id,
          tags: []
        }, () => {
          chrome.storage.local.remove(['apiUrl', 'apiKey', 'apiHash']);
        });
      }
      
      const normalized = normalizeServers(list);
      if (JSON.stringify(data.servers) !== JSON.stringify(normalized)) {
        chrome.storage.local.set({ servers: normalized });
      }

      // Initialize tags
      allTags = getAllTagsFromServers(normalized);
      const storedTags = data.tags || [];
      if (JSON.stringify(storedTags) !== JSON.stringify(allTags)) {
        chrome.storage.local.set({ tags: allTags });
      }

      // Initialize language
      if (data.lang) {
        window.currentLang = data.lang;
      } else {
        window.currentLang = 'en';
      }
      $('languageSelect').value = window.currentLang;
      
      servers = normalized;
      defaultServerId = data.defaultServerId || null;
      
      applyTranslations();
      
      const activeId = data.currentServerId || (servers[0] ? servers[0].id : null);
      if (activeId) {
        selectServer(activeId);
      } else {
        showNewForm();
      }
    });
  } catch (e) {
    if (e.message.includes('context invalidated')) {
      console.warn('Extension context invalidated, reloading...');
      location.reload();
      return;
    }
    console.error('loadConfig error:', e);
  }
}

// Save configuration
function saveServer() {
  const name = $('serverName').value.trim();
  const apiUrl = $('apiUrl').value.trim();
  const apiKey = $('apiKey').value.trim();
  const apiHash = $('apiHash').value.trim();
  const panelType = $('panelType').value;
  
  if (!name || !apiUrl || !apiKey || !apiHash) {
    showMsg(t('msgRequired'), false);
    return;
  }
  
  let cleanedUrl = apiUrl.replace(/\/$/, '');
  
  const config = {
    name,
    apiUrl: cleanedUrl,
    apiKey,
    apiHash,
    panel_type: panelType,
    tags: normalizeTagList($('serverTags').value)
  };
  
  try {
    chrome.storage.local.get('currentServerId', data => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
    data = data || {};
    let currentId = data.currentServerId;
    const isEditing = !!editingServerId;
      
    if (isEditing) {
      servers = servers.map(s => {
        if (s.id === editingServerId) {
          return { ...s, ...config };
        }
        return s;
      });
    } else {
      const newId = 'server_' + Date.now();
      const newServer = { id: newId, ...config };
      servers.push(newServer);
      editingServerId = newId;
      currentId = newId;
    }
      
    persistServers(servers, currentId, () => {
      renderServerList();
      selectServer(editingServerId);
      showMsg(t(isEditing ? 'msgSaved' : 'msgAdded'), true);
    });
    });
  } catch (e) {
    console.error('saveServer error:', e);
    showMsg('Save error: ' + e.message, false);
  }
}

// Delete server
function deleteServer(id) {
  const s = servers.find(item => item.id === id);
  if (!s) return;
  if (!confirm(t('confirmDelete', { name: s.name }))) return;
  
  servers = servers.filter(item => item.id !== id);
  
  try {
    chrome.storage.local.get('currentServerId', data => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      data = data || {};
      let currentId = data.currentServerId;
      if (currentId === id) {
        currentId = servers[0] ? servers[0].id : null;
      }
      
      chrome.storage.local.remove('cache_' + id, () => {
        chrome.storage.local.set({
          servers,
          currentServerId: currentId
        }, () => {
          if (editingServerId === id || servers.length === 0) {
            if (servers.length > 0) {
              selectServer(servers[0].id);
            } else {
              showNewForm();
            }
          } else {
            renderServerList();
          }
          showMsg(t('msgDeleted'), true);
        });
      });
    });
  } catch (e) {
    console.error('deleteServer error:', e);
  }
}

// Test API connection
function testConnection() {
  const apiUrl = $('apiUrl').value.trim();
  const apiKey = $('apiKey').value.trim();
  const apiHash = $('apiHash').value.trim();
  
  if (!apiUrl || !apiKey || !apiHash) {
    showMsg(t('msgRequired'), false);
    return;
  }
  
  showMsg(t('msgTesting'), true);
  
  const tempConfig = { apiUrl, apiKey, apiHash, panel_type: $('panelType').value };
  
  try {
    chrome.runtime.sendMessage({ action: 'testConnection', config: tempConfig }, resp => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message;
        if (errMsg.includes('context invalidated')) {
          console.warn('Extension context invalidated, reloading...');
          location.reload();
          return;
        }
        showMsg(t('msgTestFail', { error: errMsg }), false);
        return;
      }
      if (resp && resp.success) {
        showMsg(t('msgTestOk'), true);
      } else {
        const errMsg = resp ? resp.error : 'API Timeout';
        showMsg(t('msgTestFail', { error: errMsg }), false);
      }
    });
  } catch (e) {
    if (e.message.includes('context invalidated')) {
      console.warn('Extension context invalidated, reloading...');
      location.reload();
      return;
    }
    showMsg(t('msgTestFail', { error: e.message }), false);
  }
}

// Bind DOM events
$('addBtn').addEventListener('click', showNewForm);
$('saveBtn').addEventListener('click', saveServer);
$('testBtn').addEventListener('click', testConnection);
$('languageSelect').addEventListener('change', e => {
  const selectedLang = e.target.value;
  chrome.storage.local.set({ lang: selectedLang }, () => {
    window.currentLang = selectedLang;
    applyTranslations();
    showMsg(window.t('msgSaved'), true);
  });
});

// Load configuration on startup
loadConfig();
