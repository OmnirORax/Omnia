import { useLayoutEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { useUI } from "./context";
import { FunctionControl } from "./UIWorkspace";
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
  const { registerFunction } = useUI();
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
        element: <LiveField store={store} />,
        control: true,
      }),
    [registerFunction, id, label, category, store],
  );
  return <FunctionControl id={id} />;
}
function LiveField({ store }: { store: { element: ReactElement; listeners: Set<() => void> } }) {
  return useSyncExternalStore(
    (notify) => {
      store.listeners.add(notify);
      return () => {
        store.listeners.delete(notify);
      };
    },
    () => store.element,
  );
}
