import { createTransientStore } from './transientStore';
/** Shared presentation preference only; no recipe, target or history mutations. */
export const radialScale=createTransientStore(1);

/** Math-dial presentation scale shared by its consumers; independent of edited DOFs. */
export const mathematicalDialScale=createTransientStore(.75);
