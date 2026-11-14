/** Search declared controls/actions, including IDs, hierarchy and option labels. */
export function searchText(value:string){return value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
const aliases:Record<string,string>={colour:'color',color:'colour',opacity:'translucency transparency',blink:'pulse flash',flashing:'pulse flash',transparent:'translucency opacity',transparency:'translucency opacity',normalization:'normalize',normalise:'normalize',normalisation:'normalize',delay:'cooldown interval gap',blinking:'pulse flash',bounce:'bounce displacement',node:'node nodes sphere body',background:'background backgrounds bg',font:'font typeface text',camera:'camera navigation rotation world',undo:'undo history',redo:'redo history',name:'name names label labels'};
export function searchMatches(text:string,query:string){
 const haystack=searchText(text);return searchText(query).split(' ').filter(Boolean).every(word=>[word,...(aliases[word]?.split(' ')??[])].some(term=>haystack.includes(term)));
}
export type SearchMetadata={label:string;keywords?:string;definition?:{key:string;label:string;unit?:string;options?:readonly{id:string;label:string}[]}};
export function searchIndex(item:SearchMetadata){return searchText([item.label,item.keywords,item.definition?.key,item.definition?.label,item.definition?.unit,...(item.definition?.options??[]).flatMap(option=>[option.id,option.label])].filter(Boolean).join(' '));}
