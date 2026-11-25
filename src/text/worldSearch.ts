import {createInheritanceReader} from '../core/lattice.ts';
import type {Origin,World} from '../core/model.ts';
import type {NodeText} from './model.ts';
import {toSource} from './source.ts';

export function documentSearchPattern(value:string){
 const query=value.trim();
 return query?new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'iu'):undefined;
}

export function firstDocumentMatch(pattern:RegExp,document:string){
 const match=pattern.exec(document);
 if(match)return {from:match.index,to:match.index+match[0].length};
}

function matchSnippet(pattern:RegExp,text:NodeText){
 const document=toSource(text).text.replace(/\r\n?/g,'\n'),hit=firstDocumentMatch(pattern,document);
 if(!hit)return null;
 const start=Math.max(0,hit.from-36),end=Math.min(document.length,Math.min(hit.to,hit.from+80)+56);
 const snippet=document.slice(start,end).replace(/\ufffc/g,'•').replace(/\s+/g,' ').trim();
 return `${start?'…':''}${snippet}${end<document.length?'…':''}`;
}

export function searchNodeDocuments(world:World,value:string){
 const pattern=documentSearchPattern(value),matches:{origin:Origin;label:string;snippet:string}[]=[];
 if(!pattern)return {matches,truncated:false};
 const resolve=createInheritanceReader(world),snippets=new Map<NodeText,string|null>();
 for(const node of world.nodes){
  if(!node.text&&!node.variantOf)continue;
  const {label,text}=resolve(node);
  if(!text)continue;
  let snippet=snippets.get(text);
  if(snippet===undefined){snippet=matchSnippet(pattern,text);snippets.set(text,snippet);}
  if(snippet===null)continue;
  if(matches.length===50)return {matches,truncated:true};
  matches.push({origin:node.origin,label:label||'Untitled',snippet});
 }
 return {matches,truncated:false};
}
