# dommap — DOM Explorer Blueprint

A Chrome extension (Manifest V3) that turns any page into an **immersive, interactive 3D blueprint** of its DOM structure — designed to help you map CRM interfaces, identify scriptable elements, and copy precise CSS selectors instantly.

---

## Features

| Feature | How it works |
|---|---|
| **Hover Inspector** | Hover any element → red outline + floating tooltip showing its CSS selector |
| **3D X-Ray View** | Explodes the full DOM into depth-stacked glass panes you can drag to rotate |
| **Click-to-select** | Click any card in the 3D view → highlights element on page, copies selector to clipboard |
| **Toggle** | Enable / disable the inspector from the toolbar popup without uninstalling |
| **Persisted state** | Your on/off preference is saved between browser sessions |

---

## Install in Chrome

> No build step. No npm. Just three clicks.

1. **Clone or download** this repository  
   ```
   git clone https://github.com/Renevizion/dommap.git
   ```

2. Open Chrome and go to **`chrome://extensions`**

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** → select the `dommap` folder

5. The **DOM Explorer Blueprint** icon appears in your toolbar. Pin it for easy access.

---

## Usage

### Hover Inspector (always on when enabled)

- Move your cursor over any element on a page
- A **red outline** highlights the element
- A **dark tooltip** shows the generated CSS selector (e.g. `div.panel > button.save-btn`)

### 3D X-Ray View

Open it two ways:

| Method | Action |
|---|---|
| Toolbar popup | Click the extension icon → **Open 3D X-Ray View** |
| Keyboard | Press **`Alt + D`** on any page |

Once open:

- **Drag** anywhere to rotate the 3D scene
- **Hover** a card to see its CSS selector in the info bar
- **Click** a card to: close the view, scroll the real element into view, flash it with a teal outline, and **copy its selector to your clipboard**
- Press **`Esc`** or click **✕ Close** to exit

### Popup toggle

Click the toolbar icon to open the popup:

- Toggle **Hover Inspector** on or off (state is saved)
- Launch the **3D X-Ray View** directly from the button

---

## Element colour guide

| Colour | Element types |
|---|---|
| 🟦 Blue | Structural — `div`, `section`, `article`, `header`, `nav` … |
| 🟣 Purple | Headings — `h1` – `h6` |
| 🟢 Green | Text — `p`, `span`, `li`, `label` … |
| 🟠 Orange | Interactive — `button`, `a`, `select` |
| 🟡 Yellow | Form fields — `input`, `textarea` |
| 🩷 Pink | Media — `img`, `video`, `svg`, `canvas` |
| 🩵 Teal | Tables — `table`, `tr`, `td`, `th` |

---

## Files

```
dommap/
├── manifest.json   MV3 extension manifest
├── background.js   Service worker — persists enabled state
├── content.js      Hover inspector + 3D X-Ray view (injected into every page)
├── popup.html      Toolbar popup UI
├── popup.js        Popup logic (toggle, launch 3D view)
└── icons/
    └── icon.svg    Extension icon
```

