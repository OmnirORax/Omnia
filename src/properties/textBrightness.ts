/** Text brightness changes HSL lightness, preserving hue instead of clipping RGB channels. */
export function textBrightness(color:string,brightness=.5){
 brightness=Math.max(0,Math.min(1,brightness));
 if(brightness===.5)return color;
 if(brightness<=0)return '#000000';
 const rgb=[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min,light=(max+min)/2;
 const next=brightness<.5?light*brightness*2:light+(1-light)*(brightness*2-1);
 if(!delta){const channel=Math.round(next*255).toString(16).padStart(2,'0');return '#'+channel.repeat(3);}
 const saturation=delta/(1-Math.abs(2*light-1));
 let hue=max===rgb[0]?((rgb[1]-rgb[2])/delta)%6:max===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4;
 hue=(hue+6)%6;
 const chroma=(1-Math.abs(2*next-1))*saturation,x=chroma*(1-Math.abs(hue%2-1)),m=next-chroma/2;
 const channels=hue<1?[chroma,x,0]:hue<2?[x,chroma,0]:hue<3?[0,chroma,x]:hue<4?[0,x,chroma]:hue<5?[x,0,chroma]:[chroma,0,x];
 return '#'+channels.map(channel=>Math.round((channel+m)*255).toString(16).padStart(2,'0')).join('');
}
