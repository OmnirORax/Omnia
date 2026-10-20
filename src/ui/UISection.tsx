import { useContext, type ReactNode } from "react";
import { EmbeddedGroup } from "./EmbeddedGroup";
import { UIContainerContext, UIHomeContext } from "./context";
import { stableUIHash } from "./identity";

/** A category is a complete editable frame, never a fixed heading above loose controls.
 * Original ownership scopes its ID even after moving the section through a portal. */
export function UISection({ id, title, children, className = "", defaultExpanded = true, expanded, legacyTag = "transparent" }: {
  id: string; title: string; children: ReactNode; className?: string; defaultExpanded?: boolean; expanded?: boolean; legacyTag?: string;
}) {
  const parent = useContext(UIContainerContext), home = useContext(UIHomeContext);
  return <EmbeddedGroup id={`section:${stableUIHash(parent ?? home)}:${id}`} title={title}
    className={`ui-section ${className}`} nativeTag={legacyTag} defaultExpanded={defaultExpanded} expanded={expanded}>{children}</EmbeddedGroup>;
}
