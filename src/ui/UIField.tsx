import { memo, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { useUITracked, UIPathContext } from "./context";
import { FunctionControl } from "./UIWorkspace";
import { withControlCaption } from "./captions";
import { fieldRigidityTarget } from "./rigidity";
/** Live fields share the normal registry, edge dragging, library and UI persistence. */
export const UIField=memo(function UIField({
  id,
  label,
  category = "Settings",
  children,
  registerOnly = false,
}: {
  id: string;
  label: string;
  category?: string;
  children: ReactElement;
  registerOnly?: boolean;
}) {
  const { registerFunction } = useUITracked(ui=>[ui.registerFunction]), homePath = useContext(UIPathContext), pathKey = JSON.stringify(homePath);
  const [store] = useState(() => ({ element: children, listeners: new Set<() => void>() }));
  const rigidityTarget = fieldRigidityTarget(children);
  useLayoutEffect(() => {
    store.element = children;
    store.listeners.forEach((notify) => notify());
  }, [store, children]);
  useLayoutEffect(
    () =>
      registerFunction({
        id,
        label,
        category,
        homePath,
        element: <LiveField id={id} store={store} />,
        control: true,
        rigidityTarget,
      }),
    [registerFunction, id, label, category, store, pathKey, rigidityTarget],
  );
  return registerOnly?null:<FunctionControl id={id} />;
});
function LiveField({ id, store }: { id: string; store: { element: ReactElement; listeners: Set<() => void> } }) {
  const ui = useUITracked(ui=>[ui.layout.labels?.[`function:${id}`]]);
  const element = useSyncExternalStore(
    (notify) => {
      store.listeners.add(notify);
      return () => {
        store.listeners.delete(notify);
      };
    },
    () => store.element,
  );
  return withControlCaption(element, ui.layout.labels?.[`function:${id}`]);
}
