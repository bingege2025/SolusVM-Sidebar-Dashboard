# Changelog

All notable changes to VPS Dashboard are documented here.

## 1.6.0 - 2026-08-03

### Added

- Expiry reminder for every panel type (SolusVM v1/v2, VirtFusion, Virtualizor, Proxmox, Hetzner, DigitalOcean, AWS EC2, AWS Lightsail).
- Per-server expiry date field in settings; the extension computes days remaining and warns you before a server lapses.
- Global "remind N days before expiry" preference (default 7 days).
- In-popup reminder: a colored banner on the server detail view and an Expires row when a date is set; upcoming expirations also surface as chips in the batch list.
- Expiry date and reminder threshold are included in config export/import.

## 1.5.1 - 2026-07-31

### Added

- Static landing page for Chrome Web Store and search traffic.
- Provider-specific setup guides for SolusVM v1, AWS EC2, SolusVM v2, and VirtFusion.
- Setup guide links in the extension settings page based on the selected panel type.

## 1.5.0 - 2026-07-30

### Added

- Multi-provider dashboard positioning.
- AWS EC2 support: instance status and power control, EBS disk size (via DescribeVolumes), and monthly network traffic (via CloudWatch NetworkIn/Out).
- Experimental VirtFusion support.
- Batch refresh, reboot, and shutdown actions.
- Server selection for batch operations.
- Server config copy action.
- New extension icon.
- Chrome Web Store marketing screenshots.

### Changed

- Renamed product to "VPS Dashboard — Multi-Provider VPS Manager" (from a SolusVM-focused sidepanel).
- Panel type selector now supports SolusVM v1, SolusVM v2 (experimental), VirtFusion (experimental), and AWS EC2.
- Improved config page spacing and layout.
- Improved popup UI for multi-server and multi-provider usage.
- Power buttons now adapt to server state where supported.
- Actions refresh status after completion.

### Fixed

- EC2 reboot/shutdown reliability — reuse the existing Instance ID to avoid concurrent-fetch timeouts.
- SolusVM v1 no longer misreads an API-layer success response as a shutdown.
- Corrected memory/disk/bandwidth unit scaling across providers (EC2, Hetzner, Lightsail, Virtualizor).
- More tolerant AWS region/endpoint parsing (handles pasted URLs/domains).

### Notes

- AWS EC2 requires IAM permissions `ec2:DescribeVolumes` and `cloudwatch:GetMetricStatistics` to show disk and traffic.
- SolusVM v2 and VirtFusion support are experimental and may have provider-specific edge cases.
- SolusVM v1 remains supported for existing users.

## 1.4.0 - 2026-07-18

### Added

- Experimental SolusVM 2 API support.
- Config import and export.
- Dark mode.
- Inline reboot and shutdown confirmation.
- Pre-filled GitHub issue feedback link.
- English, Simplified Chinese, German, French, and Russian UI support.

### Fixed

- Deleted server configs no longer remain visible until manual refresh.
- Importing config no longer resets the selected UI language.

## 1.3.0 - 2026-07-12

### Added

- Multi-server profile management.
- Server search and tag filtering.
- Default server support.
- Privacy mode for screenshots and screen sharing.

## 1.2.0 - 2026-07-12

### Added

- Improved popup status display.
- Cache-first loading for faster status checks.

## 1.1.0 - 2026-06-24

### Added

- Initial RackNerd/SolusVM-focused improvements.

## 1.0.0 - 2026-06-22

### Added

- Initial Chrome extension release.
- SolusVM v1 status display.
- Basic reboot and shutdown actions.
