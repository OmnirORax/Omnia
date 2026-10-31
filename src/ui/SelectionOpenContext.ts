import {createContext} from 'react';
/** Logical ownership survives portals; default MS opening can find its consumer. */
export const SelectionOpenContext=createContext<string|undefined>(undefined);
