import { useId, useLayoutEffect, useRef, useState } from "react";
import { useUI } from "./context";
import {
  getContainer,
  residentKey,
  residentPinned,
  updateContainer,
  type UIResident,
} from "./layout";
type Shape = {
  x: number;
  y: number;
  width: number;
  height: number;
  geometry: string;
  padding?: number;
};
function path(s: Shape) {
  const padding = s.padding ?? 6;
  const x = s.x - padding,
    y = s.y - padding,
    w = s.width + padding * 2,
    h = s.height + padding * 2;
  if (s.geometry === "circle") return `M${x + w / 2},${y}a${w / 2},${h / 2} 0 1,0 .01,0Z`;
  if (s.geometry === "triangle") return `M${x + w / 2},${y}L${x + w},${y + h}H${x}Z`;
  return `M${x + 9},${y}H${x + w - 9}Q${x + w},${y} ${x + w},${y + 9}V${y + h - 9}Q${x + w},${y + h} ${x + w - 9},${y + h}H${x + 9}Q${x},${y + h} ${x},${y + h - 9}V${y + 9}Q${x},${y} ${x + 9},${y}Z`;
}
/** Short background bridges keep arbitrarily arranged residents in one visible frame. */
function bridges(shapes: Shape[]) {
  if (shapes.length < 2) return "";
  const joined = new Set([0]),
    distance = shapes.map(() => Infinity),
    from = shapes.map(() => 0),
    paths: string[] = [];
  let last = 0;
  while (joined.size < shapes.length) {
    for (let i = 0; i < shapes.length; i++)
      if (!joined.has(i)) {
        const a = shapes[last],
          b = shapes[i],
          d = Math.hypot(
            a.x + a.width / 2 - b.x - b.width / 2,
            a.y + a.height / 2 - b.y - b.height / 2,
          );
        if (d < distance[i]) {
          distance[i] = d;
          from[i] = last;
        }
      }
    let next = -1;
    for (let i = 0; i < shapes.length; i++)
      if (!joined.has(i) && (next < 0 || distance[i] < distance[next])) next = i;
    const a = shapes[from[next]],
      b = shapes[next];
    paths.push(
      `M${a.x + a.width / 2},${a.y + a.height / 2}L${b.x + b.width / 2},${b.y + b.height / 2}`,
    );
    joined.add(next);
    last = next;
  }
  return paths.join(" ");
}
export function DockArea({ container, contour = true }: { container: string; contour?: boolean }) {
  const ui = useUI(),
    root = useRef<HTMLDivElement>(null),
    mask = useId().replace(/:/g, ""),
    [shapes, setShapes] = useState<Shape[]>([]),
    [handle, setHandle] = useState<Shape | null>(null),
    [moving, setMoving] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(null);
  const state = getContainer(ui.layout, container);
  const members = state?.members ?? [];
  const preview = ui.preview?.target === container ? ui.preview : null;
  const entries: (UIResident & { ghost?: boolean })[] = [...(preview?.baseline ?? members)];
  if (preview) {
    const old = entries.findIndex((m) => residentKey(m) === preview.key);
    if (old >= 0) entries.splice(old, 1);
    const colon = preview.key.indexOf(":");
    entries.splice(Math.max(0, preview.index - (old >= 0 && old < preview.index ? 1 : 0)), 0, {
      kind: preview.key.slice(0, colon) as UIResident["kind"],
      id: preview.key.slice(colon + 1),
      ghost: true,
      breakBefore: preview.breakBefore,
      position: preview.position,
      size: { width: preview.width, height: preview.height },
    });
  }
  const positioned = entries.length > 0 && entries.every((m) => m.position && m.size);
  const minX = positioned ? Math.min(0, ...entries.map((m) => m.position!.x - 12)) : 0,
    minY = positioned ? Math.min(0, ...entries.map((m) => m.position!.y - 12)) : 0;
  const offset = moving ?? state?.bodyOffset ?? { x: 0, y: 0 };
  const connections = bridges(shapes);
  useLayoutEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current) {
        gesture.current = null;
        setMoving(null);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, []);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = node.getBoundingClientRect();
        const chrome = [...document.querySelectorAll<HTMLElement>("[data-ui-chrome]")].find(
          (e) => e.dataset.uiChrome === container,
        );
        const tab = chrome?.querySelector(".ui-frame-handle")?.getBoundingClientRect();
        const h = tab
          ? {
              x: tab.x - bounds.x,
              y: tab.y - bounds.y,
              width: tab.width,
              height: tab.height,
              geometry: "rectangle",
            }
          : null;
        setHandle((old) => (JSON.stringify(old) === JSON.stringify(h) ? old : h));
        const next = [...node.querySelectorAll<HTMLElement>(":scope > .ui-resident-slot")].map(
          (slot) => {
            const r = slot.getBoundingClientRect(),
              icon = slot.querySelector(":scope > .function-icon");
            return {
              x: r.x - bounds.x + node.scrollLeft,
              y: r.y - bounds.y + node.scrollTop,
              width: r.width,
              height: r.height,
              padding: slot.querySelector(":scope > .ui-form-control") ? 0 : 6,
              geometry: icon?.classList.contains("shape-circle")
                ? "circle"
                : icon?.classList.contains("shape-triangle")
                  ? "triangle"
                  : "rectangle",
            };
          },
        );
        setShapes((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
        );
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.querySelectorAll(":scope > .ui-resident-slot").forEach((slot) => observer.observe(slot));
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ui.layout, ui.preview, container, moving]);
  return (
    <div
      className={`ui-dock-area ${preview ? "is-drop-target" : ""} ${!contour && !entries.length ? "ui-dock-empty" : ""}`}
      data-ui-drop-zone={container}
      data-ui-container-key={container}
      data-origin-x={minX}
      data-origin-y={minY}
      style={{
        left: offset.x + minX,
        top: offset.y + minY,
        ...(positioned
          ? {
              display: "block",
              width: Math.max(70, ...entries.map((m) => m.position!.x + m.size!.width + 12)) - minX,
              minHeight:
                Math.max(46, ...entries.map((m) => m.position!.y + m.size!.height + 12)) - minY,
              padding: 0,
            }
          : {}),
      }}
      ref={root}
      onContextMenu={(e) => {
        if ((e.target as Element).closest("button,input,select,textarea")) return;
        e.preventDefault();
        e.stopPropagation();
        ui.frameMenu(container, e.clientX, e.clientY);
      }}
    >
      {contour && shapes.length > 0 && (
        <svg
          className="ui-contour"
          aria-hidden="true"
          width={Math.max(root.current?.clientWidth ?? 0, ...shapes.map((s) => s.x + s.width + 12))}
          height={Math.max(
            root.current?.clientHeight ?? 0,
            ...shapes.map((s) => s.y + s.height + 12),
          )}
        >
          <defs>
            <mask
              id={mask}
              maskUnits="userSpaceOnUse"
              x={-10000}
              y={-10000}
              width={20000}
              height={20000}
            >
              <path d={[...shapes, ...(handle ? [handle] : [])].map(path).join(" ")} fill="white" />
              <path
                d={connections}
                fill="none"
                stroke="white"
                strokeWidth="16"
                strokeLinejoin="round"
              />
              {handle && shapes[0] && (
                <path
                  d={`M${handle.x + handle.width / 2},${handle.y + handle.height / 2}L${shapes[0].x + shapes[0].width / 2},${shapes[0].y + shapes[0].height / 2}`}
                  stroke="white"
                  strokeWidth="9"
                />
              )}
              {shapes.flatMap((a, i) =>
                shapes
                  .slice(i + 1)
                  .filter(
                    (b) =>
                      Math.abs(a.y - b.y) < 8 &&
                      Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width) < 30,
                  )
                  .map((b, j) => (
                    <rect
                      key={`${i}:${j}`}
                      x={Math.min(a.x + a.width / 2, b.x + b.width / 2)}
                      y={Math.max(a.y, b.y)}
                      width={Math.abs(a.x + a.width / 2 - b.x - b.width / 2)}
                      height={Math.min(a.height, b.height)}
                      fill="white"
                    />
                  )),
              )}
            </mask>
          </defs>
          <rect
            x={Math.min(-12, (handle?.x ?? 0) - 12)}
            y={Math.min(-12, (handle?.y ?? 0) - 12)}
            width={
              Math.max(root.current?.clientWidth ?? 0, (handle?.x ?? 0) + (handle?.width ?? 0)) +
              Math.abs(Math.min(-12, (handle?.x ?? 0) - 12)) +
              12
            }
            height={
              Math.max(root.current?.clientHeight ?? 0, (handle?.y ?? 0) + (handle?.height ?? 0)) +
              Math.abs(Math.min(-12, (handle?.y ?? 0) - 12)) +
              12
            }
            fill="#b6d4f2"
            opacity=".2"
            mask={`url(#${mask})`}
          />
          <path
            className="ui-bubble-drag"
            data-ui-bubble={container}
            d={shapes.map(path).join(" ") + connections}
            fill="transparent"
            stroke="transparent"
            strokeWidth="16"
            onPointerDown={(e) => {
              if (e.button !== 0 || residentPinned(ui.layout, container)) return;
              e.preventDefault();
              e.stopPropagation();
              gesture.current = {
                x: e.clientX,
                y: e.clientY,
                offset: state?.bodyOffset ?? { x: 0, y: 0 },
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const g = gesture.current;
              if (!g) return;
              setMoving({ x: g.offset.x + e.clientX - g.x, y: g.offset.y + e.clientY - g.y });
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              if (!g) return;
              gesture.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
              const next = { x: g.offset.x + e.clientX - g.x, y: g.offset.y + e.clientY - g.y };
              setMoving(null);
              if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 2)
                ui.update((s) => updateContainer(s, container, { bodyOffset: next }));
            }}
            onPointerCancel={() => {
              gesture.current = null;
              setMoving(null);
            }}
          />
        </svg>
      )}
      {!members.length && contour && (
        <div
          className="empty-ui-slot"
          style={preview ? { position: "absolute", left: 12, top: 12, opacity: 0 } : undefined}
        >
          Drop a function, field or frame here
        </div>
      )}
      {entries.map((member) => (
        <ResidentSlot
          key={member.ghost ? "@preview" : residentKey(member)}
          member={member}
          ghost={member.ghost}
          width={preview?.width}
          height={preview?.height}
          origin={{ x: minX, y: minY }}
        />
      ))}
    </div>
  );
}
function ResidentSlot({
  member,
  ghost,
  width,
  height,
  origin,
}: {
  member: UIResident;
  ghost?: boolean;
  width?: number;
  height?: number;
  origin: { x: number; y: number };
}) {
  const ui = useUI();
  return (
    <>
      {member.breakBefore && !member.position && (
        <span className="ui-row-break" aria-hidden="true" />
      )}
      <div
        className={`ui-resident-slot ${member.position ? "is-positioned" : ""} ${ghost ? "ui-drop-ghost" : ""}`}
        data-ui-slot-key={ghost ? undefined : residentKey(member)}
        data-ui-ghost={ghost ? "true" : undefined}
        style={{
          ...(member.position
            ? {
                position: "absolute",
                left: member.position.x - origin.x,
                top: member.position.y - origin.y,
                width: member.size?.width,
              }
            : {}),
          ...(ghost ? { width, height } : {}),
        }}
      >
        {ghost ? (
          <span>Drop here{ui.preview?.magnetic ? " · magnetic" : ""}</span>
        ) : (
          ui.renderResident(member)
        )}
      </div>
    </>
  );
}
