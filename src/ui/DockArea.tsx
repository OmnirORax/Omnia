import { useId, useLayoutEffect, useRef, useState } from "react";
import { useUI } from "./context";
import { getContainer, residentKey, type UIResident } from "./layout";
type Shape = { x: number; y: number; width: number; height: number; geometry: string };
function path(s: Shape) {
  const x = s.x - 6,
    y = s.y - 6,
    w = s.width + 12,
    h = s.height + 12;
  if (s.geometry === "circle") return `M${x + w / 2},${y}a${w / 2},${h / 2} 0 1,0 .01,0Z`;
  if (s.geometry === "triangle") return `M${x + w / 2},${y}L${x + w},${y + h}H${x}Z`;
  return `M${x + 9},${y}H${x + w - 9}Q${x + w},${y} ${x + w},${y + 9}V${y + h - 9}Q${x + w},${y + h} ${x + w - 9},${y + h}H${x + 9}Q${x},${y + h} ${x},${y + h - 9}V${y + 9}Q${x},${y} ${x + 9},${y}Z`;
}
export function DockArea({ container, contour = true }: { container: string; contour?: boolean }) {
  const ui = useUI(),
    root = useRef<HTMLDivElement>(null),
    mask = useId().replace(/:/g, ""),
    [shapes, setShapes] = useState<Shape[]>([]);
  const members = getContainer(ui.layout, container)?.members ?? [];
  const preview = ui.preview?.target === container ? ui.preview : null;
  const entries: (UIResident & { ghost?: boolean })[] = [...members];
  if (preview) {
    const old = entries.findIndex((m) => residentKey(m) === preview.key);
    if (old >= 0) entries.splice(old, 1);
    const colon = preview.key.indexOf(":");
    entries.splice(Math.max(0, preview.index - (old >= 0 && old < preview.index ? 1 : 0)), 0, {
      kind: preview.key.slice(0, colon) as UIResident["kind"],
      id: preview.key.slice(colon + 1),
      ghost: true,
      breakBefore: preview.breakBefore,
    });
  }
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = node.getBoundingClientRect();
        const next = [...node.querySelectorAll<HTMLElement>(":scope > .ui-resident-slot")].map(
          (slot) => {
            const r = slot.getBoundingClientRect(),
              icon = slot.querySelector(":scope > .function-icon");
            return {
              x: r.x - bounds.x + node.scrollLeft,
              y: r.y - bounds.y + node.scrollTop,
              width: r.width,
              height: r.height,
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
  }, [ui.layout, ui.preview, container]);
  return (
    <div
      className={`ui-dock-area ${preview ? "is-drop-target" : ""} ${!contour && !entries.length ? "ui-dock-empty" : ""}`}
      data-ui-drop-zone={container}
      data-ui-container-key={container}
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
            <mask id={mask}>
              <path d={shapes.map(path).join(" ")} fill="white" />
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
          <rect width="100%" height="100%" fill="#b6d4f2" opacity=".2" mask={`url(#${mask})`} />
        </svg>
      )}
      {!entries.length && contour && (
        <div className="empty-ui-slot">Drop a function, field or frame here</div>
      )}
      {entries.map((member) => (
        <ResidentSlot
          key={member.ghost ? "@preview" : residentKey(member)}
          member={member}
          ghost={member.ghost}
          width={preview?.width}
          height={preview?.height}
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
}: {
  member: UIResident;
  ghost?: boolean;
  width?: number;
  height?: number;
}) {
  const ui = useUI();
  return (
    <>
      {member.breakBefore && <span className="ui-row-break" aria-hidden="true" />}
      <div
        className={`ui-resident-slot ${ghost ? "ui-drop-ghost" : ""}`}
        data-ui-slot-key={ghost ? undefined : residentKey(member)}
        data-ui-ghost={ghost ? "true" : undefined}
        style={ghost ? { width, height } : undefined}
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
