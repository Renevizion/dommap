(function domExplorerBlueprint() {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────
  const TOOLTIP_ID  = "dommap-tooltip";
  const XRAY_ID     = "dommap-xray-overlay";
  const MAX_CARDS   = 400;      // max DOM cards rendered in 3D view
  const MIN_SIZE    = 6;        // px — skip elements smaller than this
  const MIN_ZOOM    = 0.35;
  const MAX_ZOOM    = 3;

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
      "<span>🖱 <b>Drag</b> rotate</span>" +
      "<span>🛞 <b>Wheel</b> zoom</span>" +
      "<span>🖱 <b>Click</b> focus context</span>" +
      "<span>⌨ <b>Esc</b> close</span>";
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

    const resetFocusBtn = document.createElement("button");
    Object.assign(resetFocusBtn.style, {
      position: "absolute",
      top: "10px",
      right: "106px",
      zIndex: "20",
      background: "rgba(0, 90, 160, 0.22)",
      color: "#9ed8ff",
      border: "1px solid rgba(80,160,255,0.45)",
      borderRadius: "6px",
      padding: "5px 12px",
      cursor: "pointer",
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      display: "none",
    });
    resetFocusBtn.textContent = "↺ Reset Focus";
    xrayOverlay.appendChild(resetFocusBtn);

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
    countBadge.textContent = `${collected.length} elements  ·  max depth ${maxDepth}`;
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
    infoBar.textContent = "Hover to inspect · click a card to focus its connected context";
    xrayOverlay.appendChild(infoBar);

    // ── 3D scene ──────────────────────────────────────────────────────────
    const scene = document.createElement("div");
    Object.assign(scene.style, {
      position: "absolute",
      inset: "0",
      perspective: "1400px",
      perspectiveOrigin: "50% 46%",
    });

    // Initial camera values
    let rotX = 28, rotY = -18, zoom = 1;

    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute",
      inset: "0",
      transformStyle: "preserve-3d",
      transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      transformOrigin: "50% 50%",
      willChange: "transform",
    });

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function setAlpha(color, alpha) { return color.replace(/[\d.]+\)$/, `${alpha})`); }
    function applyStageTransform() {
      stage.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${zoom})`;
    }

    const cards = [];
    let focusedNode = null;

    function relationToFocus(node) {
      if (!focusedNode) return "";
      if (node === focusedNode) return "focus";
      if (focusedNode.contains(node)) return "child";
      if (node.contains(focusedNode)) return "parent";
      return "";
    }

    function renderCards() {
      cards.forEach((entry) => {
        const relation = relationToFocus(entry.node);
        const hovered = entry.hovered;
        const card = entry.card;
        let bg = entry.bgColor;
        let bd = entry.bdColor;
        let opacity = 1;
        let shadow = "";
        let z = entry.zOffset;

        if (focusedNode) {
          if (relation === "focus") {
            bg = setAlpha(entry.bgColor, 0.8);
            bd = setAlpha(entry.bdColor, 1);
            shadow = `0 0 16px ${entry.bdColor}, 0 0 9px rgba(255,255,255,0.2)`;
            z += Z_STEP * 5;
          } else if (relation) {
            bg = setAlpha(entry.bgColor, 0.6);
            bd = setAlpha(entry.bdColor, 0.95);
            shadow = `0 0 10px ${entry.bdColor}`;
            opacity = 0.92;
            z += Z_STEP * 2;
          } else {
            opacity = 0.12;
            bg = setAlpha(entry.bgColor, 0.08);
            bd = setAlpha(entry.bdColor, 0.2);
          }
        }

        if (hovered) {
          bg = setAlpha(entry.bgColor, focusedNode ? 0.72 : 0.55);
          bd = setAlpha(entry.bdColor, 0.97);
          shadow = `0 0 14px ${entry.bdColor}, 0 0 5px rgba(255,255,255,0.08)`;
          opacity = Math.max(opacity, focusedNode ? 0.96 : 1);
          z += Z_STEP;
        }

        card.style.background  = bg;
        card.style.borderColor = bd;
        card.style.boxShadow   = shadow;
        card.style.opacity     = String(opacity);
        card.style.transform   = `translateZ(${z}px)`;
      });
    }

    function clearFocus() {
      focusedNode = null;
      resetFocusBtn.style.display = "none";
      infoBar.textContent = "Hover to inspect · click a card to focus its connected context";
      renderCards();
    }

    function setFocus(node) {
      focusedNode = node;
      resetFocusBtn.style.display = "inline-block";
      zoom = clamp(Math.max(zoom, 1.2), MIN_ZOOM, MAX_ZOOM);
      applyStageTransform();
      infoBar.textContent = `Focused: ${getCssSelector(node)}  ·  showing parents + children`;
      renderCards();
    }

    resetFocusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearFocus();
    });

    // ── Cards ─────────────────────────────────────────────────────────────
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
      const cardState = { card, node, bgColor, bdColor, zOffset, hovered: false };
      cards.push(cardState);

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
        cardState.hovered = true;
        renderCards();
        infoBar.textContent    = getCssSelector(node);
      });
      card.addEventListener("mouseleave", () => {
        cardState.hovered = false;
        renderCards();
        if (focusedNode) {
          infoBar.textContent = `Focused: ${getCssSelector(focusedNode)}  ·  showing parents + children`;
        } else {
          infoBar.textContent = "Hover to inspect · click a card to focus its connected context";
        }
      });

      // Click: keep view open and focus selected node's connected context
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const sel = getCssSelector(node);
        setFocus(node);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(sel).catch(() => {});
        }
      });

      stage.appendChild(card);
    });

    scene.appendChild(stage);
    xrayOverlay.appendChild(scene);
    renderCards();

    // ── Drag-to-rotate ────────────────────────────────────────────────────
    let dragging = false, dragX = 0, dragY = 0;

    function onMouseDown(e) {
      if (e.target === closeBtn || e.target === resetFocusBtn) return;
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
    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseup",    onMouseUp);

    function onWheel(e) {
      e.preventDefault();
      zoom = clamp(
        zoom * (e.deltaY > 0 ? 0.92 : 1.09),
        MIN_ZOOM,
        MAX_ZOOM
      );
      applyStageTransform();
    }
    xrayOverlay.addEventListener("wheel", onWheel, { passive: false });

    // Escape key
    function onKeyDown(e) {
      if (e.key === "Escape") {
        closeXRayView();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoom = clamp(zoom * 1.12, MIN_ZOOM, MAX_ZOOM);
        applyStageTransform();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoom = clamp(zoom * 0.9, MIN_ZOOM, MAX_ZOOM);
        applyStageTransform();
      } else if (e.key === "0") {
        e.preventDefault();
        zoom = 1;
        applyStageTransform();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    // Cleanup registry
    xrayOverlay._cleanup = () => {
      document.documentElement.style.overflow = savedOverflow;
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseup",    onMouseUp);
      xrayOverlay.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown",  onKeyDown);
    };

    // ── Animate in ────────────────────────────────────────────────────────
    stage.style.opacity   = "0";
    stage.style.transform = "rotateX(0deg) rotateY(0deg) scale(0.88)";
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
