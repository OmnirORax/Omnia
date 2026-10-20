import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI, type UIContextValue } from "./context";
import { activateDockMember, getContainer, residentKey, updateContainer } from "./layout";

export type SearchResult = { key: string; label: string; path: string[]; functionId?: string; element?: HTMLElement };
export const normalizeSearch = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export const rootFor = (key: string) => key === "workspace" ? document.body : [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root]")].find(element => element.dataset.uiResidentRoot === key);
export const nameFor = (ui: UIContextValue, key: string) => ui.layout.labels?.[key] ?? ui.frameActions.get(key)?.title ?? (key.startsWith("frame:") ? ui.layout.frames.find(frame => `frame:${frame.id}` === key)?.name : undefined) ?? key.replace(/^(frame:|window:panel:|window:)/, "");

/** Index control labels, never input values or canonical graph data. */
export function frameControls(ui: UIContextValue, container: string): SearchResult[] {
  const results = new Map<string, SearchResult>(), root = rootFor(container);
  const functions = new Map(ui.functions.map(fn => [fn.id, fn]));
  const pathTo = (element: HTMLElement) => {
    const path: string[] = [];
    let parent = element.closest<HTMLElement>("[data-ui-resident-root]");
    while (parent) {
      const key = parent.dataset.uiResidentRoot!; path.unshift(key);
      if (key === container) break;
      parent = parent.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
    }
    return path;
  };
  for (const element of root?.querySelectorAll<HTMLElement>("[data-ui-function],.binding-row,label,button,input,select,textarea") ?? []) {
    if ((element.closest("[data-ui-search],.frame-chrome") || container === "workspace" && element.closest("[data-ui-palette],[data-shortcut-runner]")) || element.matches('input[type="hidden"],input[type="file"]')) continue;
    if (element.hasAttribute("data-ui-native-hidden")) continue;
    const fnElement = element.closest<HTMLElement>("[data-ui-function]"), row = element.closest<HTMLElement>(".binding-row");
    if (fnElement && (fnElement !== element || element.parentElement?.closest("[data-ui-function]")) || row && row !== element && !row.closest("[data-ui-function]") || !fnElement && !row && element.parentElement?.closest("label")) continue;
    const id = element.dataset.uiFunction, fn = id ? functions.get(id) : undefined;
    const labelText = element.matches("label") ? [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ") : "";
    const input = element as HTMLInputElement;
    const label = fn?.label ?? element.getAttribute("aria-label") ?? (labelText.trim() || (element.matches("input,select,textarea") ? input.labels?.[0]?.textContent?.trim() || element.getAttribute("title") || "" : element.textContent?.trim() || element.getAttribute("title") || ""));
    if (!label) continue;
    const key = id ? `function:${id}` : `element:${results.size}`;
    if (!results.has(key)) results.set(key, { key, label: label.slice(0, 200), element, functionId: id, path: pathTo(element) });
  }
  // Closed nested frames can unmount their controls. Membership still identifies them.
  const seen = new Set<string>();
  const visit = (key: string, path: string[]) => {
    if (seen.has(key)) return; seen.add(key);
    for (const member of getContainer(ui.layout, key)?.members ?? []) {
      const memberKey = residentKey(member);
      if (member.kind !== "function") { visit(memberKey, [...path, memberKey]); continue; }
      const fn = functions.get(member.id);
      if (fn && !results.has(memberKey)) results.set(memberKey, { key: memberKey, label: fn.label, functionId: member.id, path });
    }
  };
  visit(container, [container]);
  return [...results.values()];
}

export function FrameSearch({ container, title, expand }: { container: string; title: string; expand: () => void }) {
  const ui = useUI(), id = useId();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 8, top: 8, height: 400 });
  const toggle = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  const index = useMemo(() => open ? frameControls(ui, container) : [], [open, query, ui.layout, ui.functions, container]);
  const tokens = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(result => tokens.every(token => normalizeSearch(`${result.label} ${result.path.slice(1).map(key => nameFor(ui, key)).join(" ")}`).includes(token)));
  const visible = matches.slice(0, 40);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [open, active, query]);
  const close = () => { setOpen(false); setQuery(""); setActive(0); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const bounds = toggle.current?.getBoundingClientRect(); if (!bounds) return;
      const width = Math.min(320, innerWidth - 16), available = innerHeight - bounds.bottom - 8;
      setPosition({ left: Math.max(8, Math.min(bounds.left, innerWidth - width - 8)), top: available >= 150 ? bounds.bottom + 4 : Math.max(8, bounds.top - Math.min(360, bounds.top - 12)), height: Math.max(120, Math.min(360, available >= 150 ? available : bounds.top - 12)) });
    };
    place(); input.current?.focus();
    const outside = (event: PointerEvent) => { if (!popup.current?.contains(event.target as Node) && !toggle.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside, true); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const reveal = (result: SearchResult) => {
    cleanup.current(); close();
    ui.update(layout => result.path.reduce((previous, key) => {
      const next = activateDockMember(previous, key);
      const state = getContainer(next, key);
      return state?.collapsed || state?.closed ? updateContainer(next, key, { collapsed: false, closed: false }) : next;
    }, layout));
    let frame = 0, attempts = 0, timer: ReturnType<typeof setTimeout> | undefined, found: HTMLElement | undefined;
    const locate = () => {
      const root = rootFor(container);
      found = result.functionId ? [...root?.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-native-hidden])") ?? []].find(element => element.dataset.uiFunction === result.functionId) : result.element;
      if (!found?.isConnected) { if (++attempts < 8) frame = requestAnimationFrame(locate); return; }
      let ancestor: HTMLElement | null = found;
      while (ancestor && ancestor !== root) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = true; ancestor = ancestor.parentElement; }
      if (!found.getClientRects().length) { if (++attempts < 8) frame = requestAnimationFrame(locate); return; }
      found.scrollIntoView({ block: "center", inline: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      const target = found.matches("button,input,select,textarea,a") ? found : found.querySelector<HTMLElement>("input,select,textarea,button,a");
      target?.focus({ preventScroll: true }); found.classList.add("ui-search-found");
      timer = setTimeout(() => found?.classList.remove("ui-search-found"), 1800);
    };
    frame = requestAnimationFrame(locate);
    cleanup.current = () => { cancelAnimationFrame(frame); clearTimeout(timer); found?.classList.remove("ui-search-found"); };
  };
  return <>
    <button ref={toggle} className="ui-frame-search-toggle" data-ui-search aria-label={`Search UI in ${title}`} title={`Search UI in ${title}`} aria-expanded={open} aria-controls={open ? id : undefined} draggable={false} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (open) close(); else { expand(); setOpen(true); } }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
    </button>
    {open && createPortal(<div ref={popup} className="ui-frame-search-popup" data-ui-search style={{ left: position.left, top: position.top, maxHeight: position.height }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close(); toggle.current?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, visible.length)) % Math.max(1, visible.length)); }
      if (event.key === "Enter" && event.target === input.current && visible[active]) { event.preventDefault(); reveal(visible[active]); }
    }}>
      <button className="ui-popup-close" aria-label={`Close search in ${title}`} onClick={close}>×</button>
      <input ref={input} type="search" aria-label={`Search controls in ${title}`} placeholder="Find a button, setting or field…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={visible[active] ? `${id}-${active}` : undefined} />
      <div className="ui-frame-search-results" id={id} role="listbox" aria-label={`UI controls in ${title}`}>
        {visible.map((result, index) => <button key={result.key} id={`${id}-${index}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => reveal(result)} title={`Show ${result.label}`}><span>{result.label}</span>{result.path.length > 1 && <small>{result.path.slice(1).map(key => nameFor(ui, key)).join(" › ")}</small>}</button>)}
      </div>
      <small role="status">{matches.length ? `${matches.length} matching controls${matches.length > 40 ? " · showing first 40" : ""}` : "No matching UI controls in this frame."}</small>
    </div>, document.body)}
  </>;
}
