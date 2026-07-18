# SolusVM VPS Dashboard

A local-only Chrome extension for managing **SolusVM-based VPS servers** from a small browser popup.

This is not a generic VPS monitor. It is built for users who still have budget VPS boxes on SolusVM panels and want a faster way to check provider-side status, bandwidth, and basic power actions without opening each provider panel.

[Chrome Web Store](https://chromewebstore.google.com/detail/solusvm-vps-dashboard/eopncllcllcigednkoegohhmknhibdbc?hl=en)

## Who This Is For

- You manage one or more VPS instances that expose the SolusVM V1 Client API.
- You want to test experimental SolusVM 2 REST API support.
- Your provider still uses SolusVM, for example some budget VPS providers.
- You want quick status/resource checks from Chrome.
- You want reboot, boot, and shutdown actions without loading the full SolusVM panel.
- You prefer a local-only tool with no account, no backend, and no telemetry.

## What It Does

- Manage multiple SolusVM VPS API profiles.
- Select SolusVM v1 or experimental SolusVM 2 per server profile.
- View provider-side status and resource information.
- Check bandwidth, memory, disk, IP, hostname, and node details when available from the API.
- Run reboot, boot, and shutdown actions from the popup.
- Search and filter servers with tags.
- Set a default server.
- Export and import local configuration backups.
- Use cached data first, then refresh in the background.
- Switch between English and Simplified Chinese.
- Blur sensitive fields with privacy mode for screenshots or screen sharing.

## What It Does Not Do

- It does not support Virtualizor, Proxmox, SSH-based monitoring, or generic VPS providers.
- It does not install an agent inside your VPS.
- It does not replace real monitoring systems such as Beszel, Prometheus, Uptime Kuma, or Netdata.
- It does not collect analytics, browsing history, server credentials, or telemetry.

## Privacy And Security

All configuration stays in your browser.

- No backend server.
- No user account.
- No tracking or analytics.
- No third-party proxy.
- API URL, API Key/API Token, and API Hash/API Secret are stored locally with `chrome.storage.local`.
- API requests are sent directly from your browser to the SolusVM endpoint you configure.
- Exported configuration files include API credentials. Keep them private.

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

## Install

### Chrome Web Store

Install from the Chrome Web Store:

https://chromewebstore.google.com/detail/solusvm-vps-dashboard/eopncllcllcigednkoegohhmknhibdbc?hl=en

### Local Development

1. Open Chrome and go to `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this project directory.
5. Open the extension popup and click the settings button.
6. Add your SolusVM API URL, API Key, and API Hash.

## Getting SolusVM API Credentials

1. Log in to your VPS provider's client portal or SolusVM panel.
2. Open the target VPS.
3. Go to the SolusVM API section.
4. Copy the API Key and API Hash.
5. Use the full API endpoint, for example:

```text
https://panel.example.com/api/client/command.php
```

If your provider hides or disables SolusVM Client API access, this extension cannot manage that VPS.

For SolusVM 2, select `SolusVM 2 (experimental)` in settings and use an API token. A full virtual server API URL is recommended, for example:

```text
https://panel.example.com/api/v1/servers/123
```

SolusVM 2 support is experimental because providers may expose different endpoint shapes and response fields. Please open an issue with redacted API responses if your provider does not work.

## Technical Notes

- Chrome Extension Manifest V3.
- SolusVM V1 Client API.
- Experimental SolusVM 2 REST API driver.
- Vanilla JavaScript, HTML, and CSS.
- No framework and no build step.
- Background service worker handles API requests.
- Popup uses stale-while-revalidate style local caching for faster display.

## Suggested GitHub Topics

Use these repository topics to make the project easier to find:

```text
chrome-extension
manifest-v3
solusvm
vps
vps-management
server-management
lowendbox
lowendtalk
racknerd
javascript
```
