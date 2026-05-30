# Chrome Web Store Listing — RackNerd Server Manager

> Last Updated: 2026-05-30

## Store Listing (应用商店信息)

**Extension Name (扩展名称)** [REQUIRED]
`RackNerd Server Manager`
*(必须与 manifest.json 中的 name 保持一致。最多 75 个字符。)*

**Short Description (简短说明)** [REQUIRED]
`Manage RackNerd servers - view status, reboot, and shutdown.`
*(最多 132 个字符。显示在搜索结果和卡片中。内容需具体阐述扩展程序的功能。)*

**Detailed Description (详细说明)** [REQUIRED]
*(最多 16,000 个字符。注：Chrome Web Store 详情页不支持 Markdown 格式，在开发者后台粘贴时请去除 Markdown 标记，使用换行进行分段，不要使用列表符号。)*

```text
RackNerd Server Manager 是一款方便直观的 Chrome 浏览器扩展，专为 RackNerd 用户及使用 SolusVM 控制面板的 VPS 用户设计。通过调用 SolusVM 客户端 API，让您无需登录官网后台，即可直接在浏览器侧边栏或弹出窗口中实时监控和管理您的服务器。

核心功能：
1. 实时状态监控：一键获取服务器当前状态（运行中/已关机）、操作系统、IP 地址、以及 CPU、内存、硬盘和流量的使用进度条。
2. 基础控制操作：直接执行开机（Boot）、关机（Shutdown）和重启（Reboot）指令，并在执行前进行确认提示，防止误操作。
3. 多服务器支持：支持配置和保存多台服务器 API 凭证，方便在下拉菜单中快速切换管理。
4. 极致体验：支持中英文双语，可随系统主题自动切换暗色/亮色模式。完全采用原生 JS 开发，秒级载入，且不含任何后台常驻进程。

使用步骤：
1. 安装扩展后，右键点击图标选择“选项”，或在弹出窗口中点击设置图标进入配置页面。
2. 填写您的服务器 API 信息：
   - API URL：您的 SolusVM 管理面板地址（如 https://nerdvm.racknerd.com:5656 或 https://vpscp.racknerd.com:5656）
   - API Key 与 API Hash：在 RackNerd 客户后台的 VPS 管理页面中，找到 "API" 选项卡并生成/获取。
3. 点击“测试并保存”以确认连接成功。
4. 点击浏览器工具栏的扩展图标，即可随时查看和控制您的服务器。

隐私安全说明：
本扩展的所有配置数据（API 凭证）均安全地保存在您本地浏览器的 Local Storage 中，所有 API 请求均由扩展直接向您填写的 API 地址发起，绝不经过任何第三方代理服务器，不收集、不上传任何个人数据或浏览隐私。

项目开源与反馈：
本扩展已在 GitHub 开源，如果您在使用中遇到任何问题或有新功能建议，欢迎提交 Issue。
开源主页：https://github.com/bingege2025/SolusVM-Sidebar-Dashboard
```

**Category (类别)** [REQUIRED]
`Developer Tools` (开发者工具) 或 `Productivity` (生产力工具)

**Single Purpose (单一用途声明)** [REQUIRED]
`通过 SolusVM API 提供便捷的 RackNerd 服务器（VPS）状态监控与基础控制操作。`
*(用一句话描述，必须狭窄且易于理解。例如：“通过 SolusVM API 管理和监控您的 RackNerd 服务器状态及执行基础控制操作。”)*

**Primary Language (主语言)** [REQUIRED]
`English` 或 `中文 (简体)` (建议设为 English，因为全球通用，或中文简体，视您主要受众而定)

---

## Graphics & Assets (图片与资产)

| 资产类型 | 尺寸要求 | 状态 | 文件名/说明 |
|-------|-----------|--------|----------|
| Store Icon (商店图标) [REQUIRED] | 128×128 PNG | ✅ 准备就绪 | `icons/icon128.png` |
| Screenshot 1 (屏幕截图 1) [REQUIRED] | 1280×800 或 640×400 | ⬜ 待截取 | 弹出窗口显示服务器监控状态的主界面截图 |
| Screenshot 2 (屏幕截图 2) [RECOMMENDED] | 1280×800 或 640×400 | ⬜ 待截取 | 选项设置页面（多服务器配置管理）截图 |
| Small Promo Tile (小宣传瓷砖) | 440×280 PNG/JPG | ⬜ 可选 | 用于应用商店推荐位 |

*(注：提交时必须上传至少一张屏幕截图，截图必须是 extension 运行的实际画面，不能有设备边框，比例需严格为 1280×800 或 640×400)*

---

## Permissions Justification (权限声明合理性说明)

*(在 Chrome 开发者后台提交时，每一项权限都需要用英文填写具体合理的用途解释，否则审核会被退回。请直接复制以下英文说明：)*

| 权限名称 (Permission) | 类型 (Type) | 英文合理性说明 (Justification in English) |
|------------|------|---------------|
| `storage` | permissions | Used to store the server's API configurations (API URL, API Key, API Hash) and user preferences locally on the user's device. |
| `https://*/*` | host_permissions | Required to make fetch requests directly to the SolusVM panel URLs (which reside on user-configured custom domains, e.g., nerdvm.racknerd.com or vpscp.racknerd.com) to retrieve server statuses and send control commands (reboot/shutdown/boot). |

---

## Privacy & Data Use (隐私与数据使用声明)

*(对应 Chrome 开发者后台的「隐私公开声明」表单，请按以下内容选择)*

### 1. Data Collection (数据收集)
**Does the extension collect user data? (该扩展是否收集用户数据？)**
`No` (不收集任何数据)

*(因为本扩展所有凭证均保存在 `chrome.storage.local`，并且是直接 fetch 到 SolusVM 接口，没有收集、上传或共享任何用户数据，所以全部选择否。)*

### 2. Data Use Certification (数据使用承诺)
*(必须勾选以下三项以符合规范)*
- [x] Data is NOT sold to third parties (不会将数据出售给第三方)
- [x] Data is NOT used for purposes unrelated to the extension's core functionality (不会将数据用于与扩展核心功能无关的用途)
- [x] Data is NOT used for creditworthiness or lending purposes (不会将数据用于信用评估或借贷用途)

---

## Privacy Policy (隐私政策链接)

**Privacy Policy URL** [REQUIRED]
您的隐私政策在线地址。
*(建议：将项目根目录下的 `PRIVACY.md` 托管到 GitHub Pages 或使用 GitHub 仓库文件的 Raw 链接。)*
例如：
`https://github.com/bingege2025/SolusVM-Sidebar-Dashboard/blob/main/PRIVACY.md` (或对应的 GitHub Pages 地址)

---

## Distribution (分发设置)

- **Visibility (可见性)**: `Public` (公开)
- **Regions (地区)**: `All regions` (所有地区)
- **Pricing (价格)**: `Free` (免费)

---

## Developer Info (开发者信息)

- **Publisher Name (发布者名称)**: 您的开发者名称 (例如: `Bingege` 或您的个人姓名)
- **Contact Email (联系邮箱)**: [REQUIRED] (会公开显示在应用商店中)
- **Support URL (支持网页/反馈地址)**: `https://github.com/bingege2025/SolusVM-Sidebar-Dashboard/issues`

---

## Version History (版本历史)

| 版本号 | 发布日期 | 变更说明 | 状态 |
|---------|------|---------|--------|
| 1.0.0 | 2026-05-30 | 首个正式发布版本。支持多服务器配置、状态展示、开机/关机/重启操作。 | 草稿 (Draft) |
