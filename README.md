# RackNerd Server Manager - Chrome Extension

A Chrome Extension for managing RackNerd VPS instances (MVP).

## Features

- 🔧 **API Configuration** - Easily configure your SolusVM API URL, Key, and Hash.
- 🏢 **Multi-Server Management** - Add multiple VPS nodes and switch between them seamlessly.
- ⭐ **Set Default Server** - Star any server to make it the default loaded server when opening the extension.
- 🌐 **Global Localization** - Pure centralization of localization dictionary supporting English and Simplified Chinese (defaults to English, toggle manually in Config Center).
- ⚡ **SWR & Combined Requests** - Employs Stale-While-Revalidate (SWR) cache mechanism to display stored server data instantly while silently fetching the latest updates. Combined endpoints to slash network overhead by 50%.
- 🔁 **Power Controls** - One-click Reboot, Boot, and Shutdown controls with clean processing visual states.

## How to Install

1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle on "Developer mode" in the top right corner.
3. Click "Load unpacked" and select this project directory.
4. Click the extension icon → ⚙️ to enter settings.
5. Fill in your SolusVM API credentials (obtained from RackNerd Client Portal).

## How to Get API Info

1. Log in to [RackNerd Client Portal](https://my.racknerd.com)
2. Go to Services → Select your VPS.
3. Click SolusVM Panel to enter the panel dashboard.
4. Go to the API tab to retrieve your **API Key** and **API Hash**.
5. API URL format: `https://xxx.racknerd.com:5656` (extracted from panel URL).

## Technical Overview

- Based on SolusVM V1 Client API.
- Chrome Extension Manifest V3.
- Vanilla JavaScript, HTML, and CSS (framework-free).
