// Keep existing utility controls and their event handlers together on smaller screens.
(()=>{
 const selector='#display-trigger,#portal-back-top,#site-help-trigger,.scene-controls';
 const dock=document.createElement('div');dock.id='portal-utilities';dock.setAttribute('role','group');dock.setAttribute('aria-label','Page tools');
 function mount(){
  for(const query of ['#site-help-trigger','#display-trigger','#portal-back-top','.scene-controls']){const node=document.querySelector(query);if(node&&node.parentElement!==dock)dock.append(node);}
  const help=dock.querySelector('#site-help-trigger');if(help&&!help.querySelector('[data-utility-label]')){const label=document.createElement('span');label.dataset.utilityLabel='';label.textContent='Help';label.setAttribute('aria-hidden','true');help.append(label);}
  const motion=dock.querySelector('.building-motion-toggle');if(motion&&!motion.id)motion.id='portal-motion-toggle';
  if(dock.children.length&&!dock.isConnected){document.body.append(dock);document.documentElement.classList.add('has-page-tools');}
  const display=document.querySelector('#display-dialog');if(display&&!display.querySelector('#portal-display-content')){const content=document.createElement('div');content.id='portal-display-content';for(const node of [...display.childNodes])if(!node.matches?.('.display-close'))content.append(node);display.append(content);}
 }
 function setup(){mount();new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector)))))mount();}).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
