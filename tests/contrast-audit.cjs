module.exports=()=>{
 const rgba=value=>{const n=String(value).match(/[\d.]+/g);return n?[+n[0],+n[1],+n[2],n[3]===undefined?1:+n[3]]:[0,0,0,0];};
 const blend=(top,base)=>top.slice(0,3).map((v,i)=>v*top[3]+base[i]*(1-top[3])).concat(1);
 const luminance=color=>color.slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const path=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'');
 const results=[];
 for(const el of (document.querySelector('dialog[open]')||document.body).querySelectorAll('*')){
  if((['SCRIPT','STYLE','SVG','PATH','OPTION'].includes(el.tagName)||el.matches('input[type=checkbox],input[type=radio],input[type=hidden]'))||el.closest('[hidden],svg,[aria-hidden=true]')||!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||el.getClientRects().length===0)continue;
  const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim()||(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)?el.value||el.getAttribute('placeholder')||'':'');if(!text||!/[A-Za-z0-9]/.test(text))continue;
  const style=getComputedStyle(el),ancestors=[];let opacity=1,photo=false;for(let item=el;item;item=item.parentElement){ancestors.unshift(item);const s=getComputedStyle(item);opacity*=+s.opacity;if(s.backgroundImage.includes('url('))photo=true;}
  let background=[255,255,255,1];for(const item of ancestors){const s=getComputedStyle(item);background=blend(rgba(s.backgroundColor),background);if(s.backgroundImage.includes('gradient(')&&!s.backgroundImage.includes('url(')){const first=s.backgroundImage.match(/rgba?\([^)]*\)/);if(first)background=blend(rgba(first[0]),background);}}
  const color=rgba(style.color);color[3]*=opacity;const foreground=blend(color,background),ratio=contrast(foreground,background),size=parseFloat(style.fontSize),minimum=size>=24||size>=18.67&&+style.fontWeight>=700?3:4.5;
  if(ratio<minimum-.02&&!el.matches(':disabled')&&!el.closest('button:disabled,fieldset:disabled'))results.push({selector:path(el),parent:path(el.parentElement),text:text.slice(0,95),ratio:+ratio.toFixed(2),minimum,size,color:style.color,background:background.slice(0,3).map(Math.round).join(','),photo});
  if(el.matches('input,textarea')&&el.getAttribute('placeholder')){const p=getComputedStyle(el,'::placeholder'),c=rgba(p.color);c[3]*=+p.opacity*opacity;const score=contrast(blend(c,background),background);if(score<4.48)results.push({selector:path(el)+'::placeholder',parent:path(el.parentElement),text:el.placeholder,ratio:+score.toFixed(2),minimum:4.5,size,color:p.color,background:background.slice(0,3).map(Math.round).join(','),photo});}
 }
 return results;
};
