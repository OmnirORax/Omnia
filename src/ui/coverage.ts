export type UnregisteredUIPart = { label: string; element: HTMLElement };
/** Developer-facing inventory of visible fields/headings that bypass editable UI components. */
export function unregisteredUIParts(): UnregisteredUIPart[] {
  return [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root] input,[data-ui-resident-root] select,[data-ui-resident-root] textarea,[data-ui-resident-root] h1,[data-ui-resident-root] h2,[data-ui-resident-root] h3,[data-ui-resident-root] legend,[data-ui-resident-root] summary")]
    .filter(element => element.getClientRects().length && !element.closest('[data-ui-function],[data-ui-chrome],[data-ui-search],[data-ui-name-ignore],omnium-appearance-recovery') && !element.matches('[type="hidden"],[hidden]'))
    .map(element => ({ label: element.getAttribute("aria-label") ?? (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? element.textContent?.trim() ?? element.tagName, element }));
}
