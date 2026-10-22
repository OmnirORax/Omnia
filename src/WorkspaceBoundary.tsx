import { Component, type ReactNode } from "react";

/** A failed lazy module or renderer must not unmount the surrounding editor. */
export class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert" style={{ position: "relative", zIndex: 1, margin: 16, padding: 20, maxWidth: 480,
      background: "#101b2c", color: "#f5f7fc", border: "1px solid #8297b3", borderRadius: 8, font: "15px/1.5 system-ui" }}>
      <strong>3D workspace couldn’t open</strong>
      <p>Reload to try again. The rest of the editor is still available.</p>
      <button type="button" onClick={() => window.location.reload()}
        style={{ padding: "8px 12px", background: "#263447", color: "#fff", border: "1px solid #8297b3", borderRadius: 6 }}>Reload</button>
      <details style={{ marginTop: 12 }}><summary>Error details</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{this.state.error.message}</pre>
      </details>
    </div>;
  }
}
