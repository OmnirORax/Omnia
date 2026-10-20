import { useEffect, useLayoutEffect, useRef } from "react";
import { useUI } from "./context";
import { functionPinned, ownerOf } from "./layout";
import { stableUIHash } from "./identity";

/** Identity is scoped to the owning frame and structural anchors, never to displayed text.
 * Authors can supply data-ui-id for stability across future markup reorganizations. */
export function nativeActionPath(button: Element, owner: Element): string {
  const parts: string[] = [];
  const logicalChildren = (parent: Element): Element[] => {
    const body = parent.hasAttribute("data-ui-native-tag")
      ? [...parent.children].find(child => child.classList.contains("property-node-contents")) : undefined;
    return [...(body ?? parent).children].flatMap(child => child.getAttribute("data-ui-native-tag") === "transparent" ? logicalChildren(child) : [child]);
  };
  const logicalParent = (child: Element): Element | null => {
    let parent = child.parentElement;
    while (parent && (parent.getAttribute("data-ui-native-tag") === "transparent" || parent.classList.contains("property-node-contents") && parent.parentElement?.hasAttribute("data-ui-native-tag"))) parent = parent.parentElement;
    return parent;
  };
  let element: Element | null = button;
  while (element && element !== owner) {
    // Section chrome is presentation. Preserve IDs from the original source
    // markup when a formerly fixed category acquires a movable frame.
    const tag = element.getAttribute("data-ui-native-tag");
    if (tag === "transparent" || element.classList.contains("property-node-contents") && element.parentElement?.hasAttribute("data-ui-native-tag")) {
      element = element.parentElement;
      continue;
    }
    const logicalTag = tag?.toUpperCase() ?? element.tagName;
    const key = ["data-ui-id", "data-property-node", "data-appearance-target", "id"].find((name) =>
      element!.hasAttribute(name),
    );
    if (key) parts.unshift(`${key}=${element.getAttribute(key)}`);
    else
      parts.unshift(
        `${logicalTag}:${(logicalParent(element) ? logicalChildren(logicalParent(element)!) : []).filter(child => (child.getAttribute("data-ui-native-tag")?.toUpperCase() ?? child.tagName) === logicalTag).indexOf(element)}`,
      );
    element = element.parentElement;
  }
  return parts.join("/");
}
export function captureNativeActions(root: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>("[data-ui-auto-action]")].map((button) => [
      nativeActionPath(button, root),
      button.dataset.uiFunction!,
    ]),
  );
}
export function nativeActionId(button: HTMLButtonElement): string {
  for (
    let group = button.closest<HTMLElement>("[data-ui-inline-group]");
    group;
    group = group.parentElement?.closest<HTMLElement>("[data-ui-inline-group]") ?? null
  ) {
    const identities = JSON.parse(group.dataset.uiActionIds || "{}");
    const id = identities[nativeActionPath(button, group)];
    if (typeof id === "string") return id;
  }
  const owner =
    [...ancestors(button)].find(
      (element) =>
        element.matches("[data-ui-resident-root],.toolbar,.sidebar") &&
        !element.hasAttribute("data-ui-inline-group"),
    ) ?? document.body;
  const path = nativeActionPath(button, owner);
  return `ui:native:${stableUIHash(owner.dataset.uiResidentRoot ?? owner.className)}:${stableUIHash(path)}`;
}
function* ancestors(element: HTMLElement): Generator<HTMLElement> {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) yield parent;
}
const eligible = (button: HTMLButtonElement) =>
  (!button.dataset.uiFunction || !!button.dataset.uiAutoAction) &&
  !!button.closest("[data-ui-resident-root],.toolbar,.sidebar,.ui-workspace-overlay") &&
  !button.closest(
    ".function-appearance,[data-shortcut-runner],[data-ui-palette],[data-ui-search],.ui-frame-handle,[data-ui-inline-handle],[data-ui-control]",
  );
const caption = (button: HTMLButtonElement) => {
  const text = button.textContent?.trim();
  const title = button.dataset.uiNameFallback || (!button.dataset.uiNativeTitle && button.title);
  const label =
    (!button.dataset.uiNativeLabel &&
      !button.dataset.uiPresentationAria &&
      button.getAttribute("aria-label")) ||
    (text && /[\p{L}\p{N}]/u.test(text) ? text : title || text) ||
    "Button";
  return label.replace(/\s+/g, " ").trim().slice(0, 200);
};
type Entry = {
  element: HTMLButtonElement;
  id: string;
  label: string;
  originalName: string | null;
  originalAria: string | null;
  release: () => void;
  context: (event: MouseEvent) => void;
};
const CSS = `
button[data-ui-auto-action][data-ui-native-hidden]{display:none!important}
button[data-ui-auto-action][data-ui-native-icon]{position:relative;display:inline-grid;place-items:center;width:var(--ui-native-width,44px)!important;height:var(--ui-native-height,44px)!important;min-width:0!important;padding:0!important;font-size:0!important;line-height:0!important;text-indent:-99999px!important;overflow:hidden}
button[data-ui-auto-action][data-ui-native-icon]>*{display:none!important}
button[data-ui-auto-action][data-ui-native-icon]::before{content:var(--ui-native-character);display:block;width:70%;height:70%;font:22px/1 system-ui;text-indent:0!important;white-space:nowrap;position:absolute;inset:15%;background-image:var(--ui-native-image);background-size:contain;background-repeat:no-repeat;background-position:center}
button[data-ui-auto-action][data-ui-native-geometry="circle"]{border-radius:50%!important}
button[data-ui-auto-action][data-ui-native-geometry="square"]{border-radius:4px!important}
button[data-ui-auto-action][data-ui-native-geometry="triangle"]{border-radius:0!important;clip-path:polygon(50% 0,100% 100%,0 100%)}
button[data-ui-auto-action][data-ui-native-shortcut]:not([data-ui-caption])::after{content:" (" attr(data-ui-native-shortcut) ")";font:11px/1 system-ui;pointer-events:none}
`;
/** One adapter covers ordinary buttons in every current/future frame. Registered controls
 * retain their existing behavior. Recovery and the customizer itself stay outside discovery. */
export function NativeActions() {
  const ui = useUI(),
    latest = useRef(ui);
  latest.current = ui;
  const entries = useRef(new Map<HTMLButtonElement, Entry>());
  const apply = (entry: Entry) => {
    const { element, id } = entry,
      { layout, shortcutBindings } = latest.current;
    const item = layout.items[id],
      style = item?.style;
    if (element.title && !element.dataset.uiNativeTitle && !element.dataset.uiNameFallback)
      element.dataset.uiNameFallback = element.title.split(/\s*·\s*|;\s*/)[0];
    // Unknown expandable buttons are not complete movable groups. Their declared
    // container must provide the payload; never hide/move a header on its own.
    element.draggable = !element.hasAttribute("aria-expanded") && !functionPinned(layout, id);
    const renamed = layout.labels?.[`function:${id}`];
    if (renamed) {
      element.dataset.uiCaption = renamed;
      element.dataset.uiName = renamed;
      element.setAttribute("aria-label", renamed);
    } else if (element.hasAttribute("data-ui-caption")) {
      delete element.dataset.uiCaption;
      if (entry.originalName === null) delete element.dataset.uiName; else element.dataset.uiName = entry.originalName;
      if (entry.originalAria === null) element.removeAttribute("aria-label"); else element.setAttribute("aria-label", entry.originalAria);
    }
    const title = layout.hideNames ? renamed ?? entry.label : "";
    if (element.title !== title) element.title = title;
    element.dataset.uiNativeTitle = "true";
    element.toggleAttribute(
      "data-ui-native-hidden",
      !!ownerOf(layout, `function:${id}`) || (!!item && (!item.home || !!item.anchorId)),
    );
    element.toggleAttribute("data-ui-native-icon", style?.mode === "icon");
    if (style?.mode === "icon") {
      if (!element.hasAttribute("aria-label") || element.dataset.uiNativeLabel) {
        if (element.getAttribute("aria-label") !== entry.label)
          element.setAttribute("aria-label", entry.label);
        element.dataset.uiNativeLabel = "true";
      }
      element.dataset.uiNativeGeometry = style.geometry;
      element.style.setProperty("--ui-native-width", `${item?.size?.width ?? 44}px`);
      element.style.setProperty("--ui-native-height", `${item?.size?.height ?? 44}px`);
      const asset = layout.assets.find((asset) => asset.id === style.assetId);
      element.style.setProperty(
        "--ui-native-character",
        JSON.stringify(asset ? "" : style.character || "○"),
      );
      element.style.setProperty(
        "--ui-native-image",
        asset ? `url(${JSON.stringify(asset.dataUrl)})` : "none",
      );
    } else {
      delete element.dataset.uiNativeGeometry;
      if (element.dataset.uiNativeLabel) {
        element.removeAttribute("aria-label");
        delete element.dataset.uiNativeLabel;
      }
    }
    const shortcut = shortcutBindings?.[`button:${id}`];
    element.style.setProperty("--ui-caption-shortcut", JSON.stringify(shortcut ? ` (${shortcut})` : ""));
    if (shortcut) element.dataset.uiNativeShortcut = shortcut;
    else delete element.dataset.uiNativeShortcut;
  };
  useLayoutEffect(() => {
    entries.current.forEach(apply);
  }, [ui.layout, ui.shortcutBindings]);
  useEffect(() => {
    let frame = 0;
    const dirty = new Set<HTMLButtonElement>();
    let removed = false;
    const register = (button: HTMLButtonElement): Entry | undefined => {
      if (!eligible(button)) return;
      let entry = entries.current.get(button);
      const label = caption(button);
      if (!entry) {
        const id = nativeActionId(button);
        const context = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const active = latest.current;
          if (active.selectedFunctions.has(id) && active.selectedFunctions.size > 1)
            active.selectionMenu(event.clientX, event.clientY);
          else active.configure(id);
        };
        entry = { element: button, id, label: "", originalName: button.getAttribute("data-ui-name"), originalAria: button.getAttribute("aria-label"), release: () => {}, context };
        entries.current.set(button, entry);
        button.dataset.uiFunction = id;
        button.dataset.uiAutoAction = "true";
        button.addEventListener("contextmenu", context);
      }
      if (entry.label !== label) {
        entry.release();
        entry.label = label;
        entry.release = ui.registerFunction({
          id: entry.id,
          label,
          category: "Workspace",
          available: true,
          scope: button.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot,
          element: (
            <button
              onClick={() => {
                if (!button.disabled && button.getAttribute("aria-disabled") !== "true")
                  button.click();
              }}
            >
              {label}
            </button>
          ),
        });
      }
      apply(entry);
      return entry;
    };
    const scan = () => {
      frame = 0;
      if (removed)
        for (const [button, entry] of entries.current)
          if (!button.isConnected) {
            entry.release();
            button.removeEventListener("contextmenu", entry.context);
            entries.current.delete(button);
          }
      removed = false;
      for (const button of dirty) if (button.isConnected) register(button);
      dirty.clear();
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const element =
          record.target instanceof Element ? record.target : record.target.parentElement;
        if (!element || element.closest("style,script,canvas")) continue;
        const button = element.closest<HTMLButtonElement>("button");
        if (button) dirty.add(button);
        if (record.type === "childList") {
          for (const node of record.addedNodes)
            if (node instanceof Element) {
              if (node instanceof HTMLButtonElement) dirty.add(node);
              node
                .querySelectorAll<HTMLButtonElement>("button")
                .forEach((button) => dirty.add(button));
            }
          for (const node of record.removedNodes)
            if (node instanceof Element && (node.matches("button") || node.querySelector("button")))
              removed = true;
        }
      }
      if ((dirty.size || removed) && !frame) frame = requestAnimationFrame(scan);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    document.body.querySelectorAll<HTMLButtonElement>("button").forEach(register);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const entry of entries.current.values()) {
        entry.release();
        entry.element.removeEventListener("contextmenu", entry.context);
        delete entry.element.dataset.uiFunction;
        delete entry.element.dataset.uiAutoAction;
        if (entry.element.hasAttribute("data-ui-caption")) {
          delete entry.element.dataset.uiCaption;
          if (entry.originalName === null) delete entry.element.dataset.uiName; else entry.element.dataset.uiName = entry.originalName;
          if (entry.originalAria === null) entry.element.removeAttribute("aria-label"); else entry.element.setAttribute("aria-label", entry.originalAria);
        }
        entry.element.removeAttribute("data-ui-native-hidden");
        entry.element.removeAttribute("data-ui-native-icon");
        if (entry.element.dataset.uiNativeLabel) entry.element.removeAttribute("aria-label");
        delete entry.element.dataset.uiNativeLabel;
        if (entry.element.dataset.uiNativeTitle) entry.element.removeAttribute("title");
        delete entry.element.dataset.uiNativeTitle;
      }
      entries.current.clear();
    };
  }, [ui.registerFunction]);
  return <style data-native-ui-actions>{CSS}</style>;
}
