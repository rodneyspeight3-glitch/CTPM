const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
(async()=>{
 const app=await fixture({SEED_SHOWCASE_PROPERTIES:'1'});let browser;
 try{
  const auth=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base},body:JSON.stringify(app.credentials)}),cookie=auth.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(app.base+'/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base,Cookie:cookie},body:JSON.stringify({name:'Agent',email:'agent@example.test',role:'agent',password:app.credentials.password})})).status,201);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const staff=await browser.newPage({viewport:{width:1440,height:1000}}),guest=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  for(const page of [staff,guest])page.on('pageerror',e=>errors.push(e.message));
  await guest.goto(app.base);await guest.locator('#home-showcase-properties .property-card').first().waitFor();assert.equal(await guest.locator('#home-showcase-properties .property-card').count(),6);assert.equal(/sample/i.test(await guest.locator('body').innerText()),false);
  await guest.goto(app.base+'/login');await guest.getByRole('tab',{name:'Create tenant account'}).click();assert.equal(new URL(guest.url()).pathname,'/login');assert.equal(await guest.locator('#auth-content form').count(),1);await guest.locator('#signup-form').waitFor();
  await guest.locator('#signup-tab').press('ArrowLeft');await guest.locator('#login-form').waitFor();await guest.locator('#signin-tab').press('ArrowRight');await guest.locator('#signup-form').waitFor();assert.equal(await guest.locator('#signup-tab').getAttribute('aria-selected'),'true');assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await guest.screenshot({path:'/tmp/ctpm-combined-access.png',fullPage:true});
  const login=async role=>{await staff.goto(app.base+'/login');await staff.locator('[name="email"]').fill(role+'@example.test');await staff.locator('[name="password"]').fill(app.credentials.password);await staff.locator('#sign-in').click();await staff.locator('#account-role').filter({hasText:role==='admin'?'Admin account':'Agent account'}).waitFor({state:'attached'});await staff.locator('[data-page="homes"]').click();await staff.locator('#all-homes h3').filter({hasText:'The Willow House'}).waitFor();};
  await login('agent');assert.equal(await staff.locator('#all-homes .property-card').count(),6);assert.equal(await staff.locator('#all-homes [data-delete-property]').count(),6);
  const willow=staff.locator('#all-homes .property-card').filter({hasText:'The Willow House'});await willow.getByRole('button',{name:'Delete property',exact:true}).click();await staff.locator('#confirm-delete-property').click();await staff.locator('#toast').filter({hasText:'Property deleted.'}).waitFor();
  await staff.reload();await staff.locator('#all-homes .property-card').first().waitFor();assert.equal(await staff.locator('#all-homes .property-card').count(),5);assert.equal(await staff.locator('#all-homes h3').filter({hasText:'The Willow House'}).count(),0);
  await guest.goto(app.base);await guest.locator('#home-showcase-properties .property-card').first().waitFor();assert.equal(await guest.locator('#home-showcase-properties .property-card').count(),5);
  const oakwood=staff.locator('#all-homes .property-card').filter({hasText:'The Oakwood'});await oakwood.getByRole('button',{name:'Edit property',exact:true}).click();
  await staff.locator('#property-form [name="address"]').fill('300 Verified Property Street');await staff.locator('#property-form [name="isPreview"]').selectOption('false');await staff.locator('#property-form [name="available"]').selectOption('true');await staff.locator('#property-form [name="description"]').fill('A bright home with flexible spaces.');await staff.locator('#property-form [name="amenities"]').fill('Garden, Parking, Laundry');await staff.locator('#property-form button').click();await staff.locator('#toast').filter({hasText:'Property updated.'}).waitFor();
  await guest.goto(app.base+'/vacancies');await guest.locator('#vacancy-list h3').filter({hasText:'The Oakwood'}).waitFor();assert.equal(await guest.locator('#vacancy-list .amenity-tags').getByText('Garden',{exact:true}).count(),1);
  await guest.getByRole('button',{name:'View details',exact:true}).click();await guest.locator('#application-modal').getByText('A bright home with flexible spaces.',{exact:true}).waitFor();await guest.locator('#close-application').click();
  await staff.locator('#logout').click();await staff.waitForURL('**/login');await staff.locator('[name="email"]').fill(app.credentials.email);await staff.locator('[name="password"]').fill(app.credentials.password);await staff.locator('#sign-in').click();await staff.locator('[data-page="homes"]').click();
  const parkside=staff.locator('#all-homes .property-card').filter({hasText:'Parkside Residences'});await parkside.getByRole('button',{name:'Delete property',exact:true}).click();await staff.locator('#confirm-delete-property').click();await staff.locator('#toast').filter({hasText:'Property deleted.'}).waitFor();
  await staff.setViewportSize({width:390,height:844});assert.equal(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS: merged sign-in/signup tabs, mobile access, all seeded homes visible to staff, deletion by agents/admins, persistent removal from public collection, and verified listing conversion with amenities.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
