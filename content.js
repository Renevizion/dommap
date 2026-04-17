(function domExplorerBlueprint() {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────
  const TOOLTIP_ID  = "dommap-tooltip";
  const XRAY_ID     = "dommap-xray-overlay";
  const MAX_CARDS   = 400;      // max DOM cards rendered in 3D view
  const MIN_SIZE    = 6;        // px — skip elements smaller than this

  // ── State ──────────────────────────────────────────────────────────────────
  let enabled      = true;
  let xrayOpen     = false;
  let hoveredEl    = null;
  let prevOutline  = "";
  let prevOffset   = "";
  let xrayOverlay  = null;

  // Restore persisted enabled state (chrome API available in content scripts)
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.local.get("enabled", (r) => {
      enabled = r.enabled !== false;
    });
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  Object.assign(tooltip.style, {
    position:    "fixed",
    zIndex:      "2147483647",
    pointerEvents: "none",
    background:  "rgba(4, 10, 26, 0.92)",
    color:       "#00d4ff",
    borderRadius: "4px",
    padding:     "4px 9px",
    fontSize:    "11px",
    fontFamily:  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    maxWidth:    "54vw",
    whiteSpace:  "nowrap",
    overflow:    "hidden",
    textOverflow: "ellipsis",
    display:     "none",
    border:      "1px solid rgba(0, 212, 255, 0.3)",
    boxShadow:   "0 2px 10px rgba(0, 0, 0, 0.6)",
  });
  document.documentElement.appendChild(tooltip);

  // ── CSS selector builder ───────────────────────────────────────────────────
  function escapeCss(v) {
    return (window.CSS && CSS.escape) ? CSS.escape(v)
      : String(v).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function getCssSelector(el) {
    if (!(el instanceof Element)) return "";
    const path = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      const tag = cur.tagName.toLowerCase();
      if (cur.id) { path.unshift(`${tag}#${escapeCss(cur.id)}`); break; }
      let seg = tag;
      if (cur.classList.length) {
        seg += "." + [...cur.classList].map(escapeCss).join(".");
      }
      const parent = cur.parentElement;
      if (parent) {
        const sib = [...parent.children].filter(c => c.tagName === cur.tagName);
        if (sib.length > 1) seg += `:nth-of-type(${sib.indexOf(cur) + 1})`;
      }
      path.unshift(seg);
      cur = cur.parentElement;
      if (path.length >= 6) break;
    }
    return path.join(" > ");
  }

  // ── Hover inspector ────────────────────────────────────────────────────────
  function clearHighlight() {
    if (!hoveredEl) return;
    hoveredEl.style.outline      = prevOutline;
    hoveredEl.style.outlineOffset = prevOffset;
    hoveredEl = null;
  }

  document.addEventListener("mouseover", (e) => {
    if (!enabled) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.id === TOOLTIP_ID || t.id === XRAY_ID) return;
    if (xrayOverlay && xrayOverlay.contains(t)) return;

    if (hoveredEl !== t) {
      clearHighlight();
      hoveredEl   = t;
      prevOutline = t.style.outline;
      prevOffset  = t.style.outlineOffset;
      t.style.outline      = "2px solid #ff3b3b";
      t.style.outlineOffset = "0";
    }
    tooltip.textContent   = getCssSelector(t);
    tooltip.style.display = "block";
  });

  document.addEventListener("mousemove", (e) => {
    if (!enabled || tooltip.style.display === "none") return;
    tooltip.style.left = `${Math.min(e.clientX + 14, window.innerWidth  - 230)}px`;
    tooltip.style.top  = `${Math.min(e.clientY + 14, window.innerHeight -  30)}px`;
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target === hoveredEl) {
      clearHighlight();
      tooltip.style.display = "none";
    }
  });

  // ── Element colour palette ─────────────────────────────────────────────────
  const BG = {
    div: "rgba(28,60,130,0.22)", section: "rgba(28,60,130,0.22)",
    article: "rgba(28,60,130,0.22)", main: "rgba(28,60,130,0.22)",
    header: "rgba(28,70,140,0.22)", footer: "rgba(28,70,140,0.22)",
    nav: "rgba(28,70,140,0.22)", aside: "rgba(28,70,140,0.22)",
    html: "rgba(10,30,70,0.25)", body: "rgba(10,30,70,0.25)",

    h1: "rgba(110,30,200,0.28)", h2: "rgba(110,30,200,0.28)",
    h3: "rgba(110,30,200,0.28)", h4: "rgba(110,30,200,0.28)",
    h5: "rgba(110,30,200,0.28)", h6: "rgba(110,30,200,0.28)",

    p: "rgba(20,110,55,0.22)", span: "rgba(20,110,55,0.22)",
    label: "rgba(20,110,55,0.22)", li: "rgba(20,110,55,0.22)",
    ul: "rgba(20,110,55,0.22)", ol: "rgba(20,110,55,0.22)",

    button: "rgba(190,85,15,0.35)", a: "rgba(190,85,15,0.28)",
    select: "rgba(190,85,15,0.28)",

    input: "rgba(190,170,15,0.32)", textarea: "rgba(190,170,15,0.32)",
    form: "rgba(190,170,15,0.18)", fieldset: "rgba(190,170,15,0.18)",

    img: "rgba(190,15,95,0.28)", video: "rgba(190,15,95,0.28)",
    canvas: "rgba(190,15,95,0.28)", svg: "rgba(190,15,95,0.28)",
    picture: "rgba(190,15,95,0.28)",

    table: "rgba(15,170,170,0.2)", tr: "rgba(15,170,170,0.2)",
    td: "rgba(15,170,170,0.2)", th: "rgba(15,170,170,0.2)",
  };
  const BD = {
    div: "rgba(60,120,255,0.45)", section: "rgba(60,120,255,0.45)",
    h1: "rgba(170,70,255,0.75)", h2: "rgba(170,70,255,0.75)",
    h3: "rgba(170,70,255,0.7)",  h4: "rgba(170,70,255,0.65)",
    button: "rgba(255,140,45,0.85)", a: "rgba(255,140,45,0.65)",
    input: "rgba(255,215,45,0.85)", textarea: "rgba(255,215,45,0.85)",
    img: "rgba(255,60,150,0.75)", svg: "rgba(255,60,150,0.7)",
    table: "rgba(30,220,220,0.65)", tr: "rgba(30,220,220,0.5)",
    td: "rgba(30,220,220,0.45)",
  };
  function elBg(tag) { return BG[tag] || "rgba(45,45,70,0.2)"; }
  function elBd(tag) { return BD[tag] || "rgba(90,170,255,0.38)"; }

  function elDepth(el) {
    let d = 0, cur = el;
    while (cur.parentElement) { d++; cur = cur.parentElement; }
    return d;
  }

  // ── 3D X-Ray view ─────────────────────────────────────────────────────────
  function buildXRayView() {
    if (xrayOpen) { closeXRayView(); return; }
    xrayOpen = true;

    const savedOverflow = document.documentElement.style.overflow;

    // --- Collect visible elements before overlay exists ---
    const collected = [];
    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_ELEMENT, null
    );
    let node;
    while ((node = walker.nextNode()) && collected.length < MAX_CARDS) {
      try {
        const rect = node.getBoundingClientRect();
        if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) continue;
        const cs = getComputedStyle(node);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        collected.push({ node, rect, depth: elDepth(node) });
      } catch (_) {}
    }

    const maxDepth = collected.reduce((m, e) => Math.max(m, e.depth), 1);
    const Z_STEP   = Math.max(8, Math.min(28, 500 / maxDepth));

    // ── Build overlay ─────────────────────────────────────────────────────
    xrayOverlay = document.createElement("div");
    xrayOverlay.id = XRAY_ID;
    Object.assign(xrayOverlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "rgba(0, 4, 18, 0.93)",
      overflow: "hidden",
      cursor: "default",
    });

    // Help bar (top-center)
    const helpBar = document.createElement("div");
    Object.assign(helpBar.style, {
      position: "absolute",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "20",
      background: "rgba(0,0,0,0.65)",
      color: "rgba(160,210,255,0.85)",
      fontFamily: "ui-monospace, monospace",
      fontSize: "11px",
      padding: "6px 18px",
      borderRadius: "20px",
      border: "1px solid rgba(80,180,255,0.25)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      display: "flex",
      gap: "18px",
    });
    helpBar.innerHTML =
      "<span>🖱 <b>Drag</b> to rotate</span>" +
      "<span>🖱 <b>Wheel</b> to zoom</span>" +
      "<span>🖱 <b>Click</b> element to select</span>" +
      "<span>⌨ <b>Esc</b> to close</span>";
    xrayOverlay.appendChild(helpBar);

    // Close button (top-right)
    const closeBtn = document.createElement("button");
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "10px",
      right: "14px",
      zIndex: "20",
      background: "rgba(200,40,40,0.18)",
      color: "#ffaaaa",
      border: "1px solid rgba(255,80,80,0.4)",
      borderRadius: "6px",
      padding: "5px 14px",
      cursor: "pointer",
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
    });
    closeBtn.textContent = "✕ Close";
    closeBtn.addEventListener("click", closeXRayView);
    xrayOverlay.appendChild(closeBtn);

    // Zoom controls (top-right, below close)
    let zoom = 1;
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 2.5;
    const ZOOM_STEP_IN = 1.08;
    const ZOOM_STEP_OUT = 1 / ZOOM_STEP_IN;
    const ZOOM_IN_KEYS = new Set(["+", "="]);
    const ZOOM_OUT_KEYS = new Set(["-"]);
    const ZOOM_RESET_KEYS = new Set(["0"]);
    const zoomWrap = document.createElement("div");
    Object.assign(zoomWrap.style, {
      position: "absolute",
      top: "44px",
      right: "14px",
      zIndex: "20",
      display: "flex",
      gap: "6px",
      background: "rgba(0,0,0,0.5)",
      border: "1px solid rgba(90,170,255,0.25)",
      borderRadius: "7px",
      padding: "6px",
    });
    xrayOverlay.appendChild(zoomWrap);

    function makeZoomBtn(label, title, onClick) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.title = title;
      Object.assign(btn.style, {
        background: "rgba(20,45,85,0.65)",
        color: "#bfe7ff",
        border: "1px solid rgba(120,190,255,0.38)",
        borderRadius: "5px",
        minWidth: "26px",
        height: "24px",
        padding: "0 7px",
        cursor: "pointer",
        fontFamily: "ui-monospace, monospace",
        fontSize: "12px",
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
      return btn;
    }

    // Element count badge (top-left)
    const countBadge = document.createElement("div");
    Object.assign(countBadge.style, {
      position: "absolute",
      top: "10px",
      left: "14px",
      zIndex: "20",
      background: "rgba(0,0,0,0.55)",
      color: "rgba(100,180,255,0.7)",
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      padding: "5px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(80,140,255,0.2)",
      pointerEvents: "none",
    });
    countBadge.textContent = `${collected.length} elements  ·  max depth ${maxDepth}  ·  zoom 100%`;
    xrayOverlay.appendChild(countBadge);

    // Legend (bottom-right)
    const legend = document.createElement("div");
    Object.assign(legend.style, {
      position: "absolute",
      bottom: "14px",
      right: "14px",
      zIndex: "20",
      background: "rgba(0,0,0,0.65)",
      border: "1px solid rgba(80,180,255,0.18)",
      borderRadius: "8px",
      padding: "10px 14px",
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "rgba(160,210,255,0.75)",
      lineHeight: "1.9",
    });
    legend.innerHTML =
      "<div style='font-weight:bold;color:#c8e8ff;margin-bottom:4px'>Element types</div>" +
      "<div><span style='color:#3c78ff'>■</span> Structural</div>" +
      "<div><span style='color:#b050ff'>■</span> Headings</div>" +
      "<div><span style='color:#28c060'>■</span> Text</div>" +
      "<div><span style='color:#ff9630'>■</span> Interactive</div>" +
      "<div><span style='color:#ffd030'>■</span> Form fields</div>" +
      "<div><span style='color:#ff4098'>■</span> Media</div>" +
      "<div><span style='color:#24d8d8'>■</span> Table</div>";
    xrayOverlay.appendChild(legend);

    // Info bar (bottom-left) — shows hovered selector
    const infoBar = document.createElement("div");
    Object.assign(infoBar.style, {
      position: "absolute",
      bottom: "14px",
      left: "14px",
      right: "180px",
      zIndex: "20",
      background: "rgba(0,0,0,0.65)",
      color: "#00d4ff",
      fontFamily: "ui-monospace, monospace",
      fontSize: "11px",
      padding: "6px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(0,200,255,0.18)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      pointerEvents: "none",
    });
    infoBar.textContent = "Hover an element to see its CSS selector";
    xrayOverlay.appendChild(infoBar);

    // ── 3D scene ──────────────────────────────────────────────────────────
    const scene = document.createElement("div");
    Object.assign(scene.style, {
      position: "absolute",
      inset: "0",
      perspective: "1400px",
      perspectiveOrigin: "50% 46%",
    });

    // Initial rotation angles
    let rotX = 28, rotY = -18;

    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      transformStyle: "preserve-3d",
      transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      transformOrigin: "50% 50%",
      willChange: "transform",
    });

    function applyStageTransform() {
      stage.style.transform = `scale(${zoom}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }

    // ── Cards ─────────────────────────────────────────────────────────────
    let selectedCard = null;
    const SELECTED_CARD_GLOW = "0 0 18px rgba(120,200,255,0.85), 0 0 7px rgba(255,255,255,0.15)";

    function setSelectedCard(card) {
      if (selectedCard && selectedCard !== card) {
        selectedCard.style.boxShadow = "";
      }
      selectedCard = card;
      if (selectedCard) selectedCard.style.boxShadow = SELECTED_CARD_GLOW;
    }

    collected.forEach(({ node, rect, depth }) => {
      const tag     = node.tagName.toLowerCase();
      const bgColor = elBg(tag);
      const bdColor = elBd(tag);
      const zOffset = depth * Z_STEP;

      const card = document.createElement("div");
      Object.assign(card.style, {
        position:    "absolute",
        left:        `${rect.left}px`,
        top:         `${rect.top}px`,
        width:       `${rect.width}px`,
        height:      `${rect.height}px`,
        transform:   `translateZ(${zOffset}px)`,
        background:  bgColor,
        border:      `1px solid ${bdColor}`,
        boxSizing:   "border-box",
        backdropFilter: "blur(1px)",
        cursor:      "pointer",
        overflow:    "hidden",
        transition:  "background 0.12s, border-color 0.12s, box-shadow 0.12s",
      });

      // Label text
      if (rect.height >= 14 && rect.width >= 32) {
        const lbl = document.createElement("span");
        let txt = tag;
        if (node.id) {
          txt += `#${node.id}`;
        } else if (node.className && typeof node.className === "string") {
          const c = node.className.trim().split(/\s+/)[0];
          if (c) txt += `.${c}`;
        }
        Object.assign(lbl.style, {
          display:     "block",
          fontSize:    "9px",
          color:       "rgba(190,230,255,0.82)",
          fontFamily:  "ui-monospace, Consolas, monospace",
          padding:     "1px 3px",
          overflow:    "hidden",
          whiteSpace:  "nowrap",
          textOverflow: "ellipsis",
          pointerEvents: "none",
          lineHeight:  "1.4",
          textShadow:  "0 1px 3px rgba(0,0,0,0.9)",
        });
        lbl.textContent = txt;
        card.appendChild(lbl);
      }

      // Hover: brighten card + show selector
      card.addEventListener("mouseenter", () => {
        card.style.background  = bgColor.replace(/[\d.]+\)$/, "0.55)");
        card.style.borderColor = bdColor.replace(/[\d.]+\)$/, "0.95)");
        card.style.boxShadow   = `0 0 14px ${bdColor}, 0 0 5px rgba(255,255,255,0.08)`;
        infoBar.textContent    = getCssSelector(node);
      });
      card.addEventListener("mouseleave", () => {
        card.style.background  = bgColor;
        card.style.borderColor = bdColor;
        card.style.boxShadow   = (card === selectedCard) ? SELECTED_CARD_GLOW : "";
      });

      // Click: keep view open, focus element card, copy selector
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const sel = getCssSelector(node);
        setSelectedCard(card);
        infoBar.textContent = `${sel}  ·  ${Math.round(rect.width)}×${Math.round(rect.height)}  ·  depth ${depth}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(sel).catch(() => {});
        }
      });

      stage.appendChild(card);
    });

    scene.appendChild(stage);
    xrayOverlay.appendChild(scene);

    function updateCountBadge() {
      countBadge.textContent =
        `${collected.length} elements  ·  max depth ${maxDepth}  ·  zoom ${Math.round(zoom * 100)}%`;
    }

    function updateZoom(delta) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * delta));
      applyStageTransform();
      updateCountBadge();
    }

    function resetZoom() {
      zoom = 1;
      applyStageTransform();
      updateCountBadge();
    }

    const zoomOutBtn = makeZoomBtn("−", "Zoom out", () => updateZoom(ZOOM_STEP_OUT));
    const zoomResetBtn = makeZoomBtn("100%", "Reset zoom", resetZoom);
    const zoomInBtn = makeZoomBtn("+", "Zoom in", () => updateZoom(ZOOM_STEP_IN));
    zoomWrap.appendChild(zoomOutBtn);
    zoomWrap.appendChild(zoomResetBtn);
    zoomWrap.appendChild(zoomInBtn);

    // ── Drag-to-rotate ────────────────────────────────────────────────────
    let dragging = false, dragX = 0, dragY = 0;

    function onMouseDown(e) {
      if (e.target === closeBtn) return;
      dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      xrayOverlay.style.cursor = "grabbing";
    }
    function onMouseMove(e) {
      if (!dragging) return;
      rotY += (e.clientX - dragX) * 0.35;
      rotX -= (e.clientY - dragY) * 0.35;
      rotX   = Math.max(-85, Math.min(85, rotX));
      dragX  = e.clientX;
      dragY  = e.clientY;
      applyStageTransform();
    }
    function onMouseUp() {
      dragging = false;
      xrayOverlay.style.cursor = "default";
    }

    xrayOverlay.addEventListener("mousedown", onMouseDown);
    xrayOverlay.addEventListener("wheel", (e) => {
      e.preventDefault();
      updateZoom(e.deltaY > 0 ? ZOOM_STEP_OUT : ZOOM_STEP_IN);
    }, { passive: false });
    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseup",    onMouseUp);

    // Escape key
    function onKeyDown(e) {
      if (e.key === "Escape") closeXRayView();
      const isZoomInKey = ZOOM_IN_KEYS.has(e.key) || e.code === "NumpadAdd";
      const isZoomOutKey = ZOOM_OUT_KEYS.has(e.key) || e.code === "NumpadSubtract";
      const isZoomResetKey = ZOOM_RESET_KEYS.has(e.key) || e.code === "Digit0" || e.code === "Numpad0";
      if (isZoomInKey) {
        e.preventDefault();
        updateZoom(ZOOM_STEP_IN);
      } else if (isZoomOutKey) {
        e.preventDefault();
        updateZoom(ZOOM_STEP_OUT);
      } else if (isZoomResetKey) {
        e.preventDefault();
        resetZoom();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    // Cleanup registry
    xrayOverlay._cleanup = () => {
      document.documentElement.style.overflow = savedOverflow;
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseup",    onMouseUp);
      document.removeEventListener("keydown",  onKeyDown);
    };

    // ── Animate in ────────────────────────────────────────────────────────
    stage.style.opacity   = "0";
    stage.style.transform = "rotateX(0deg) rotateY(0deg) scale(0.92)";
    document.documentElement.appendChild(xrayOverlay);
    document.documentElement.style.overflow = "hidden";

    requestAnimationFrame(() => requestAnimationFrame(() => {
      stage.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1), opacity 0.35s ease";
      applyStageTransform();
      stage.style.opacity    = "1";
    }));
  }

  function closeXRayView() {
    if (!xrayOpen) return;
    if (xrayOverlay) {
      if (xrayOverlay._cleanup) xrayOverlay._cleanup();
      xrayOverlay.remove();
      xrayOverlay = null;
    }
    xrayOpen = false;
  }

  // ── Keyboard shortcut: Alt+D ───────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      if (enabled) buildXRayView();
    }
  });

  // ── Extension message listener ─────────────────────────────────────────────
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "TOGGLE_ENABLED") {
        enabled = msg.enabled;
        if (!enabled) {
          clearHighlight();
          tooltip.style.display = "none";
          closeXRayView();
        }
      }
      if (msg.type === "OPEN_XRAY" && enabled) {
        buildXRayView();
      }
    });
  }
})();
