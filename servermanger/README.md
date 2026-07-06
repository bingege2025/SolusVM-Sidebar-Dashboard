# SolusVM VPS Dashboard - Chrome Extension

管理 SolusVM VPS 服务器的 Chrome 浏览器插件。

## 功能

- 🔧 **配置 API** - 设置 SolusVM API 地址、Key 和 Hash
- 🏢 **多服务器管理** - 友好添加多台 VPS，在各台服务器之间极其快捷、方便地一切即换
- ⭐ **设置默认服务器** - 支持金星一键标星某台服务器，作为每次重新开启插件时的默认加载服务器
- 🌐 **全局多语言集成** - 独立语言库集中管理，支持简体中文与 English，可根据需要一键手动切换（默认使用英文）
- ⚡ **SWR 极速响应与接口合并** - 采用 Stale-While-Revalidate 机制，秒开渲染缓存，同时后台异步静默刷新数据，且请求数缩减 50%，消除加载慢的瓶颈
- 🔁 **重启服务器** - 一键重启/开机/关机，并增加智能防频闪操作等待机制

## 使用方法

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录
4. 点击插件图标 → ⚙️ 进入设置
5. 填写 SolusVM API 信息（在您的 VPS 控制面板中获取）

## 获取 API 信息

1. 登录您的 VPS 服务商后台或 SolusVM 面板
2. 选择目标 VPS 并进入 SolusVM 面板
3. 在 API 标签页获取 **API Key** 和 **API Hash**
4. 复制完整 API 地址，例如：`https://panel.example.com/api/client/command.php`

## 技术说明

- 基于 SolusVM V1 API
- Chrome Extension Manifest V3
- 纯 JavaScript/HTML/CSS，无框架依赖
