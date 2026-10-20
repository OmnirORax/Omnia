import { useEffect, useRef } from "react";
import { useUI } from "./context";
import { nameSymbol } from "./nameSymbols";
import { UIField } from "./UIField";

const captions =
  "button,label,legend,summary,h1,h2,h3,h4,h5,h6,strong,dt,th,.binding-row > span,.ui-editable-label,[data-ui-name]";
const selector = `${captions},[title],input,select,textarea`;
const scope =
  ".workbench,.floating-window,.ui-workspace-overlay,[data-ui-resident-root],.ui-background-menu,.ui-selection-tools,[data-ui-search]";
const ignored = "[data-shortcut-runner],omnium-appearance-recovery,[data-ui-name-ignore]";

/** Read a caption without including selected option values, typed content or shortcut hints. */
function caption(element: Element): string {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    else if (
      node instanceof Element &&
      !node.matches("input,select,textarea,output,button,.ui-shortcut-label,[data-ui-name-value]")
    )
      text += caption(node);
  }
  return text.replace(/\s+/g, " ").trim();
}

/** CSS presentation only: never replace React children, edit values, or change action identities. */
export function NamePresentation() {
  const ui = useUI(),
    latest = useRef(ui);
  latest.current = ui;
  const scanRef = useRef<() => void>(() => {});
  useEffect(() => {
    let frame = 0;
    const scan = () => {
      frame = 0;
      const active = latest.current;
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        if (!element.closest(scope) || element.closest(ignored)) continue;
        if (
          element.matches("strong") &&
          element.parentElement?.closest("button,label,legend,summary,h1,h2,h3,h4,h5,h6")
        )
          continue;
        const originalTitle = element.getAttribute("title");
        if (originalTitle && !element.dataset.uiNameFallback)
          element.dataset.uiNameFallback = originalTitle.split(/\s*·\s*|;\s*/)[0];
        const ownText = caption(element);
        const name =
          element.dataset.uiName ||
          (!element.dataset.uiPresentationAria && element.getAttribute("aria-label")) ||
          ownText ||
          element.dataset.uiNameFallback;
        if (!name) continue;
        // Every named control retains an accessible name, even in symbol-only mode.
        if (element.matches("button") && !element.hasAttribute("aria-label")) {
          element.setAttribute("aria-label", name);
          element.dataset.uiPresentationAria = "true";
        } else if (
          element.dataset.uiPresentationAria &&
          ownText &&
          !element.dataset.uiName &&
          element.getAttribute("aria-label") !== ownText
        ) {
          element.setAttribute("aria-label", ownText);
        }
        const tooltip = active.layout.hideNames ? name : "";
        if (element.title !== tooltip) element.title = tooltip;
        const custom =
          element.matches(".function-icon,[data-ui-native-icon]") ||
          !!element.closest(".icon-handle,[data-ui-control]");
        const asset = !!element.querySelector("img,svg,canvas,.appearance-icon-mask");
        // Existing glyph-only controls already have a symbol; do not add another.
        const namedText = /[\p{L}\p{N}]/u.test(ownText);
        const decoratable = element.matches(captions);
        if (!decoratable || custom || !namedText) {
          delete element.dataset.uiNameSymbol;
          continue;
        }
        if (!element.dataset.uiNameSymbol) {
          const size = getComputedStyle(element).fontSize;
          element.style.setProperty("--ui-name-size", parseFloat(size) > 0 ? size : "12px");
        }
        const id =
          element.dataset.uiDrag ||
          element.dataset.uiFunction ||
          element.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ||
          "";
        element.dataset.uiNameSymbol = asset
          ? ""
          : element.dataset.uiSymbol || nameSymbol(id, name);
      }
    };
    scanRef.current = scan;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "title",
        "aria-label",
        "data-ui-name",
        "data-ui-symbol",
        "data-ui-native-icon",
      ],
    });
    scan();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.documentElement.removeAttribute("data-ui-hide-names");
    };
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ui-hide-names", !!ui.layout.hideNames);
    scanRef.current();
  }, [ui.layout.hideNames, ui.functions]);
  return null;
}

export function NameVisibilityControl() {
  const ui = useUI();
  return (
    <UIField id="ui:hideNames" label="Hide names" category="Appearance">
      <label>
        <input
          type="checkbox"
          aria-label="Hide names"
          checked={!!ui.layout.hideNames}
          onChange={(event) =>
            ui.update((layout) => ({ ...layout, hideNames: event.target.checked }))
          }
        />
        Hide names
      </label>
    </UIField>
  );
}
