import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Checkpoint } from "./checkpoints";
import { RECOVERY_GESTURE } from "../featureActions";

const CSS = `
:host { all: initial !important; position: fixed !important; inset: 0 !important; display: block !important; pointer-events: none !important; z-index: 2147483647 !important; opacity: 1 !important; visibility: visible !important; filter: none !important; transform: none !important; }
* { box-sizing: border-box; font: inherit; }
.shell { font: 15px/1.45 system-ui, sans-serif; color: #f5f7fc; color-scheme: dark; letter-spacing: normal; text-transform: none; text-shadow: none; }
button, input { color: #fff; background: #263447; border: 1px solid #8297b3; border-radius: 6px; padding: 8px 12px; min-height: 36px; }
button { cursor: pointer; } button:hover { background: #3c506b; } button:focus-visible, input:focus-visible { outline: 3px solid #ffe98a; outline-offset: 2px; } button:disabled { opacity: .5; cursor: default; }
.bar { pointer-events: auto; position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px); background: #101b2c; border: 1px solid #a0b9da; box-shadow: 0 3px 20px #0009; padding: 10px; border-radius: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.backdrop { pointer-events: auto; position: fixed; inset: 0; background: #0009; display: grid; place-items: center; padding: 16px; }
.panel { background: #101b2c; border: 2px solid #a0b9da; border-radius: 10px; width: min(560px, 100%); max-height: calc(100dvh - 32px); overflow: auto; padding: 20px; box-shadow: 0 6px 40px #000b; }
h2 { font-size: 20px; margin: 0 0 12px; } h3 { font-size: 16px; margin: 20px 0 8px; } p { margin: 8px 0 12px; } .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.list { display: grid; gap: 8px; } .checkpoint { display: flex; gap: 12px; align-items: center; justify-content: space-between; border-top: 1px solid #46566b; padding-top: 8px; } .checkpoint span { min-width: 0; overflow-wrap: anywhere; } small { display: block; color: #c0cddd; } label { display: grid; gap: 5px; } input { width: 100%; } .status { color: #ffe98a; } 
`;

type Props = {
  open: boolean;
  onOpen: (open: boolean) => void;
  pending: boolean;
  safe: boolean;
  onSafe: (safe: boolean) => void;
  onApply: () => void;
  onDiscard: () => void;
  onReset: () => void;
  checkpoints: Checkpoint[];
  onSave: (name: string) => void;
  onRestore: (checkpoint: Checkpoint) => void;
  error: string;
};
/** Outside the customizable body and inside a shadow root: theme CSS cannot hide recovery. */
export function AppearanceRecovery(props: Props) {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const [name, setName] = useState("");
  const latest = useRef(props);
  latest.current = props;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = document.createElement("omnium-appearance-recovery");
    host.setAttribute("aria-label", "Appearance safety controls");
    document.documentElement.append(host);
    setRoot(host.attachShadow({ mode: "open" }));
    return () => host.remove();
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held = false;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      held = false;
    };
    const down = (event: KeyboardEvent) => {
      if (event.key === RECOVERY_GESTURE.key && !held) {
        held = true;
        timer = setTimeout(() => latest.current.onOpen(true), RECOVERY_GESTURE.holdMs);
      }
      if (latest.current.open) {
        event.stopImmediatePropagation();
        if (event.key === RECOVERY_GESTURE.key) event.preventDefault();
        if (event.key === "Tab") {
          const controls = [
            ...(panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled)",
            ) ?? []),
          ];
          const active = root?.activeElement,
            index = controls.findIndex((c) => c === active);
          const next = event.shiftKey
            ? index <= 0
              ? controls.at(-1)
              : controls[index - 1]
            : index < 0 || index === controls.length - 1
              ? controls[0]
              : controls[index + 1];
          if (next) {
            event.preventDefault();
            next.focus();
          }
        }
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === RECOVERY_GESTURE.key) clear();
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clear();
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [root]);
  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [props.open, root]);
  useEffect(() => {
    if (!props.pending) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [props.pending]);
  if (!root) return null;
  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="shell">
        {!props.open && (props.pending || props.safe) && (
          <aside className="bar" aria-label="Appearance preview">
            <span>
              {props.pending
                ? "Appearance preview · not saved"
                : "Safe view · saved appearance unchanged"}
            </span>
            {props.pending && (
              <>
                <button onClick={props.onApply}>Apply</button>
                <button onClick={() => props.onOpen(true)}>Discard…</button>
              </>
            )}
            {props.safe && (
              <button onClick={() => props.onSafe(false)}>Show custom appearance</button>
            )}
            <button onClick={() => props.onOpen(true)}>Recovery / checkpoints</button>
          </aside>
        )}
        {props.open && (
          <div className="backdrop">
            <section
              ref={panel}
              className="panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="appearance-recovery-title"
            >
              <h2 id="appearance-recovery-title">Appearance recovery</h2>
              <p>
                {props.pending
                  ? "Discard all unapplied appearance changes?"
                  : "Recover your appearance without changing knowledge or UI arrangement."}
              </p>
              <div className="actions">
                {props.pending && (
                  <>
                    <button onClick={props.onDiscard}>Discard unapplied changes</button>
                    <button onClick={props.onApply}>Apply preview</button>
                  </>
                )}
                <button onClick={() => props.onSafe(!props.safe)}>
                  {props.safe ? "Show custom appearance" : "Temporary safe view"}
                </button>
                <button onClick={props.onReset}>Preview default appearance</button>
                <button onClick={() => props.onOpen(false)}>Close recovery</button>
              </div>
              <p>
                Safe view is temporary. Defaults and restored checkpoints are previews until you
                Apply.
              </p>
              {props.safe && (
                <p className="status" role="status">
                  Safe view is active; saved appearance is unchanged.
                </p>
              )}
              {props.error && (
                <p className="status" role="alert">
                  {props.error}
                </p>
              )}
              <h3>Appearance checkpoints · {props.checkpoints.length}/10</h3>
              <label>
                Checkpoint name
                <input
                  aria-label="Checkpoint name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional name"
                />
              </label>
              <div className="actions">
                <button disabled={props.pending} onClick={() => props.onSave(name)}>
                  Save applied appearance checkpoint
                </button>
              </div>
              <p>
                Apply saves a checkpoint automatically. Up to 10 are kept in this browser; export a
                theme for a portable backup.
              </p>
              <div className="list">
                {[...props.checkpoints].reverse().map((checkpoint) => (
                  <div className="checkpoint" key={checkpoint.id}>
                    <span>
                      {checkpoint.name}
                      <small>{new Date(checkpoint.createdAt).toLocaleString()}</small>
                    </span>
                    <button
                      aria-label={`Preview checkpoint ${checkpoint.name}`}
                      onClick={() => props.onRestore(checkpoint)}
                    >
                      Restore preview
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </>,
    root,
  );
}
