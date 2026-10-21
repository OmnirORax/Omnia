import type { PlacementPreview } from './drag';
import { dockSplitStyle, type DockNode } from './dockTree';
import { useUI } from './context';
import { nameFor } from './FrameSearch';

/** Presentation only: the tree comes from dockFrame's projected transaction.
 * No duplicate live controls, resident IDs, registration, or saved UI changes. */
export function DockLayoutPreview({ preview }: { preview: PlacementPreview }) {
  const frame = preview.frameLayout, rect = preview.rect;
  if (!frame || !rect) return null;
  const tree = <PreviewBranch node={frame.tree} source={frame.source} />;
  return <div className={`ui-dock-layout-preview ${frame.title ? 'ui-structured-frame' : ''}`} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
    {frame.title ? <div className="ui-frame-root">
      <div className="frame-chrome floating-title"><span className="ui-preview-group-title">◇ {frame.title}</span></div>
      <div className="ui-structured-body">{tree}</div>
    </div> : tree}
  </div>;
}
function PreviewBranch({ node, source }: { node: DockNode; source: string }) {
  const ui = useUI();
  if (node.kind === 'split') return <div className={`ui-dock-split is-${node.axis}`} style={dockSplitStyle(node.axis, node.ratio)}>
    <PreviewBranch node={node.first} source={source} />
    <div className="ui-dock-divider" />
    <PreviewBranch node={node.second} source={source} />
  </div>;
  return <div className={`ui-dock-pane ${node.keys.includes(source) ? 'ui-preview-source-pane' : ''}`} data-dock-preview-source={node.keys.includes(source) || undefined}>
    <div className="ui-dock-tab-strip"><div className="ui-dock-tabs">
      {node.keys.map(key => <span key={key} className={`ui-dock-tab ui-preview-tab ${key === node.active ? 'is-active' : ''}`}>{nameFor(ui, key)}</span>)}
    </div></div>
  </div>;
}
