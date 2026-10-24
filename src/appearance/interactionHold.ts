/** Shared marker also works for property controls moved out of Master controller. */
export const APPEARANCE_EDITOR = "[data-appearance-editor],[data-selection-editor]";
/** Covers the whole MC plus shared editors moved into other frames. */
export const SELECTION_EDITING_SURFACE = `${APPEARANCE_EDITOR},[data-ui-resident-root="window:theme"],[data-context-controller]`;

/** Only an explicit Preview choice hides marks; entering an editor does not
 * change this view or accepted membership. */
export type SelectionView = "auto" | "selection" | "preview";
export function selectionFeedbackVisible(view: SelectionView) {
  return view !== "preview";
}
