// 选项页面逻辑

const $ = id => document.getElementById(id);

let servers = [];
let editingServerId = null;
let defaultServerId = null;

const t = window.t;

// HTML 实体转义防止 XSS
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
    el.style.display = 'block'; // 覆盖内联 display: none 样式
  }
}

function hideMsg() {
  const el = $('msg');
  if (el) {
    el.style.display = 'none';
  }
}

// 应用多语言翻译
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
  
  // 表单标题
  if (editingServerId) {
    const s = servers.find(item => item.id === editingServerId);
    $('formTitle').textContent = t('formTitleEdit', { name: s ? s.name : '' });
  } else {
    $('formTitle').textContent = t('formTitleAdd');
  }
  
  renderServerList();
}

// 渲染服务器列表
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
          <button class="btn-icon del" data-id="${s.id}" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // 绑定选择事件
  document.querySelectorAll('.server-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('del') || e.target.classList.contains('star')) return;
      selectServer(el.dataset.id);
    });
  });
  
  // 绑定删除事件
  document.querySelectorAll('.btn-icon.del').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      deleteServer(el.dataset.id);
    });
  });

  // 绑定设置默认事件
  document.querySelectorAll('.btn-icon.star').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const serverId = el.dataset.id;
      const newDefaultId = defaultServerId === serverId ? null : serverId;
      
      // 使用 Callback，杜绝卡死
      chrome.storage.local.set({ defaultServerId: newDefaultId }, () => {
        defaultServerId = newDefaultId;
        renderServerList();
      });
    });
  });
}

// 选择编辑服务器
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

// 切换至新增表单
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

// 载入与旧版本数据兼容
function loadConfig() {
  try {
    chrome.storage.local.get(['servers', 'currentServerId', 'defaultServerId', 'apiUrl', 'apiKey', 'apiHash', 'lang'], data => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
      data = data || {};
      let list = data.servers || [];
    
    // 平滑兼容迁移
    if (list.length === 0 && data.apiUrl && data.apiKey && data.apiHash) {
      const oldServer = {
        id: 'server_' + Date.now(),
        name: '默认服务器',
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
    
    // 初始化语言
    if (data.lang) {
      window.currentLang = data.lang;
    } else {
      window.currentLang = 'en';
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

// 保存配置
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

// 删除服务器
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

// 测试连接
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

// 绑定事件
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

// 载入
loadConfig();
