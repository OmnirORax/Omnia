import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Rename a control's caption without replacing values, options, callbacks or stable IDs. */
export function withControlCaption(element: ReactElement, caption?: string): ReactElement {
  if (!caption || typeof element.type !== "string") return element;
  if (element.type === "button") return cloneElement(element, { children: caption, "aria-label": caption } as Record<string, unknown>);
  const props = element.props as { children?: ReactNode };
  if (element.type === "label") {
    let replaced = false;
    const children = Children.map(props.children, child => {
      if (typeof child === "string" && child.trim()) {
        if (replaced) return /[\p{L}]/u.test(child) ? null : child;
        replaced = true; return `${caption} `;
      }
      return child;
    });
    return cloneElement(element, { children: replaced ? children : [caption, children] } as Record<string, unknown>);
  }
  if (!props.children) return element;
  return cloneElement(element, { children: Children.map(props.children, child =>
    isValidElement(child) && child.type === "label" ? withControlCaption(child, caption) : child),
  } as Record<string, unknown>);
}
