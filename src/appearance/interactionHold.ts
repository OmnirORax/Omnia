/** Shared marker also works for property controls moved out of Master controller. */
export const APPEARANCE_EDITOR = "[data-appearance-editor],[data-selection-editor]";

/** Only an explicit Preview choice hides marks; entering an editor does not
 * change this view or accepted membership. */
export type SelectionView = "auto" | "selection" | "preview";
export function selectionFeedbackVisible(view: SelectionView) {
  return view !== "preview";
}
