import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Rule } from "./model";
import { ruleHas } from "./model";
import { PROPERTIES } from "./registry";
export function LockControl({
  label,
  rule,
  properties,
  onToggle,
  inherited = false,
}: {
  label: string;
  rule?: Rule;
  properties: string[];
  onToggle: (property?: string) => void;
  inherited?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 8, top: 8 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    button = useRef<HTMLButtonElement>(null);
  const keep = () => clearTimeout(timer.current);
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = () => {
    keep();
    const r = button.current?.getBoundingClientRect();
    if (r)
      setPosition({
        left: Math.max(8, r.right + 214 <= innerWidth ? r.right + 4 : r.left - 204),
        top: Math.max(
          8,
          Math.min(r.top, innerHeight - Math.min(properties.length * 26 + 65, innerHeight - 16)),
        ),
      });
    setOpen(true);
  };
  return (
    <span className="appearance-lock-area" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={button}
        className="appearance-lock"
        aria-label={`${rule?.all ? "Unlock" : "Lock"} ${label}`}
        title={
          inherited
            ? "Protected by an ancestor; direct editing remains available"
            : "Click to lock all properties; hover for detailed locks"
        }
        onClick={() => onToggle()}
      >
        {rule?.all ? "🔒" : rule?.properties?.length ? "◐" : inherited ? "↳🔒" : "🔓"}
      </button>
      {open &&
        createPortal(
          <div
            className="appearance-lock-panel"
            style={{
              left: position.left,
              top: position.top,
              right: "auto",
              maxHeight: innerHeight - 16,
              overflowY: "auto",
            }}
            data-ui-search
            onMouseEnter={keep}
            onMouseLeave={hide}
          >
            <strong>{label}</strong>
            <small>Protect from inherited edits</small>
            {PROPERTIES.filter((p) => properties.includes(p.id)).map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={ruleHas(rule, p.id)}
                  onChange={() => onToggle(p.id)}
                />
                {p.label}
              </label>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
