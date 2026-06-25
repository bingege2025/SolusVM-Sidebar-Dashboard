# Chrome Web Store Listing — SolusVM VPS Dashboard

> Last Updated: 2026-05-30

## Store Listing (应用商店信息)

**Extension Name (扩展名称)** [REQUIRED]
`SolusVM VPS Dashboard`
*(必须与 manifest.json 中的 name 保持一致。最多 75 个字符。)*

**Short Description (简短说明)** [REQUIRED]
`Manage SolusVM VPS servers - view status, reboot, boot, and shutdown.`
*(最多 132 个字符。显示在搜索结果和卡片中。内容需具体阐述扩展程序的功能。)*

**Detailed Description (详细说明)** [REQUIRED]
*(最多 16,000 个字符。注：Chrome Web Store 详情页不支持 Markdown 格式，在开发者后台粘贴时请去除 Markdown 标记，使用换行进行分段，不要使用列表符号。)*

```text
【English Description】
A powerful, lightweight, and privacy-first Chrome sidebar extension designed for budget VPS hoarders to centralize and monitor multiple SolusVM instances.

Tired of opening 50 separate browser tabs just to perform a quick reboot or check your node status? The SolusVM Sidebar Dashboard solves this pain point elegantly by bringing all your VPS nodes into a single, cohesive sidebar panel.

🚀 KEY FEATURES:
- Multi-Server & Tag Filtering: Save and manage multiple VPS instances. Quickly filter nodes by custom tags (e.g., location, provider, or purpose) using interactive tag pills.
- Compact Searchable Dropdown: Designed for power users with dozens of nodes. Find servers in milliseconds with built-in instant search.
- Core Power Actions: Perform key tasks (Boot, Reboot, Shutdown) and refresh telemetry directly from the sidebar panel.
- Privacy Shield Mode: Toggle Privacy Mode to instantly blur sensitive information like Hostnames and IP addresses—ideal for screen sharing or screenshots.
- Cache-First Lightning Load: Shows cached metrics immediately upon opening, asynchronously pulling real-time stats in the background to bypass network latency.
- Native Dual-Language Support: Fully localized in both English and Simplified Chinese (简体中文), dynamically matching your browser's preference.

🔒 PRIVACY & SECURITY FIRST:
When managing infrastructure, code transparency is everything. 
- 100% Client-Side: Runs entirely inside your local browser environment with zero external server dependencies.
- Zero Data Collection: Your SolusVM API URL, Keys, and Hashes are never transmitted, aggregated, or shared with third parties.
- Secured Local Storage: Saved safely inside your browser's encrypted local storage (`chrome.storage.local`).
- Robust Self-Healing: Includes smooth legacy data migration and auto-reload on extension updates to prevent crashes or context invalidation.

Perfect for administrators managing servers across multiple VPS providers (such as RackNerd and more). Fully open-source and community-driven. Get your VPS fleet under control today!


【中文说明】
SolusVM VPS Dashboard 是一款专为拥有多台 VPS 的“囤鸡玩家”与系统管理员量身打造的 Chrome 浏览器扩展。支持在侧边栏或弹出窗口中集中管理和实时监控多台运行 SolusVM 面板的 VPS 节点，免去反复登录服务商后台和打开数十个浏览器标签页的烦恼。

🚀 核心功能：
- 多服务器与标签过滤：支持保存多台服务器配置，并可使用自定义标签（如服务商、地区或用途）进行快速过滤和归类。
- 智能搜索下拉列表：专为拥有多节点的用户设计，支持极速模糊搜索，毫秒级定位目标服务器。
- 便捷服务器控制：支持直接在面板中一键执行开机 (Boot)、关机 (Shutdown) 和重启 (Reboot) 指令。
- 隐私隐藏模式：一键模糊敏感的主机名和 IP 地址，方便在演示、屏幕共享或截屏时保护您的凭证安全。
- 缓存优先闪电加载：打开面板时瞬间渲染本地缓存的性能指标，随后在后台异步获取最新状态，彻底解决网络延迟带来的卡顿感。
- 原生双语与暗色主题：完美支持中英文双语，可随浏览器系统语言自适应切换，并支持亮色/暗色主题。

🔒 隐私与安全承诺：
管理服务器资产时，安全与透明高于一切。
- 100% 纯客户端运行：所有网络请求由扩展直接发往您的 VPS 接口，无任何外部中转服务器，不经过任何第三方代理。
- 零数据收集：我们不会收集、上传或共享您的 API 密钥、IP 地址等任何个人数据。
- 浏览器安全存储：所有敏感凭证（API URL/Key/Hash）均安全地保存在您本地浏览器的沙盒存储中 (chrome.storage.local)。
- 升级平滑保障：支持老版本数据自动升级迁移；版本更新时已打开的页面可自动重载，杜绝因版本冲突导致的使用中断。
```

**Category (类别)** [REQUIRED]
`Developer Tools` (开发者工具) 或 `Productivity` (生产力工具)

**Single Purpose (单一用途声明)** [REQUIRED]
`通过 SolusVM API 提供便捷的 VPS 状态监控与基础控制操作。`
*(用一句话描述，必须狭窄且易于理解。例如：“通过 SolusVM API 管理和监控您的 VPS 状态并执行基础控制操作。”)*

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
| `https://*/*` | host_permissions | Required to make fetch requests directly to user-configured SolusVM panel URLs, which may reside on custom provider domains, to retrieve server statuses and send control commands (reboot/shutdown/boot). |

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
