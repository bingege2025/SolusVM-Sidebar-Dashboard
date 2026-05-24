// Global translations package
window.currentLang = 'en';

window.i18nDict = {
  zh: {
    // Popup keys
    noConfig: "尚未配置 API 信息",
    goConfig: "前往配置 →",
    loading: "⏳ 加载中...",
    loadingAction: "⏳ 正在{action}...",
    sentAction: "⏳ 已发送{action}指令，正在等待服务器响应（状态更新可能存在延迟）...",
    actionFail: "❌ {action}失败: {error}",
    updateFail: "⚠️ 更新失败，展示缓存数据。错误: {error}",
    lastUpdated: "最后更新: {time}",
    lastUpdatedCache: "最后更新 (已缓存): {time}",
    hostname: "主机名",
    status: "状态",
    online: "● 运行中",
    offline: "● 已停止",
    ip: "IP 地址",
    os: "操作系统",
    mem: "内存",
    hdd: "磁盘",
    bw: "带宽",
    btnRefresh: "🔄 刷新",
    btnReboot: "🔁 重启",
    btnShutdown: "⏹ 关机",
    btnBoot: "▶ 开机",
    settings: "设置",
    loadingServers: "加载服务器中...",
    noServers: "无可用服务器",
    reboot: "重启",
    shutdown: "关机",
    boot: "开机",
    
    // Options keys
    title: "⚙️ RackNerd API 配置中心",
    btnAdd: "➕ 添加新服务器",
    emptyServers: "🫙 暂无服务器",
    formTitleAdd: "添加新服务器",
    formTitleEdit: "编辑服务器：{name}",
    labelName: "服务器别名",
    placeholderName: "例如：洛杉矶 1",
    hintName: "给这台服务器起一个好记的名字",
    labelUrl: "API 地址（SolusVM 面板 URL）",
    placeholderUrl: "https://xxx.racknerd.com:5656",
    hintUrl: "RackNerd 客户后台 → Services → 选择 VPS → SolusVM Panel URL",
    labelKey: "API Key",
    placeholderKey: "输入 API Key",
    hintKey: "在 SolusVM 面板 → API 标签页中获取",
    labelHash: "API Hash",
    placeholderHash: "输入 API Hash",
    hintHash: "在 SolusVM 面板 → API 标签页中获取",
    labelLang: "语言设置 / Language",
    btnSave: "保存配置",
    btnTest: "测试连接",
    msgRequired: "请填写所有字段",
    msgSaved: "✅ 服务器配置已保存",
    msgAdded: "✅ 新服务器已成功添加",
    msgDeleted: "🗑️ 服务器已删除",
    msgTesting: "⏳ 正在尝试连接 API，请稍候...",
    msgTestOk: "✅ 连接测试成功！状态：在线",
    msgTestFail: "❌ 连接测试失败: {error}",
    confirmDelete: "确定要删除服务器 \"{name}\" 吗？",
    badgeDefault: "默认",
    tagDefault: "设为默认"
  },
  en: {
    // Popup keys
    noConfig: "No API Configuration Found",
    goConfig: "Go to Settings →",
    loading: "⏳ Loading...",
    loadingAction: "⏳ Processing {action}...",
    sentAction: "⏳ Sent {action} command, waiting for response (status update may delay)...",
    actionFail: "❌ {action} failed: {error}",
    updateFail: "⚠️ Update failed, showing cache. Error: {error}",
    lastUpdated: "Last Updated: {time}",
    lastUpdatedCache: "Last Updated (Cached): {time}",
    hostname: "Hostname",
    status: "Status",
    online: "● Online",
    offline: "● Offline",
    ip: "IP Address",
    os: "OS",
    mem: "Memory",
    hdd: "Disk",
    bw: "Bandwidth",
    btnRefresh: "🔄 Refresh",
    btnReboot: "🔁 Reboot",
    btnShutdown: "⏹ Shutdown",
    btnBoot: "▶ Boot",
    settings: "Settings",
    loadingServers: "Loading servers...",
    noServers: "No Servers Available",
    reboot: "Reboot",
    shutdown: "Shutdown",
    boot: "Boot",
    
    // Options keys
    title: "⚙️ RackNerd Config Center",
    btnAdd: "➕ Add New Server",
    emptyServers: "🫙 No Servers Configured",
    formTitleAdd: "Add New Server",
    formTitleEdit: "Edit Server: {name}",
    labelName: "Server Alias",
    placeholderName: "e.g., Los Angeles 1",
    hintName: "Give this server a memorable name",
    labelUrl: "API URL (SolusVM Panel URL)",
    placeholderUrl: "https://xxx.racknerd.com:5656",
    hintUrl: "RackNerd Client Portal → Services → Select VPS → SolusVM Panel URL",
    labelKey: "API Key",
    placeholderKey: "Enter API Key",
    hintKey: "Generate in SolusVM Panel → API tab",
    labelHash: "API Hash",
    placeholderHash: "Enter API Hash",
    hintHash: "Generate in SolusVM Panel → API tab",
    labelLang: "Language / 语言设置",
    btnSave: "Save Settings",
    btnTest: "Test Connection",
    msgRequired: "Please fill in all fields",
    msgSaved: "✅ Server configuration updated",
    msgAdded: "✅ New server added successfully",
    msgDeleted: "🗑️ Server deleted",
    msgTesting: "⏳ Attempting to connect to API, please wait...",
    msgTestOk: "✅ Connection test succeeded! Status: Online",
    msgTestFail: "❌ Connection test failed: {error}",
    confirmDelete: "Are you sure you want to delete server \"{name}\"?",
    badgeDefault: "Default",
    tagDefault: "Set as default"
  }
};

// Initialize language with storage timeout fallback
window.initI18n = function(callback) {
  let done = false;
  const timeout = setTimeout(() => {
    if (!done) {
      done = true;
      console.warn('initI18n: storage.local.get timed out, falling back to English');
      window.currentLang = 'en';
      if (callback) callback();
    }
  }, 800);

  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      throw new Error('chrome.storage.local is not available');
    }
    chrome.storage.local.get('lang', data => {
      clearTimeout(timeout);
      if (!done) {
        done = true;
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
        if (data && data.lang) {
          window.currentLang = data.lang;
        } else {
          window.currentLang = 'en';
        }
        if (callback) callback();
      }
    });
  } catch (e) {
    clearTimeout(timeout);
    if (!done) {
      done = true;
      console.error('initI18n error:', e);
      window.currentLang = 'en';
      if (callback) callback();
    }
  }
};

// Translate function
window.t = function(key, params = {}) {
  const translations = window.i18nDict[window.currentLang] || window.i18nDict['en'];
  let text = translations[key] || window.i18nDict['en'][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
};
