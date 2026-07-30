#!/bin/bash
set -e
# Generate the Chrome extension PNG icons from icons/icon.svg
# This uses the sharp SVG rasterizer (librsvg-based).
#
# In this managed environment sharp is installed at:
export NODE_PATH=/Users/renyb/.workbuddy/binaries/node/workspace/node_modules
NODE=/Users/renyb/.workbuddy/binaries/node/versions/22.22.2/bin/node

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/icons"

if [ ! -d "$NODE_PATH/sharp" ]; then
  echo "sharp not found at $NODE_PATH/sharp"
  echo "Install it with: npm install sharp"
  exit 1
fi

"$NODE" -e '
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const dir = process.cwd();
const svg = fs.readFileSync(path.join(dir, "icon.svg"));
(async () => {
  for (const size of [16, 48, 128]) {
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path.join(dir, "icon" + size + ".png"));
    console.log("icons/icon" + size + ".png");
  }
})().catch(e => { console.error(e); process.exit(1); });
'

echo "Icon PNGs regenerated from icon.svg"
