/** Missing node assignment inherits default; an explicit null remains a clear. */
export function resolveBackgroundReference<T>(nodes:Record<string,T|null>,fallback:T|null,nodeId:string|null):T|null{
 return nodeId&&Object.hasOwn(nodes,nodeId)?nodes[nodeId]:fallback;
}
