import { useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { useUI, UIPathContext } from "./context";
import { FunctionControl } from "./UIWorkspace";
import { withControlCaption } from "./captions";
/** Live fields share the normal registry, edge dragging, library and UI persistence. */
export function UIField({
  id,
  label,
  category = "Settings",
  children,
}: {
  id: string;
  label: string;
  category?: string;
  children: ReactElement;
}) {
  const { registerFunction } = useUI(), homePath = useContext(UIPathContext), pathKey = JSON.stringify(homePath);
  const [store] = useState(() => ({ element: children, listeners: new Set<() => void>() }));
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
      }),
    [registerFunction, id, label, category, store, pathKey],
  );
  return <FunctionControl id={id} />;
}
function LiveField({ id, store }: { id: string; store: { element: ReactElement; listeners: Set<() => void> } }) {
  const ui = useUI();
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
