(()=>{
 if(!window.agentPortraitMarkup)return;
 const character=style=>{
  const template=document.createElement('template');template.innerHTML=window.agentPortraitMarkup({id:0,name:'Welcome character',avatarStyle:style});
  const svg=template.content.querySelector('svg');svg.classList.add('welcome-character');return svg;
 };
 const ambient=document.createElement('div');ambient.className='welcome-ambient';ambient.setAttribute('aria-hidden','true');ambient.inert=true;
 for(const [index,style] of ['male','female'].entries()){const figure=document.createElement('div');figure.className='welcome-background-person welcome-background-'+index;figure.append(character(style));ambient.append(figure);}
 document.body.prepend(ambient);document.body.classList.add('welcome-page');
 for(const cast of document.querySelectorAll('[data-welcome-cast]')){
  cast.setAttribute('aria-hidden','true');cast.inert=true;
  for(const style of ['male','female']){const person=document.createElement('span');person.className='welcome-cast-person welcome-cast-'+style;person.append(character(style));cast.append(person);}
 }
})();
