import {memo,useContext,useState,cloneElement,type ReactElement,type ReactNode,type DragEvent} from 'react';
import {useUITracked,UIHomeContext,type UIFunction} from './context';
import {functionIndex} from './functionIndex';
import {useIconTint} from '../appearance/Styles';
import {ToolGlyph,toolIconFor} from './toolIcon';
import {rememberToolIcon} from './toolCursor';
import {routeContextMenu,ownsContextMenu,uiContextEnabled} from './contextMenuOwnership';
import {ContextualMasterController} from './ContextualMasterController';
import type {FunctionStyle} from './layout';
import {buttonShortcutId} from '../workspaceActions';
const MIME='application/x-omnium-function';
const defaultStyle:FunctionStyle={mode:'text',geometry:'circle'};
export const FunctionControl=memo(function FunctionControl({ id, palette = false, mirror = false, symbol, symbolOpacity, symbolFill, symbolMask, tooltip }: { id: string; palette?: boolean; mirror?: boolean; symbol?: string; symbolOpacity?: number; symbolFill?: string; symbolMask?: string; tooltip?: string }) {
  const scope = useContext(UIHomeContext), anchor = `${scope}|${id}`;
  const ui = useUITracked(ui=>{
    const index=functionIndex(ui.functions,ui.layout);
    return [index.byId.get(id),ui.layout.items[id],index.anchors.get(anchor),ui.layout.nativeOrders?.[anchor],index.owners.get(`function:${id}`),...(index.anchors.get(anchor) ?? []).map(fn => ui.layout.items[fn.id])];
  }), index=functionIndex(ui.functions,ui.layout),
    fn = index.byId.get(id),
    item = ui.layout.items[id];
  // A contextual action surface reuses its registered action and styling without
  // relocating the resident or adding another action definition.
  if (mirror) return fn ? <FunctionElement fn={fn} symbol={symbol} symbolOpacity={symbolOpacity} symbolFill={symbolFill} symbolMask={symbolMask} tooltip={tooltip} projected /> : null;
  if (palette) return fn ? <FunctionElement fn={fn} palette /> : null;
  const peers = index.anchors.get(anchor)??[];
  const order = [
    ...new Set([...(ui.layout.nativeOrders?.[anchor] ?? []), id, ...peers.map((f) => f.id)]),
  ];
  return (
    <>
      {order.map((key) => {
        const current = key === id ? fn : peers.find((f) => f.id === key);
        const visible =
          key !== id ||
          (!index.owners.has(`function:${id}`) && !item?.anchorId && (!item || item.home));
        return current && visible && !ui.layout.items[key]?.hidden ? (
          <FunctionElement key={key} fn={current} nativeAnchor={{ key: anchor, id }} symbol={key===id?symbol:undefined} symbolOpacity={key===id?symbolOpacity:undefined} symbolFill={key===id?symbolFill:undefined} symbolMask={key===id?symbolMask:undefined} tooltip={key===id?tooltip:undefined} />
        ) : null;
      })}
    </>
  );
});

const FunctionElement=memo(function FunctionElement({
  fn,
  palette = false,
  resident = false,
  nativeAnchor,
  symbol, symbolOpacity, symbolFill, symbolMask, tooltip, projected = false,
}: {
  fn: UIFunction;
  palette?: boolean;
  resident?: boolean;
  nativeAnchor?: { key: string; id: string };
  symbol?: string; symbolOpacity?: number; symbolFill?: string; symbolMask?: string; tooltip?: string; projected?:boolean;
}) {
  const ui = useUITracked(ui=>{
    const item=ui.layout.items[fn.id],index=functionIndex(ui.functions,ui.layout);
    return [functionIndex(ui.functions,ui.layout).byId.get(fn.id),item,index.permissions,ui.layout.hideNames,ui.layout.assets.find(a=>a.id===item?.style?.assetId),ui.shortcutBindings?.[buttonShortcutId(fn.id)],ui.selectedFunctions.has(fn.id),ui.selectingUI,uiContextEnabled(ui.layout)];
  }),
    item = ui.layout.items[fn.id],
    style = item?.style ?? defaultStyle;
  fn=functionIndex(ui.functions,ui.layout).byId.get(fn.id)??fn;
  const iconTint = useIconTint(`function:${fn.id}`);
  const [controlOpen, setControlOpen] = useState(false);
  const [controlPosition,setControlPosition]=useState({x:0,y:0});
  const shortcut = ui.shortcutBindings?.[buttonShortcutId(fn.id)];
  const asset = ui.layout.assets.find((a) => a.id === style.assetId);
  const toolIcon=fn.tool?toolIconFor(fn.tool):undefined;
  const content =
    palette || (resident && style.mode === "text") ? (
      fn.label
    ) : style.mode === "text" ? (
      (toolIcon && symbol ? <span style={{display:"inline-block",width:"1.15em",height:"1.15em"}}><ToolGlyph icon={toolIcon}/></span> : symbolMask ? <span aria-hidden="true" style={{display:"inline-block",width:"1.15em",height:"1.15em",opacity:symbolOpacity,background:symbolFill??"currentColor",maskImage:`url("${symbolMask}")`,WebkitMaskImage:`url("${symbolMask}")`,maskSize:"contain",maskRepeat:"no-repeat",filter:"drop-shadow(0 0 .6px #888)"}}/> : symbol !== undefined && (symbolOpacity !== undefined || symbolFill !== undefined) ? <span style={{opacity:symbolOpacity,...(symbolFill?{background:symbolFill,backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent"}:{})}}>{symbol}</span> : symbol ?? (fn.element.props as { children?: ReactNode }).children ?? fn.label)
    ) : asset ? (
      iconTint.color ? <span className="appearance-icon-mask" style={{ ...iconTint.style, backgroundColor: iconTint.color, maskImage: `url("${asset.dataUrl}")`, WebkitMaskImage: `url("${asset.dataUrl}")` }} /> : <img src={asset.dataUrl} alt="" style={iconTint.style}/>
    ) : (
      <span style={{...iconTint.style,color:iconTint.color ?? iconTint.glyphColor}}>{style.character || "○"}</span>
    );
  const original = fn.element as ReactElement<{
    onClick?: (event:React.MouseEvent) => void;
    disabled?: boolean;
    children?: ReactNode;
    className?: string;
    onMouseEnter?: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    onClickCapture?: (event: React.MouseEvent) => void;
    'data-ui-tooltip'?:string;
  }>;
  const shared = {
    "aria-keyshortcuts": shortcut?.replace(/Ctrl/g, "Control").replace(/Esc/g, "Escape"),
    "data-ui-function": fn.id,
    "data-ui-palette": palette ? "true" : undefined,
    "data-ui-resident": resident ? "true" : undefined,
    "data-ui-native-anchor": nativeAnchor?.key,
    "data-ui-native-home": nativeAnchor?.id,
    title: tooltip ?? (symbol || ui.layout.hideNames ? fn.label : ""),
    "data-ui-tooltip": tooltip ?? (symbol ? fn.label : original.props['data-ui-tooltip']),
    draggable:
      !projected && (!fn.control || palette || style.mode === "icon") && ui.canMove(`function:${fn.id}`),
    onClickCapture:(event:React.MouseEvent)=>{original.props.onClickCapture?.(event);if(fn.tool&&!palette&&!original.props.disabled)rememberToolIcon(fn.tool,event.currentTarget.querySelector<HTMLElement>("[data-tool-icon]"));},
    onDragStart: (e: DragEvent) => {
      if ((e.target as Element).closest("input,select,textarea")) return;
      e.dataTransfer.setData(MIME, fn.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onContextMenu: (e: React.MouseEvent) => {
      routeContextMenu(e, palette || fn.control ? undefined : original.props.onContextMenu, e => {
        e.preventDefault();
        e.stopPropagation();
        if (!palette && ui.selectedFunctions.has(fn.id) && ui.selectedFunctions.size > 1) {
          ui.selectionMenu(e.clientX, e.clientY);
          return;
        }
        ui.configure(fn.id);
      }, !palette && ownsContextMenu(e.target), uiContextEnabled(ui.layout));
    },
  };
  const modeClass =
    !palette && style.mode === "icon" ? `function-icon shape-${style.geometry}` : "function-text";
  const button =
    fn.control && !palette && style.mode === "text" && !symbol ? (
      <div {...shared} className="ui-form-control">
        {["top", "right", "bottom", "left"].map((edge) => (
          <span
            key={edge}
            className={`ui-field-edge edge-${edge}`}
            title={ui.layout.hideNames ? fn.label : ""}
            data-ui-drag={`function:${fn.id}`}
            draggable={ui.canMove(`function:${fn.id}`)}
            onDragStart={(e) => e.preventDefault()}
          />
        ))}
        {fn.element}
        
      </div>
    ) : (
      cloneElement(fn.control ? <button onClick={() => setControlOpen(true)} /> : original, {
        ...shared,
        "data-ui-name": fn.label,
        disabled: false,
        "aria-disabled": original.props.disabled || undefined,
        "aria-expanded": fn.control ? controlOpen : original.props["aria-expanded" as keyof typeof original.props],
        "aria-pressed":
          fn.id === "ui:select"
            ? ui.selectingUI
            : original.props["aria-pressed" as keyof typeof original.props],
        onClick: original.props.disabled
          ? undefined
          : fn.control
            ? (event:React.MouseEvent)=>{const box=event.detail===0?event.currentTarget.getBoundingClientRect():null;setControlPosition(box?{x:box.x+box.width/2,y:box.y+box.height/2}:{x:event.clientX,y:event.clientY});setControlOpen(true);}
            : original.props.onClick,
        "aria-label": palette
          ? `Place ${fn.label}`
          : (original.props["aria-label" as keyof typeof original.props] ??
            (symbol || resident || style.mode === "icon" ? fn.label : undefined)),
        className: `${original.props.className ?? ""} ui-function ${modeClass} ${!palette && ui.selectedFunctions.has(fn.id) ? "ui-selected" : ""}`,
        children: <>{fn.tool&&!palette&&(symbol||style.mode==='icon')?<span data-tool-icon="" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>{content}</span>:content}</>,
      })
    );
  return (
    <>
      {shortcut && !symbol && !palette && style.mode === "icon" ? <span className="ui-icon-shortcut">{button}</span> : button}
      {controlOpen && symbol ? <ContextualMasterController title={fn.label} position={controlPosition} onClose={()=>setControlOpen(false)}>{fn.element}</ContextualMasterController> : controlOpen && (
        <ContextualMasterController title={fn.label} position={controlPosition} onClose={()=>setControlOpen(false)}>
          {fn.element}
        </ContextualMasterController>
      )}
    </>
  );
});

