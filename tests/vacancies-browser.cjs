const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
(async()=>{
 const app=await fixture();let browser;
 try{
  const response=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base},body:JSON.stringify(app.credentials)});
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const post=(path,data)=>fetch(app.base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.base,Cookie:cookie},body:JSON.stringify(data)});
  const listings=[];for(const property of inventory){const r=await post('/api/properties',property);assert.equal(r.status,201);listings.push((await r.json()).property);}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const staff=await browser.newPage({viewport:{width:1440,height:1000}}),guest=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];for(const page of [staff,guest])page.on('pageerror',e=>errors.push(e.message));
  await staff.goto(app.base+'/login');

  await staff.locator('[name="email"]').fill(app.credentials.email);await staff.locator('[name="password"]').fill(app.credentials.password);await staff.locator('#sign-in').click();
  await staff.locator('#featured h3').filter({hasText:'Cedar Court <test>'}).waitFor();
  assert.equal(await staff.locator('#featured .property-card').count(),4);
  assert.equal(await staff.locator('#available-count').textContent(),'4');assert.equal(await staff.locator('#portfolio-count').textContent(),'5');
  assert.equal(await staff.locator('#featured').getByText('Occupied home').count(),0);
  await staff.screenshot({path:'/tmp/ctpm-dashboard.png',fullPage:true});
  await guest.goto(app.base+'/login');await guest.getByRole('link',{name:/Browse vacancies and apply/}).click();
  await guest.locator('#vacancy-list h3').filter({hasText:'Cedar Court <test>'}).waitFor();
  assert.equal(await guest.locator('#vacancy-list .property-card').count(),4);
  assert.equal(await guest.getByText('Occupied home').count(),0);
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await guest.locator('.property-card').filter({hasText:'Cedar Court <test>'}).getByRole('button',{name:'Apply for this home'}).click();
  const fill=async(email)=>{
   await guest.locator('#vacancy-application-form [name="name"]').fill('New Applicant <test>');
   await guest.locator('#vacancy-application-form [name="email"]').fill(email);
   await guest.locator('[name="phone"]').fill('202-555-0123');
   await guest.locator('[name="moveIn"]').fill('2099-01-15');
   await guest.locator('[name="occupants"]').fill('2');
   await guest.locator('[name="message"]').fill('Interested in a viewing.');
   await guest.locator('[name="consent"]').check();
  };
  await fill('new-applicant@example.test');await guest.getByRole('button',{name:'Submit application'}).click();
  await guest.getByRole('heading',{name:'Application received.'}).waitFor();await guest.locator('#close-application').click();
  await staff.locator('#applications-nav').click();await staff.locator('#applications-list h3').filter({hasText:'New Applicant <test>'}).waitFor();
  await staff.getByRole('button',{name:'Review application'}).click();
  await staff.locator('#review-application-form [name="status"]').selectOption('Contacted');
  await staff.locator('#review-application-form [name="note"]').fill('Viewing scheduled <test>.');
  await staff.locator('#review-application-form button').click();
  await staff.locator('#applications-list .resident-update').filter({hasText:'Viewing scheduled <test>.'}).waitFor();
  await staff.reload();await staff.locator('#applications-nav').click();
  await staff.locator('#applications-list .eyebrow').filter({hasText:'CONTACTED'}).waitFor();
  await staff.locator('[data-page="homes"]').click();
  const card=staff.locator('#all-homes .property-card').filter({hasText:'Cedar Court <test>'});
  await card.getByRole('button',{name:'Mark unavailable',exact:true}).click();
  await card.getByRole('button',{name:'Mark available',exact:true}).waitFor();
  await staff.locator('[data-page="overview"]').click();
  await staff.locator('#featured h3').filter({hasText:'Maple Terrace'}).waitFor();assert.equal(await staff.locator('#featured .property-card').count(),3);
  await guest.locator('#refresh-vacancies').click();await guest.locator('#vacancy-list h3').filter({hasText:'Maple Terrace'}).waitFor();
  // A link opened earlier cannot submit after staff close the listing.
  await guest.goto(app.base+'/vacancies?property='+listings[1].id);await guest.locator('#vacancy-application-form').waitFor();
  await post('/api/properties/'+listings[1].id+'/availability',{available:false});
  await fill('late-applicant@example.test');await guest.getByRole('button',{name:'Submit application'}).click();
  await guest.locator('#application-error').filter({hasText:'no longer available'}).waitFor();
  await guest.locator('#close-application').click();
  await guest.goto(app.base+'/vacancies?property='+listings[0].id);
  await guest.locator('#vacancies-error').filter({hasText:'no longer available'}).waitFor();
  assert.equal(await guest.locator('#vacancy-list .property-card').count(),2);
  await guest.screenshot({path:'/tmp/ctpm-vacancies-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: dashboard shows every available property, public application works without login, staff review persists, closing listings blocks stale forms, and mobile fits.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
