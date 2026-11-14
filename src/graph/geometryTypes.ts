// Transient adapter for V1's coordinate/lattice algorithms. Never a saved identity model.
export type XYZ = { x: number; y: number; z: number };
export type Placement = { id: string; parentId: string | null; position: { x: number; y: number }; spatialPosition?: XYZ; orientation?: XYZ & {w:number}; variantOwner?: { placementId: string } };
export type Document = { placements: Placement[]; activeLayoutViewId?: string; layoutViews?: { id: string; name: string; rule: string; preservePositions?: boolean; positions: { placementId: string; position: XYZ }[] }[] };
