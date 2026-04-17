(function domExplorerBlueprint() {
  const TOOLTIP_ID = "dommap-selector-tooltip";
  const HIGHLIGHT_STYLE = "2px solid red";

  let highlightedElement = null;
  let previousOutline = "";
  let previousOutlineOffset = "";

  const tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  Object.assign(tooltip.style, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    background: "rgba(0, 0, 0, 0.85)",
    color: "#fff",
    borderRadius: "4px",
    padding: "4px 6px",
    fontSize: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    maxWidth: "50vw",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "none"
  });
  document.documentElement.appendChild(tooltip);

  function escapeCss(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function getCssSelector(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift(`${tag}#${escapeCss(current.id)}`);
        break;
      }

      let segment = tag;
      if (current.classList.length > 0) {
        segment += `.${Array.from(current.classList).map(escapeCss).join(".")}`;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `:nth-of-type(${index})`;
        }
      }

      path.unshift(segment);
      current = current.parentElement;
      if (path.length >= 6) {
        break;
      }
    }

    return path.join(" > ");
  }

  function clearHighlight() {
    if (!highlightedElement) {
      return;
    }
    highlightedElement.style.outline = previousOutline;
    highlightedElement.style.outlineOffset = previousOutlineOffset;
    highlightedElement = null;
  }

  document.addEventListener("mouseover", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target === tooltip) {
      return;
    }

    if (highlightedElement !== target) {
      clearHighlight();
      highlightedElement = target;
      previousOutline = highlightedElement.style.outline;
      previousOutlineOffset = highlightedElement.style.outlineOffset;
      highlightedElement.style.outline = HIGHLIGHT_STYLE;
      highlightedElement.style.outlineOffset = "0";
    }

    tooltip.textContent = getCssSelector(target);
    tooltip.style.display = "block";
  });

  document.addEventListener("mousemove", (event) => {
    if (tooltip.style.display === "none") {
      return;
    }
    const x = Math.min(event.clientX + 12, window.innerWidth - 20);
    const y = Math.min(event.clientY + 12, window.innerHeight - 20);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  });

  document.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target === highlightedElement) {
      clearHighlight();
      tooltip.style.display = "none";
    }
  });
})();
