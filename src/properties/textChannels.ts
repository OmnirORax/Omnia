import type {Paint} from './visual.ts';
/** Retired once for native paint, composer capabilities and legacy-save migration. */
export const RETIRED_TEXT_CHANNELS=['opacity','translucency'] as const;
export function retireTextChannels(paint:Paint|undefined){if(paint){for(const key of RETIRED_TEXT_CHANNELS)delete paint[key];if(typeof paint.brightness==='number'&&paint.brightness>1&&paint.brightness<=3)paint.brightness=1;}}
