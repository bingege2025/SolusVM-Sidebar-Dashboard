#!/bin/bash
# Generate simple SVG icon and convert to PNG (requires canvas or manual replacement)
# Since there is no ImageMagick, we use SVG as placeholder
# Chrome automatically scales SVG when installing, but manifest requires PNG
# It is recommended to manually replace with actual PNG icons

cd ~/projects/servermanger/icons

# Create simple SVG icon
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
