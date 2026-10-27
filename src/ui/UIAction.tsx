import { memo, useContext, useLayoutEffect, useRef } from "react";
import { useUITracked, UIPathContext } from "./context";
import { FunctionControl } from "./UIWorkspace";

/** Live actions and fields use the same registry, placements, names and shortcuts. */
export const UIAction=memo(function UIAction({ id, label, onClick, disabled = false, category = "Interface", symbol }: {
  id: string; label: string; onClick: () => void; disabled?: boolean; category?: string; symbol?: string;
}) {
  const { registerFunction } = useUITracked(ui=>[ui.registerFunction]), homePath = useContext(UIPathContext), pathKey = JSON.stringify(homePath), callback = useRef(onClick); callback.current = onClick;
  useLayoutEffect(() => registerFunction({ id, label, category, homePath,
    element: <button type="button" disabled={disabled} aria-label={label} onClick={() => callback.current()}>{symbol ?? label}</button>,
  }), [id, label, category, disabled, symbol, registerFunction, pathKey]);
  return <FunctionControl id={id} />;
});
