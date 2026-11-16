/** Runtime descendants inherit from the nearest owner; explicit zero is a delta. */
export function inheritedValue<T>(object:{userData:Record<string,any>;parent:any}|null,key:string,fallback:T):T{
 for(let owner=object;owner;owner=owner.parent)if(owner.userData[key]!==undefined)return owner.userData[key] as T;
 return fallback;
}
