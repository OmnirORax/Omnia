/** Hold target/event context while controls are used, never paint values or time.
 * This is transient tool state: it does not belong in selection or appearance history. */
export function createInteractionHold<T>() {
  let context: T | null = null, held = false;
  return {
    remember(next: T) { if (!held) context = next; },
    hold() { held = context !== null; return context; },
    release() { held = false; context = null; },
    get held() { return held; },
    get context() { return context; },
  };
}
/** Shared marker also works for property controls moved out of Master controller. */
export const APPEARANCE_EDITOR = "[data-appearance-editor],[data-selection-editor]";

/** Feedback visibility never changes membership or the held event context. An
 * explicit view wins until picking resumes; automatic editing reveals real paint,
 * except when feedback itself is the object being adjusted. */
export type SelectionView = "auto" | "selection" | "preview";
export function selectionFeedbackVisible(view: SelectionView, editing: boolean, editingFeedback: boolean) {
  return view === "selection" || view === "auto" && (!editing || editingFeedback);
}
