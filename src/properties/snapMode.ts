/** Shared visible symbols; identifiers and accessible names retain their meaning. */
export const SNAP_MODES={axis:{symbol:'🞡',label:'Axis'},unit:{symbol:'••',label:'Unit'}} as const;

export const SNAP_MODE_ITEMS=Object.entries(SNAP_MODES).map(([id,mode])=>({id,...mode}));
