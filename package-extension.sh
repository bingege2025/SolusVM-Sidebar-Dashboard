#!/bin/bash
# package-extension.sh — 用于打包 Chrome 扩展程序，排除开发和无关文件

EXTENSION_NAME="solusvm-vps-dashboard"
VERSION=$(node -p "require('./manifest.json').version")
OUTPUT="${EXTENSION_NAME}-v${VERSION}.zip"

# 清理旧的压缩包
rm -f "$OUTPUT"

echo "正在打包扩展程序 $EXTENSION_NAME v$VERSION..."

# 打包文件，排除 Git、Node、脚本和文档等开发文件
zip -r "$OUTPUT" . \
  -x ".git/*" \
  -x "__MACOSX/*" \
  -x "servermanger/*" \
  -x "node_modules/*" \
  -x ".env" \
  -x "*.map" \
  -x "CHROMEWEBSTORE.md" \
  -x "PRIVACY.md" \
  -x ".DS_Store" \
  -x "Thumbs.db" \
  -x "*.sh" \
  -x "*.zip" \
  -x ".gitignore"

if [ -f "$OUTPUT" ]; then
  echo "✅ 打包成功: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
  echo "提示: 您可以直接上传此 ZIP 文件至 Chrome 开发者后台。"
else
  echo "❌ 打包失败，请检查 zip 命令是否可用。"
fi
