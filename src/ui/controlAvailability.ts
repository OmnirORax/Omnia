/** Disabled native controls must not retain bright canvas effect paint. */
export function unavailableControl(element: Element) {
  return !!element.closest(":disabled,[aria-disabled='true']");
}
