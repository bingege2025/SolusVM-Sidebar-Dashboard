# RackNerd Server Manager - Chrome Extension

管理 RackNerd 服务器的 Chrome 浏览器插件（MVP）。

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
5. 填写 SolusVM API 信息（在 RackNerd 客户后台获取）

## 获取 API 信息

1. 登录 [RackNerd 客户后台](https://my.racknerd.com)
2. Services → 选择你的 VPS
3. 点击 SolusVM Panel 进入面板
4. 在 API 标签页获取 **API Key** 和 **API Hash**
5. API 地址格式：`https://xxx.racknerd.com:5656`（从面板 URL 获取）

## 技术说明

- 基于 SolusVM V1 API（RackNerd 使用 SolusVM 管理 VPS）
- Chrome Extension Manifest V3
- 纯 JavaScript/HTML/CSS，无框架依赖
