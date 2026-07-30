# VPS Dashboard

> **Build tools for VPS users.** VPS Dashboard is one of them.

A local-first Chrome extension for managing VPS servers across multiple providers and control panels from one browser sidebar.

VPS Dashboard started as a small SolusVM sidepanel tool. Since v1.5.0, it has moved toward a multi-provider VPS dashboard: SolusVM, AWS EC2, and experimental VirtFusion support in one lightweight interface.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/solusvm-vps-dashboard/eopncllcllcigednkoegohhmknhibdbc?hl=en) · [Changelog](./CHANGELOG.md)

## Supported Providers And Panels

- [x] SolusVM v1
- [x] AWS EC2
- [x] SolusVM v2 experimental
- [x] VirtFusion experimental
- [ ] AWS Lightsail
- [ ] Virtualizor
- [ ] Proxmox VE
- [ ] Hetzner Cloud
- [ ] DigitalOcean

If your provider behaves differently, please open an issue with redacted API responses. Do not include API keys, tokens, IP addresses, or hostnames.

## Who This Is For

- You manage VPS instances across SolusVM, VirtFusion, or AWS EC2.
- You want quick status, bandwidth, memory, disk, and IP checks from Chrome.
- You want reboot, boot, shutdown, or batch actions without opening each provider panel.
- You prefer a local-only tool with no account, no backend, and no telemetry.

## Features

- Multi-provider server profiles.
- Per-server panel driver selection.
- Server status and resource overview.
- Reboot, boot, and shutdown actions.
- Batch refresh, reboot, and shutdown.
- Server search and tag filters.
- Default server selection.
- Config import and export.
- Cache-first loading for faster popup display.
- Dark mode and light mode.
- Privacy mode for screenshots or screen sharing.
- UI languages: English, 简体中文, Deutsch, Français, Русский.

## Privacy

All configuration stays in your browser.

- No backend server.
- No user account.
- No tracking or analytics.
- No third-party proxy.
- API credentials are stored locally with `chrome.storage.local`.
- API requests are sent directly from your browser to the provider endpoint you configure.
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
5. Open the extension popup and click the settings icon.
6. Add a server profile and choose the matching provider or panel type.

## API Credentials

Credential requirements vary by provider.

- **SolusVM v1**: API URL, API Key, and API Hash from your provider's SolusVM panel.
- **SolusVM v2 experimental**: API URL and API token.
- **VirtFusion experimental**: API URL and API token.
- **AWS EC2**: AWS Region, Access Key ID, and Secret Access Key from AWS IAM.

If your provider disables API access, this extension cannot manage that VPS.

## Technical Notes

- Chrome Extension Manifest V3.
- Vanilla JavaScript, HTML, and CSS.
- No framework and no build step.
- Background service worker handles provider API calls.
- Multi-driver architecture for provider-specific API behavior.
- Legacy config migration for older SolusVM-only installs.

## Repository Topics

Suggested GitHub topics:

```text
chrome-extension
manifest-v3
vps
vps-management
vps-dashboard
server-management
multi-provider
solusvm
virtfusion
aws-ec2
lowendbox
lowendtalk
javascript
```
