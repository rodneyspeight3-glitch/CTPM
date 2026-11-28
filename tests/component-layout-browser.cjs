const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{fixture}=require('./fixture.cjs'),contrast=require('./contrast-audit.cjs');
const inventory=require('./listing-fixtures.cjs'),{rentalApplication}=require('./rental-fixtures.cjs');
const report={checks:0,failures:[],errors:[],external:[],components:[]};
(async()=>{
 const app=await fixture({SMTP_ENABLED:'false',EMAIL_DELIVERY_DISABLED:'true'});let browser;
 try{
  const sign=await fetch(app.base+'/api/login',{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json'},body:JSON.stringify(app.credentials)}),cookie=sign.headers.get('set-cookie').split(';')[0];
  const post=async(path,data)=>{const r=await fetch(app.base+path,{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});assert.ok(r.ok,path+' '+r.status+' '+await r.clone().text());return r.json();};
  const resident=(await post('/api/admin/users',{name:'Resident with a longer display name for layout review',email:'resident@example.test',password:app.credentials.password,role:'tenant'})).user;
  await post('/api/admin/users',{name:'Unassigned resident for the lease editor',email:'unassigned@example.test',password:app.credentials.password,role:'tenant'});
  await post('/api/admin/users',{name:'Leasing specialist with a longer public display name',email:'agent@example.test',password:app.credentials.password,role:'agent'});
  const home=(await post('/api/properties',{...inventory[0],name:'The Courtyard Residences with a longer property name',address:'12345 Long Courtyard Boulevard, Apartment 1200, Beverly Hills, CA 90210'})).property;
  const photo=i=>({mime:'image/jpeg',data:fs.readFileSync('public/images/home-'+i+'.jpg').toString('base64')});
  await post('/api/properties/'+home.id+'/photo',photo(1));for(let i=0;i<8;i++)await post('/api/properties/'+home.id+'/gallery',{...photo(i%2+2),caption:'A helpful description of room '+(i+1)});
  await post('/api/vacancies/'+home.id+'/applications',rentalApplication());
  const occupied=(await post('/api/properties',{...inventory[1],name:'Occupied home for component review',available:false})).property;
  await post('/api/leases',{tenantId:resident.id,propertyId:occupied.id,startsOn:'2026-01-01',endsOn:'2099-01-01',monthlyRent:1800,deposit:1000,notes:'Synthetic lease for component review.'});
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(app.databasePath);db.prepare('UPDATE users SET email_verified_at=?').run(new Date().toISOString());db.close();
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>report.errors.push(error.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==app.base)report.external.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('ctpm-appearance',JSON.stringify({theme:'light',motion:'reduced'})));
  async function login(email){await page.goto(app.base+'/login');await page.locator('#login-form [name=email]').fill(email);await page.locator('#login-form [name=password]').fill(app.credentials.password);await page.locator('#sign-in').click();await page.waitForURL('**/dashboard');await page.waitForLoadState('networkidle');}
  async function navigate(hash){await page.setViewportSize({width:1440,height:1000});await page.locator('.sidebar [data-page="'+hash+'"]').click();await page.locator('#'+hash+'.page:not([hidden])').waitFor();await page.waitForLoadState('networkidle');}
  async function audit(label){
   await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const result=await page.evaluate(()=>{
    const dialogs=[...document.querySelectorAll('dialog[open]')],dialog=dialogs.at(-1),r=dialog?.getBoundingClientRect(),issues=[];
    if(document.documentElement.scrollWidth>innerWidth)issues.push('page overflows horizontally');
    if(dialog){
     if(dialog.scrollWidth>dialog.clientWidth+1)issues.push('dialog overflows horizontally');
     if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)issues.push('dialog extends outside viewport');
     const label=dialog.getAttribute('aria-label')||(dialog.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent.trim()).join(' ').trim();if(!label)issues.push('dialog has no accessible title');
     for(const input of dialog.querySelectorAll('input:not([type=hidden]),select,textarea'))if(input.checkVisibility()&&!input.labels?.length&&!input.getAttribute('aria-label')&&!input.getAttribute('aria-labelledby'))issues.push('field needs a label: '+(input.name||input.id));
     for(const button of dialog.querySelectorAll('button'))if(button.checkVisibility()&&!button.textContent.trim()&&!button.getAttribute('aria-label')&&!button.getAttribute('aria-labelledby'))issues.push('button needs an accessible name');
    }
    return issues;
   });
   const colors=(await page.evaluate(contrast)).filter(x=>!x.photo);
   const close=await page.evaluate(async()=>{
    const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(!dialog)return null;const button=dialog.querySelector('#close-modal,#close-application,#hub-close,.display-close,.property-viewer-close,#site-help-close');if(!button)return null;
    dialog.scrollTop=dialog.scrollHeight;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),visible=b.top>=0&&b.bottom<=innerHeight+1&&button.contains(hit);dialog.scrollTop=0;return visible;
   });
   report.checks++;if(result.length||colors.length||close===false)report.failures.push({label,issues:result,colors,closeReachable:close});
  }
  async function matrix(name){report.components.push(name);console.log('AUDIT '+name);for(const [width,height]of [[1440,1000],[1024,900],[768,480],[390,844],[320,740]])for(const theme of ['light','dark']){await page.setViewportSize({width,height});await page.evaluate(theme=>PortalAppearance.update({theme,textSize:'standard',lineSpace:'standard',touch:false}),theme);await audit(name+' '+width+'x'+height+' '+theme);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>PortalAppearance.update({theme:'dark',textSize:'larger',lineSpace:'relaxed',touch:true}));await audit(name+' larger text and controls');await page.evaluate(()=>PortalAppearance.update({theme:'light',textSize:'standard',lineSpace:'standard',touch:false}));}
  async function close(){await page.evaluate(()=>{for(const dialog of [...document.querySelectorAll('dialog[open]')].reverse())dialog.close();});await page.waitForFunction(()=>!document.querySelector('dialog[open]'));}
  await login(app.credentials.email);
  for(const width of [900,1024,1100]){await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await page.locator('#logout-side').evaluate(button=>{if(!button.checkVisibility())return true;const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Page tools cover the tablet sign-out control');}
  const cases=[
   ['property create','homes','#add-property'],['property edit','homes','[data-edit-property="'+home.id+'"]'],['gallery and descriptions','homes','[data-gallery-property="'+home.id+'"]'],['cover photo upload','homes','[data-photo-property="'+home.id+'"]'],
   ['lease assignment','leases','#add-lease'],['rent charge','ledger','#add-charge'],['resident message','messages','#new-message'],['account create','team','#create-account'],['agent create','team','#create-agent'],
   ['contractor create','contractors','#create-contractor'],['viewing time','tours','#create-tour-slot'],['agent profile and photo','agent-profiles','[data-edit-agent-profile]'],
   ['expense record','reports','#add-expense'],['expense budget','reports','#set-expense-budget'],['team task','workspace','#new-team-task'],['maintenance plan','workspace','#new-maintenance-plan'],
   ['community notice','community','#publish-notice'],['private note','organizer','#organizer-new-note'],['private task','organizer','#organizer-new-task'],['populated notifications','overview','#notifications'],
   ['application review','applications','[data-review-application]'],['email composer','email-history','#compose-email']
  ];
  for(const [name,hash,selector]of cases){await navigate(hash);await page.locator(selector).filter({visible:true}).first().click();await page.locator('dialog[open]').last().waitFor();await matrix(name);await close();}
  for(const board of ['inspections','keys','assets','safety','move-in','move-out','quotes','orders','projects','utilities']){await navigate('workbench');await page.locator('#hub-board').selectOption(board);await page.locator('#hub-new').click();await matrix('operations '+board);await close();}
  await navigate('integrations');await page.locator('#smtp-settings-form').waitFor();for(const theme of ['light','dark']){await page.setViewportSize({width:390,height:844});await page.evaluate(theme=>PortalAppearance.update({theme}),theme);await audit('SMTP settings '+theme);}
  // Replacing a dialog's content must keep its original focus return target.
  await navigate('homes');const opener=page.locator('#all-homes [data-gallery-property="'+home.id+'"]');await opener.click();await page.locator('#gallery-upload-form').waitFor();await page.locator('[data-describe-gallery] [name=caption]').first().fill('Updated room description');await page.locator('[data-describe-gallery] [type=submit]').first().click();await page.locator('.service-photo-grid figcaption').filter({hasText:'Updated room description'}).waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-gallery-property'));
  await page.locator('#logout').click();await page.waitForURL('**/login');await login(resident.email);await navigate('requests');await page.locator('#request-page-button').click();await matrix('resident maintenance request');await close();await navigate('searches');await page.locator('#create-saved-search').click();await matrix('resident saved search');await close();
  // Utility controls reserve their own row instead of covering the next-photo action.
  await page.goto(app.base+'/',{waitUntil:'networkidle'});const root=page.locator('#vacancy-list [data-property-slides]').first();await root.scrollIntoViewIfNeeded();await page.waitForFunction(()=>Number(document.querySelector('#vacancy-list [data-property-slides]')?.dataset.photoCount)>1);
  for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{const r=document.querySelector('#vacancy-list [data-property-slides]').getBoundingClientRect();scrollBy(0,r.bottom-innerHeight);});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await root.locator('.property-slide-next').evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'The next-photo action must be onscreen and unobstructed at '+width);assert.ok(await page.locator('#portal-utilities').evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight+1;}));}
  await page.setViewportSize({width:390,height:900});await root.scrollIntoViewIfNeeded();await root.locator('.property-slide-next').click();await root.locator('.property-slide-expand').click();await matrix('larger property photo viewer');await close();
  await page.locator('#display-trigger').click();await matrix('display preferences');await close();await page.locator('#site-help-trigger').click();await matrix('built-in help');await close();
  await page.setViewportSize({width:390,height:900});await page.evaluate(()=>PortalAppearance.update({theme:'light'}));await root.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/ctpm-layout-tools-phone.png'});
  fs.writeFileSync('/tmp/ctpm-component-layout-results.json',JSON.stringify(report,null,2));assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.failures,[]);console.log('PASS: '+report.checks+' component layout/contrast checks across '+report.components.length+' dialogs; tablet/phone/landscape/desktop, larger text, labels, sticky close controls, focus return and unobstructed photo navigation.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{fs.writeFileSync('/tmp/ctpm-component-layout-results.json',JSON.stringify(report,null,2));console.error(error);process.exit(1)});
