#!/bin/bash
# package-extension.sh — 打包 Chrome 扩展，仅包含运行所需文件
set -e

cd "$(dirname "$0")"

EXTENSION_NAME="vps-dashboard"
VERSION=$(grep -o '"version"\s*:\s*"[^"]*"' manifest.json | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
OUTPUT="${EXTENSION_NAME}-v${VERSION}.zip"

rm -f "$OUTPUT"

echo "Packaging ${EXTENSION_NAME} v${VERSION}..."

# 只显式包含运行所需文件；icons/icon.svg 是图标源文件，不打包
zip -r "$OUTPUT" \
  manifest.json \
  background.js \
  i18n.js \
  shared.js \
  ics-generator.js \
  expiry-reminder.js \
  popup.html popup.js \
  options.html options.js \
  icons \
  logos \
  _locales \
  -x "icons/icon.svg" \
  -x "*.DS_Store" \
  -x "__MACOSX/*"

echo "✅ Done: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "Upload this ZIP to the Chrome Developer Dashboard."
