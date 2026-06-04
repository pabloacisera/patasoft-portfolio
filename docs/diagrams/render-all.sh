#!/bin/bash
# Render all Mermaid diagrams to PNG
# Requires: mmdc (npm install -g @mermaid-js/mermaid-cli)
# Usage: ./render-all.sh [theme] [background]
#   theme: default, dark, forest, neutral (default: dark)
#   background: hex color or transparent (default: transparent)

THEME="${1:-dark}"
BG="${2:-transparent}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Rendering all .mmd files in $DIR..."
echo "Theme: $THEME | Background: $BG"
echo ""

find "$DIR" -name '*.mmd' | while read -r file; do
    out="${file%.mmd}.png"
    echo "  -> $(basename "$file")"
    mmdc -i "$file" -o "$out" -t "$THEME" -b "$BG" -q
    if [ $? -eq 0 ]; then
        echo "     OK: $out"
    else
        echo "     FAIL: $file"
    fi
done

echo ""
echo "Done."
