import { createTransientStore } from './transientStore';
/** Shared presentation preference only; no recipe, target or history mutations. */
export const radialScale=createTransientStore(1);
