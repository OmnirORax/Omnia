/** Runtime descendants inherit from the nearest owner; explicit zero is a delta. */
export function inheritedOwner<T extends {userData:Record<string,any>;parent:any}>(object:T|null,key:string):T|undefined{
 for(let owner=object;owner;owner=owner.parent)if(owner.userData[key]!==undefined)return owner;
}
export function inheritedValue<T>(object:{userData:Record<string,any>;parent:any}|null,key:string,fallback:T):T{
 const owner=inheritedOwner(object,key);return owner?owner.userData[key]:fallback;
}
