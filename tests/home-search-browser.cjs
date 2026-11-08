const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
(async()=>{
 const app=await fixture();let browser;
 try{
  const sign=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base},body:JSON.stringify(app.credentials)});const cookie=sign.headers.get('set-cookie').split(';')[0];
  const post=(path,data)=>fetch(app.base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base,Cookie:cookie},body:JSON.stringify(data)});
  for(const role of ['agent','tenant'])assert.equal((await post('/api/admin/users',{name:'Test '+role,email:role+'@example.test',role,password:app.credentials.password})).status,201);
  const listings=[];for(const p of inventory){const r=await post('/api/properties',p);assert.equal(r.status,201);listings.push((await r.json()).property);}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const guest=await browser.newPage({viewport:{width:390,height:844}}),staff=await browser.newPage(),tenant=await browser.newPage({viewport:{width:390,height:844}}),errors=[];for(const p of [guest,staff,tenant])p.on('pageerror',e=>errors.push(e.message));
  await guest.goto(app.base);await guest.locator('#vacancy-list .property-card').first().waitFor();
  assert.equal(await guest.getByRole('link',{name:/add.*property/i}).count(),0);assert.equal(await guest.getByRole('button',{name:/add.*property/i}).count(),0);
  await guest.locator('#vacancy-beds').selectOption('2');await guest.locator('#vacancy-budget').fill('1800');assert.equal(await guest.locator('#vacancy-list .property-card').count(),2);
  await guest.locator('#vacancy-sort').selectOption('price-high');assert.equal(await guest.locator('#vacancy-list h3').first().textContent(),'Garden Square');
  await guest.locator('#vacancy-budget').fill('1700');assert.equal(await guest.locator('#vacancy-list .property-card').count(),1);
  await guest.getByRole('button',{name:'View details',exact:true}).click();await guest.locator('#application-modal').getByRole('heading',{name:'Cedar Court <test>',exact:true}).waitFor();
  const shared=await guest.locator('#property-share-link').inputValue();assert.equal(shared,app.base+'/vacancies?listing='+listings[0].id);
  await guest.goto(shared);await guest.locator('#application-modal').getByRole('heading',{name:'Cedar Court <test>',exact:true}).waitFor();await guest.locator('#application-modal').getByRole('button',{name:'Apply for this home'}).click();await guest.locator('#vacancy-application-form').waitFor();await guest.locator('#close-application').click();
  await guest.locator('#clear-vacancy-filters').click();assert.equal(await guest.locator('#vacancy-list .property-card').count(),4);assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const login=async(page,role)=>{await page.goto(app.base+'/login');await page.locator('[name="email"]').fill(role+'@example.test');await page.locator('[name="password"]').fill(app.credentials.password);await page.locator('#sign-in').click();await page.locator('#account-name').filter({hasText:role==='admin'?'Company Administrator':'Test '+role}).waitFor({state:'attached'});};
  for(const role of ['agent','admin']){
   await login(staff,role);await staff.locator('#dashboard-add-property').waitFor();assert.equal(await staff.locator('#saved-nav').isVisible(),false);
   await staff.goto(app.base);await staff.locator('#vacancy-list .property-card').first().waitFor();assert.equal(await staff.getByRole('link',{name:/add.*property/i}).count(),0);
   await staff.goto(app.base+'/dashboard');await staff.locator('[data-page="homes"]').click();assert.equal(await staff.locator('#crumb').textContent(),'Property');assert.match(await staff.locator('[data-page="homes"]').innerText(),/Property$/);await staff.locator('[data-page="overview"]').click();await staff.locator('#dashboard-add-property').click();await staff.getByRole('heading',{name:'Add a property.',exact:true}).waitFor();await staff.locator('#close-modal').click();
   await staff.locator('#logout').click();await staff.waitForURL('**/login');
  }
  await login(tenant,'tenant');assert.equal(await tenant.locator('#dashboard-add-property').isVisible(),false);assert.equal(await tenant.locator('[data-page="homes"]').isVisible(),false);assert.equal(await tenant.locator('#saved-nav').isVisible(),false);assert.equal(await tenant.locator('#dashboard-available').isVisible(),false);
  await tenant.evaluate(async id=>{const response=await fetch('/api/properties/'+id+'/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({saved:true})});if(!response.ok)throw Error('Legacy shortlist setup failed');},listings[0].id);
  for(const route of ['homes','saved']){await tenant.goto(app.base+'/dashboard#'+route);await tenant.waitForURL('**#overview');assert.equal(await tenant.locator('#all-homes .property-card').count(),0);assert.equal(await tenant.locator('#saved-homes-list .property-card').count(),0);assert.equal(await tenant.locator('#featured .property-card').count(),0);}
  await tenant.goto(app.base+'/dashboard?newProperty=1');await tenant.waitForURL('**#overview');assert.equal(await tenant.locator('#property-form').count(),0);
  await post('/api/properties/'+listings[0].id+'/availability',{available:false});
  await guest.goto(shared);await guest.locator('#vacancies-error').filter({hasText:'no longer available'}).waitFor();assert.equal(await guest.locator('#application-modal').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: staff-only property creation on dashboards, no public add controls for any role, public filters/details/share links, resident dashboard vacancy and shortlist isolation, and unavailable-home handling.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
