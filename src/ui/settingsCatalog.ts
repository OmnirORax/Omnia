import type {SearchMetadata} from './search.ts';
/** Menus and search consume the same declarations, even before a menu opens. */
export function createSettingsCatalog<T extends SearchMetadata>(){
 const sections=new Map<string,()=>readonly T[]>();
 return {
  define(id:string,entries:()=>readonly T[]){if(sections.has(id))throw Error(`Duplicate settings section: ${id}`);sections.set(id,entries);return entries;},
  all(){return [...sections.values()].flatMap(entries=>[...entries()]);},
 };
}
