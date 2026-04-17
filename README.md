# dommap

Minimal Chrome extension (Manifest V3) for visually mapping page DOM targets.

## Files

- `manifest.json` — extension manifest
- `content.js` — hover inspector logic

## What it does

When active on a page, hovering an element will:

- add a `2px` red outline to the hovered element
- show a floating tooltip with a generated CSS selector for that element

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder
