import type {UILayout} from './layout.ts';
/** Inspection respects a user-collapsed settings tab; explicit search stays independent. */
export function shouldRevealInspection(layout: UILayout, path: readonly string[]): boolean {
 return !(layout.panels['@workspaceOnly'] && path.includes('window:settings') && layout.windows.settings?.collapsed);
}
