import type {NodeText,TextPart} from './model.ts';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const wrap=(tag:string,open:string,close:string,body:string,extra='')=>`<${tag} data-node-md-open="${escape(open)}" data-node-md-close="${escape(close)}"${extra}>${body}</${tag}>`;
/** Source remains ordinary mixed-document text. Glyph positions are tokens, never
 * interpolated into Markdown syntax or parsed as arbitrary HTML. */
export function markdownHTML(value:NodeText,glyph:(part:Exclude<TextPart,string>)=>string):string{
 let source='';const objects=new Map<number,Exclude<TextPart,string>>();
 for(const part of value.content){if(typeof part==='string')source+=part;else{objects.set(source.length,part);source+='\ufffc';}}
 const literal=(start:number,end:number)=>{let html='',plain=start;for(let i=start;i<end;i++)if(objects.has(i)){html+=escape(source.slice(plain,i))+glyph(objects.get(i)!);plain=i+1;}return html+escape(source.slice(plain,end));};
 let remaining=source.length*32+1024;
 const find=(marker:string,start:number,end:number)=>{if(remaining<=0)return -1;const at=source.indexOf(marker,start);remaining-=Math.max(0,Math.min(at<0?end:at,end)-start)+marker.length;return at>=0&&at<end?at:-1;};
 const inline=(start:number,end:number,depth=0):string=>{
  if(depth>24||remaining<=0)return literal(start,end);let html='',plain=start;
  for(let i=start;i<end;){
   if(remaining--<=0)return html+literal(plain,end);
   if(objects.has(i)){i++;continue;}
   if(source[i]==='\\'&&i+1<end&&/[\\`*_~]/.test(source[i+1])){html+=literal(plain,i)+wrap('span','\\','',literal(i+1,i+2));i+=2;plain=i;continue;}
   const marker=source.startsWith('***',i)?'***':source.startsWith('___',i)?'___':source.startsWith('**',i)?'**':source.startsWith('__',i)?'__':source.startsWith('~~',i)?'~~':source[i]==='*'?'*':source[i]==='_'?'_':source[i]==='`'?/^`+/.exec(source.slice(i,end))![0]:undefined;
   if(!marker||source[i+marker.length]?.match(/\s/)){i++;continue;}
   if(marker==='_'&&/[\p{L}\p{N}]/u.test(source[i-1]??'')){i++;continue;}
   let close=find(marker,i+marker.length,end);
   while(close>=0&&close<end&&(source[close-1]==='\\'||/\s/.test(source[close-1])||marker.length===1&&source[close+1]===marker))close=find(marker,close+marker.length,end);
   if(close<0||close>=end||close===i+marker.length){i+=marker.length;continue;}
   const tag=marker==='**'||marker==='__'||marker==='***'||marker==='___'?'strong':marker==='~~'?'del':marker[0]==='`'?'code':'em';
   const body=marker[0]==='`'?literal(i+marker.length,close):inline(i+marker.length,close,depth+1);
   html+=literal(plain,i)+wrap(tag,marker,marker,marker==='***'||marker==='___'?`<em>${body}</em>`:body);i=close+marker.length;plain=i;
  }
  return html+literal(plain,end);
 };
 let html='',offset=0;
 const lines=source.split('\n');
 for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
  const line=lines[lineIndex],fence=/^(`{3,}|~{3,})[^`]*$/.exec(line);
  if(fence&&remaining>0){let closing=lineIndex+1;while(closing<lines.length&&remaining>0&&!new RegExp(`^${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[closing])){remaining-=lines[closing].length+1;closing++;}
   if(closing<lines.length&&remaining>0){const bodyStart=offset+line.length+1,bodyEnd=bodyStart+lines.slice(lineIndex+1,closing).join('\n').length;html+=wrap('span',line+'\n',(closing>lineIndex+1?'\n':'')+lines[closing],literal(bodyStart,bodyEnd),' class="node-md-codeblock"');offset+=lines.slice(lineIndex,closing+1).join('\n').length;lineIndex=closing;if(offset<source.length){html+='\n';offset++;}continue;}
  }
  const heading=/^(#{1,6})[ \t]+/.exec(line),quote=/^>[ \t]?/.exec(line),list=/^(?:[-+*]|\d+\.)[ \t]+/.exec(line),prefix=heading?.[0]??quote?.[0]??list?.[0];
  const body=inline(offset+(prefix?.length??0),offset+line.length);
  html+=prefix?wrap('span',prefix,'',body,` class="node-md-${heading?'heading node-md-h'+heading[1].length:quote?'quote':'list'}"${list?` data-node-md-bullet="${escape(/^\d/.test(prefix)?prefix.trim():'•')}"`:''}`):body;
  offset+=line.length;if(offset<source.length){html+='\n';offset++;}
 }
 return html;
}
/** Used only on a delimiter edit, before applying a bounded native edit transaction. */
export function hasInlineMarkdown(text:string){return /^(?:#{1,6}|>|[-+*]|\d+\.)[ \t]/m.test(text)|| /(?:\*\*[^\n]+\*\*|__[^\n]+__|~~[^\n]+~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/.test(text);}
