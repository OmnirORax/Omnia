import { memo, useContext, useLayoutEffect, useRef } from "react";
import { useUITracked, UIPathContext } from "./context";
import { FunctionControl } from "./UIWorkspace";

/** Live actions and fields use the same registry, placements, names and shortcuts. */
export const UIAction=memo(function UIAction({ id, label, onClick, onConfigure, disabled = false, category = "Interface", symbol, registerOnly = false }: {
  id: string; label: string; onClick: () => void; onConfigure?: () => void; disabled?: boolean; category?: string; symbol?: string; registerOnly?: boolean;
}) {
  const { registerFunction } = useUITracked(ui=>[ui.registerFunction]), homePath = useContext(UIPathContext), pathKey = JSON.stringify(homePath), callback = useRef(onClick); callback.current = onClick;
  const configure = useRef(onConfigure); configure.current = onConfigure;
  useLayoutEffect(() => registerFunction({ id, label, category, homePath,
    element: <button type="button" disabled={disabled} aria-label={label} data-ui-tooltip={symbol?label:undefined} title={onConfigure?"Left-click uses retained settings · right-click configures":undefined} onClick={() => callback.current()} onContextMenu={event => {
      if (!configure.current || disabled) return;
      event.preventDefault(); event.stopPropagation(); configure.current();
    }}>{symbol ?? label}</button>,
  }), [id, label, category, disabled, symbol, !!onConfigure, registerFunction, pathKey]);
  return registerOnly?null:<FunctionControl id={id} />;
});
