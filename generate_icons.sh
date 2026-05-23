#!/bin/bash
# 生成简单的 SVG 图标并转为 PNG（需要 canvas 或手动替换）
# 由于没有 ImageMagick，这里用 SVG 占位
# 安装插件时 Chrome 会自动缩放 SVG，但 manifest 要求 PNG
# 建议手动替换为实际 PNG 图标

cd ~/projects/servermanger/icons

# 创建简单 SVG 图标
cat > icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="16" fill="#4a90d9"/>
  <text x="64" y="80" text-anchor="middle" font-size="64" fill="white">🖥</text>
</svg>
EOF

echo "SVG icon created. For production, convert to PNG using:"
echo "  npx sharp-cli -i icon.svg -o icon16.png resize 16"
echo "  npx sharp-cli -i icon.svg -o icon48.png resize 48"  
echo "  npx sharp-cli -i icon.svg -o icon128.png resize 128"
