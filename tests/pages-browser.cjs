const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
(async()=>{
 const app=await fixture();let browser;
 try{
  const r=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base},body:JSON.stringify(app.credentials)});
  const cookie=r.headers.get('set-cookie').split(';')[0];
  for(const role of ['agent','tenant'])assert.equal((await fetch(app.base+'/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base,Cookie:cookie},body:JSON.stringify({name:'Test '+role,email:role+'@example.test',password:app.credentials.password,role})})).status,201);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const signIn=async role=>{
   await page.goto(app.base+'/login');await page.locator('[name="email"]').fill(role+'@example.test');await page.locator('[name="password"]').fill(app.credentials.password);await page.locator('#sign-in').click();await page.locator('#account-name').filter({hasText:role==='admin'?'Company Administrator':'Test '+role}).waitFor({state:'attached'});
  };
  await signIn('admin');
  for(const name of ['overview','homes','requests','leases','ledger','messages','documents','applications','team','settings','account']){
   await page.locator('[data-page="'+name+'"]').click();await page.locator('#'+name).waitFor();
   await page.reload();await page.locator('#'+name).waitFor();assert.equal(new URL(page.url()).hash,'#'+name);
  }
  await page.locator('[data-page="settings"]').click();
  const settings={companyName:'Community Office <test>',contactEmail:'management@example.test',contactPhone:'202-555-0101',paymentLabel:'Pay rent',paymentUrl:'https://payments.example.test/residents',paymentAccountName:'Example Account Holder',paymentBankName:'Example Bank',paymentAccountDetails:'Reference: Unit number',paymentInstructions:'Use the portal or contact the office. <test>'};
  for(const [name,value] of Object.entries(settings))await page.locator('#settings-form [name="'+name+'"]').fill(value);
  await page.locator('#settings-form button[type="submit"]').click();await page.locator('#toast').filter({hasText:'Management details saved.'}).waitFor();
  await page.reload();await page.locator('#settings-updated').filter({hasText:'Last updated'}).waitFor();assert.equal(await page.locator('[name="paymentAccountName"]').inputValue(),settings.paymentAccountName);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#logout').click();await page.waitForURL('**/login');
  await signIn('agent');await page.locator('#settings-nav').click();await page.locator('#settings-updated').filter({hasText:'Last updated'}).waitFor();
  await page.locator('[name="paymentInstructions"]').fill('Updated rent instructions by agent.');
  await page.locator('#settings-form button[type="submit"]').click();await page.locator('#toast').filter({hasText:'Management details saved.'}).waitFor();
  assert.equal(await page.locator('#team-nav').isVisible(),false);
  await page.locator('[data-page="account"]').click();
  await page.locator('[name="currentPassword"]').fill(app.credentials.password);await page.locator('[name="newPassword"]').fill('Changed agent password 123456');await page.locator('[name="confirmation"]').fill('Changed agent password 123456');await page.locator('#password-form button').click();await page.waitForURL('**/login');
  await signIn('tenant');assert.equal(await page.locator('#settings-nav').isVisible(),false);
  await page.goto(app.base+'/#settings');await page.locator('#account-name').filter({hasText:'Test tenant'}).waitFor({state:'attached'});await page.locator('#overview').waitFor();assert.equal(new URL(page.url()).hash,'#overview');
  await page.locator('#payment').click();await page.locator('#modal-content').getByText('Updated rent instructions by agent.',{exact:true}).waitFor();
  assert.equal(await page.locator('#payment-portal').getAttribute('href'),settings.paymentUrl);assert.equal(await page.locator('#payment-portal').getAttribute('rel'),'noopener noreferrer');
  await page.locator('#close-modal').click();
  // Contact links use the latest saved settings; no external mail or payment is sent in tests.
  await page.locator('#contact-main').click();await page.locator('#modal-content a[href="mailto:management@example.test"]').waitFor();assert.equal(await page.locator('#modal-content a[href="tel:2025550101"]').count(),1);await page.locator('#close-modal').click();
  await page.locator('[data-page="documents"]').click();await page.locator('summary').filter({hasText:'Taking care of your home'}).click();await page.getByText('Test smoke alarms regularly, keep air vents clear, and report water leaks promptly.',{exact:false}).waitFor();
  await page.locator('#notifications').click();await page.getByRole('button',{name:'View maintenance'}).click();await page.locator('#requests').waitFor();
  await page.goBack();await page.locator('#documents').waitFor();
  await page.goto(app.base+'/vacancies');await page.locator('#public-contact').getByText('management@example.test',{exact:true}).waitFor();assert.equal(await page.locator('#public-contact').getByText('Example Account Holder').count(),0);
  const guest=await browser.newPage();await guest.goto(app.base+'/login');await guest.locator('#help-toggle').click();await guest.locator('#login-help').waitFor();assert.equal(await guest.locator('#help-toggle').getAttribute('aria-expanded'),'true');await guest.close();
  assert.deepEqual(errors,[]);console.log('PASS: every authorized page navigates and reloads; staff settings persist; tenant payment/contact links work; resources, notifications, password change, back navigation, and mobile settings work.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
