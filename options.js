// Options page logic

const $ = id => document.getElementById(id);

let servers = [];
let editingServerId = null;
let defaultServerId = null;

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
    el.style.display = 'block'; // Override inline display: none style
  }
}

function hideMsg() {
  const el = $('msg');
  if (el) {
    el.style.display = 'none';
  }
}

// Apply internationalization translations
function applyTranslations() {
  $('i18n_title').textContent = t('title');
  $('addBtn').textContent = t('btnAdd');
  $('i18n_labelName').textContent = t('labelName');
  $('i18n_hintName').textContent = t('hintName');
  $('i18n_labelUrl').textContent = t('labelUrl');
  $('i18n_hintUrl').textContent = t('hintUrl');
  $('i18n_labelKey').textContent = t('labelKey');
  $('i18n_hintKey').textContent = t('hintKey');
  $('i18n_labelHash').textContent = t('labelHash');
  $('i18n_hintHash').textContent = t('hintHash');
  
  $('saveBtn').textContent = t('btnSave');
  $('testBtn').textContent = t('btnTest');
  
  // placeholder
  $('serverName').placeholder = t('placeholderName');
  $('apiUrl').placeholder = t('placeholderUrl');
  $('apiKey').placeholder = t('placeholderKey');
  $('apiHash').placeholder = t('placeholderHash');
  
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
    
    return `
      <div class="server-item ${isActive ? 'active' : ''}" data-id="${s.id}">
        <div class="server-info">
          <div class="server-title-container">
            <span class="server-name">${escapeHtml(s.name)}</span>
            ${isDefault ? `<span class="badge-default">${t('badgeDefault')}</span>` : ''}
          </div>
          <span class="server-host">${escapeHtml(host)}</span>
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
      
      // Use callbacks to avoid UI freezes
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
  
  document.querySelectorAll('.server-item').forEach(el => {
    el.classList.remove('active');
  });
  hideMsg();
}

// Load configuration and migrate from legacy versions
function loadConfig() {
  try {
    chrome.storage.local.get(['servers', 'currentServerId', 'defaultServerId', 'apiUrl', 'apiKey', 'apiHash', 'lang'], data => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      data = data || {};
      let list = data.servers || [];
      
      // Smooth compatibility migration
      if (list.length === 0 && data.apiUrl && data.apiKey && data.apiHash) {
        const oldServer = {
          id: 'server_' + Date.now(),
          name: 'Default Server',
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
          apiHash: data.apiHash
        };
        list = [oldServer];
        chrome.storage.local.set({
          servers: list,
          currentServerId: oldServer.id
        }, () => {
          chrome.storage.local.remove(['apiUrl', 'apiKey', 'apiHash']);
        });
      }
      
      // Initialize language
      if (data.lang) {
        window.currentLang = data.lang;
      } else {
        window.currentLang = 'en'; // Default to English
      }
      $('languageSelect').value = window.currentLang;
      
      servers = list;
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
    console.error('loadConfig error:', e);
  }
}

// Save configuration
function saveServer() {
  const name = $('serverName').value.trim();
  const apiUrl = $('apiUrl').value.trim();
  const apiKey = $('apiKey').value.trim();
  const apiHash = $('apiHash').value.trim();
  
  if (!name || !apiUrl || !apiKey || !apiHash) {
    showMsg(t('msgRequired'), false);
    return;
  }
  
  let cleanedUrl = apiUrl.replace(/\/$/, '');
  
  const config = {
    name,
    apiUrl: cleanedUrl,
    apiKey,
    apiHash
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
      
      chrome.storage.local.set({
        servers,
        currentServerId: currentId
      }, () => {
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
  
  const tempConfig = { apiUrl, apiKey, apiHash };
  
  try {
    chrome.runtime.sendMessage({ action: 'testConnection', config: tempConfig }, resp => {
      if (chrome.runtime.lastError) {
        showMsg(t('msgTestFail', { error: chrome.runtime.lastError.message }), false);
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
