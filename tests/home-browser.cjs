const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
(async()=>{
 const app=await fixture({SEED_SHOWCASE_PROPERTIES:'1'});let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.base);await page.getByRole('heading',{name:'A place to call home. A team you can count on.'}).waitFor();
  await page.locator('#vacancy-list .empty-state').waitFor();await page.locator('#home-showcase-properties .property-card').first().waitFor();assert.equal(await page.locator('#home-showcase-properties .property-card').count(),6);assert.equal(await page.locator('#home-showcase-properties [data-apply]').count(),0);
  assert.equal(await page.getByRole('link',{name:/add a property/i}).count(),0);
  await page.locator('.home-header').getByRole('link',{name:'Sign in',exact:true}).click();await page.locator('#login-form').waitFor();
  assert.equal(await page.locator('#login-form [name="role"]').count(),0);
  await page.locator('#login-form [name="email"]').fill(app.credentials.email);await page.locator('#login-form [name="password"]').fill(app.credentials.password);await page.locator('#sign-in').click();
  await page.locator('#dashboard-add-property').click();await page.getByRole('heading',{name:'Add a property.'}).waitFor();
  for(const [key,value] of Object.entries({name:'Community House <test>',area:'Town center',address:'123 Property Lane',price:'1875.50',beds:'2',baths:'1.5',size:'1250'}))await page.locator('#property-form [name="'+key+'"]').fill(value);
  await page.locator('#property-form [name="available"]').selectOption('true');await page.locator('#property-form button').click();await page.locator('#all-homes h3').filter({hasText:'Community House <test>'}).waitFor();
  await page.locator('.top-actions').getByRole('link',{name:'Public home'}).click();await page.locator('#vacancy-list h3').filter({hasText:'Community House <test>'}).waitFor();assert.equal(await page.locator('#available-total').textContent(),'1');
  await page.locator('#vacancy-list').getByRole('button',{name:'Apply for this home'}).click();await page.locator('#vacancy-application-form').waitFor();
  for(const [key,value] of Object.entries({name:'Prospective Resident',email:'prospect@example.test',phone:'202-555-0100',moveIn:'2099-01-01',occupants:'2'}))await page.locator('#vacancy-application-form [name="'+key+'"]').fill(value);
  await page.locator('#vacancy-application-form [name="consent"]').check();await page.getByRole('button',{name:'Submit application'}).click();await page.getByRole('heading',{name:'Application received.'}).waitFor();assert.equal(new URL(page.url()).pathname,'/');await page.locator('#close-application').click();
  await page.screenshot({path:'/tmp/ctpm-public-home.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/ctpm-public-home-mobile.png',fullPage:true});
  const tenant=await browser.newPage({viewport:{width:390,height:844}});tenant.on('pageerror',e=>errors.push(e.message));await tenant.goto(app.base+'/signup');await tenant.locator('.account-notice summary').click();await tenant.getByText('Creating an account does not approve an application',{exact:false}).waitFor();
  for(const [key,value] of Object.entries({name:'New tenant <test>',email:'new-signup@example.test',password:'A long new tenant password 123',confirmation:'A different long password 123'}))await tenant.locator('#signup-form [name="'+key+'"]').fill(value);
  await tenant.locator('#signup-form [name="consent"]').check();await tenant.locator('#create-tenant').click();await tenant.locator('#signup-error').filter({hasText:'Passwords do not match.'}).waitFor();
  await tenant.locator('#signup-form [name="confirmation"]').fill('A long new tenant password 123');await tenant.locator('#create-tenant').click();await tenant.locator('#account-name').filter({hasText:'New tenant <test>'}).waitFor({state:'attached'});assert.equal(new URL(tenant.url()).pathname,'/dashboard');assert.equal(await tenant.locator('#team-nav').isVisible(),false);assert.equal(await tenant.locator('#add-property').isVisible(),false);
  await tenant.locator('#logout').click();await tenant.waitForURL('**/login');await tenant.locator('#login-form [name="email"]').fill('new-signup@example.test');await tenant.locator('#login-form [name="password"]').fill('A long new tenant password 123');await tenant.locator('#sign-in').click();await tenant.locator('#account-role').filter({hasText:'Tenant account'}).waitFor({state:'attached'});
  assert.equal(await tenant.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS: public home, six manageable showcase homes, staff-only dashboard property creation, live listing/application, tenant registration, automatic role detection, and mobile layouts.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
