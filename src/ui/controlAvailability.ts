/** Match the control's own unavailable state without dimming supported descendants
 * of a property branch that can still be expanded. Canvas effects use this too. */
export function unavailableControl(element: Element) {
  if (element.closest(":disabled,[aria-disabled='true']")) return true;
  return !!element.closest("button")?.matches(
    ".property-node.is-unavailable > .property-node-heading .property-node-name,.property-node.is-unavailable > button",
  );
}
