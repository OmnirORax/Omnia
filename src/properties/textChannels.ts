import type {Paint} from './visual.ts';
/** Retired once for native paint, composer capabilities and legacy-save migration. */
export const RETIRED_TEXT_CHANNELS=['brightness','brightnessEnabled','opacity','translucency'] as const;
export function retireTextChannels(paint:Paint|undefined){if(paint)for(const key of RETIRED_TEXT_CHANNELS)delete paint[key];}
