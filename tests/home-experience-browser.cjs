const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
(async()=>{
 const app=await fixture({SMTP_ENABLED:'false'});let browser;
 try{
  const login=await fetch(app.base+'/api/login',{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json'},body:JSON.stringify(app.credentials)}),cookie=login.headers.get('set-cookie').split(';')[0];
  async function post(path,data){const response=await fetch(app.base+path,{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});assert.ok(response.ok,path+': '+response.status);return response.json();}
  const listings=[];
  for(const [i,p] of inventory.entries())listings.push((await post('/api/properties',{...p,amenities:i===0?['Balcony','Laundry']:i===3?['Balcony']:[]})).property);
  for(let i=0;i<10;i++)await post('/api/properties',{...inventory[0],name:'Terrace '+i,price:3000+i*25,beds:1,size:500+i,amenities:['Laundry']});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const text=async download=>fs.readFileSync(await download.path(),'utf8');
  const clickDownload=async selector=>{const promise=page.waitForEvent('download');await page.locator(selector).click();return text(await promise);};
  await page.goto(app.base);await page.locator('#vacancy-results').filter({hasText:'14 of 14'}).waitFor();
  assert.equal(await page.locator('#vacancy-list .property-card').count(),12);await page.locator('#home-load-more').click();assert.equal(await page.locator('#vacancy-list .property-card').count(),14);
  assert.match(await page.locator('#home-updated').innerText(),/Availability checked/);
  await page.locator('.home-advanced summary').click();await page.locator('#home-type').selectOption('APARTMENT');await page.locator('#home-area').selectOption('Cedar District');await page.locator('#home-size').fill('1000');await page.locator('#home-min-rent').fill('1600');await page.locator('#home-baths').selectOption('1');
  await page.locator('[data-home-amenity][value="Balcony"]').check();await page.locator('[data-home-amenity][value="Laundry"]').check();
  assert.equal(await page.locator('#vacancy-list .property-card').count(),1);assert.equal(await page.locator('#vacancy-list h3').textContent(),'Cedar Court <test>');
  await page.locator('#home-photos').check();assert.equal(await page.locator('#vacancy-list .property-card').count(),0);await page.getByRole('button',{name:'Remove Actual photos filter',exact:true}).click();assert.equal(await page.locator('#vacancy-list .property-card').count(),1);
  await page.locator('#home-save-search').click();
  await page.locator('#vacancy-list [data-home-save]').click();await page.locator('#home-saved-only').check();assert.equal(await page.locator('#home-saved-count').textContent(),'1');
  await page.locator('#vacancy-list [data-details]').click();await page.locator('#close-application').click();assert.equal(await page.locator('#home-recent-homes button').count(),1);
  await page.locator('#home-share-search').click();let shared;
  if(await page.locator('#home-share-fallback').isVisible())shared=await page.locator('#home-search-link').inputValue();
  else{await context.grantPermissions(['clipboard-read']);shared=await page.evaluate(()=>navigator.clipboard.readText());}
  assert.ok(shared.includes('amenity=Balcony'));assert.ok(shared.includes('type=APARTMENT'));
  await page.goto(shared);await page.locator('#vacancy-results').filter({hasText:'1 of 14'}).waitFor();assert.equal(await page.locator('#home-type').inputValue(),'APARTMENT');assert.equal(await page.locator('[data-home-amenity]:checked').count(),2);
  await page.locator('.home-shortlist summary').click();const shortlist=await clickDownload('#home-export-saved');assert.match(shortlist,/Cedar Court <test>/);assert.match(shortlist,/10 Cedar Street/);assert.match(shortlist,/1650/);
  await page.locator('#clear-vacancy-filters').click();await page.locator('#home-restore-search').click();assert.equal(await page.locator('#vacancy-list .property-card').count(),1);
  await page.locator('#clear-vacancy-filters').click();await page.locator('#vacancy-sort').selectOption('size-high');assert.equal(await page.locator('#vacancy-list h3').first().innerText(),'River View');await page.locator('#vacancy-sort').selectOption('baths-high');assert.equal(await page.locator('#vacancy-list h3').first().innerText(),'River View');
  await page.locator('#home-rent-unit').selectOption('year');assert.match(await page.locator('#vacancy-list .property-top strong').first().innerText(),/27,000.*yr/s);await page.locator('#home-rent-unit').selectOption('week');assert.match(await page.locator('#home-unit-note').innerText(),/52/);
  await page.locator('#home-view-toggle').click();assert.equal(await page.locator('#vacancy-list').evaluate(el=>el.classList.contains('home-compact')),true);
  await page.locator('.home-advanced summary').click();await page.locator('#home-match [name=beds]').selectOption('2');await page.locator('#home-match [name=budget]').fill('1800');await page.locator('#home-match [name=size]').fill('1000');await page.locator('#home-match button').click();assert.equal(await page.locator('#vacancy-list .property-card').count(),2);
  const budget=page.locator('#home-budget-form');
  for(const summary of await budget.locator('details summary').all())await summary.click();
  for(const [key,value] of Object.entries({rent:'1500',utilities:'150',parking:'50',insurance:'20',other:'30',income:'5000',expenses:'1000',buffer:'500',deposit:'1500',moving:'400',fees:'100',saved:'1000',sharers:'2',alternative:'1700'}))await budget.locator('[name='+key+']').fill(value);
  const target=new Date();target.setDate(target.getDate()+28);await budget.locator('[name=target]').fill(target.toISOString().slice(0,10));
  const output=await page.locator('#home-budget-output').innerText();assert.match(output,/\$1,750/);assert.match(output,/\$3,750/);assert.match(output,/\$875/);assert.match(output,/\$2,750/);assert.match(output,/\$1,950/);assert.match(output,/\+\$2,400/);
  const budgetCSV=await clickDownload('#home-budget-download');assert.match(budgetCSV,/"Monthly housing total","1750"/);assert.match(budgetCSV,/"Weekly savings goal","687.5"/);
  await page.locator('#home-budget-save').click();await page.reload();await page.locator('#home-budget-restore').click();assert.equal(await budget.locator('[name=rent]').inputValue(),'1500');await budget.locator('summary').filter({hasText:'Compare another home'}).click();await budget.locator('[name=sharers]').fill('0');assert.equal(await page.locator('#home-budget-download').isDisabled(),true);await budget.locator('[name=sharers]').fill('2');
  await page.locator('#tool-tab-budget').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tool-tab-move').getAttribute('aria-selected'),'true');
  await page.locator('#home-move-date').fill('2028-03-12');await page.locator('#home-move-date').dispatchEvent('change');assert.match(await page.locator('#home-countdown').innerText(),/days to/);
  await page.locator('#home-add-task input').fill('=SUM(1,2) <script>');await page.locator('#home-add-task button').click();assert.equal(await page.locator('#home-move-tasks script').count(),0);await page.locator('[data-move-task]').first().check();
  const moveCSV=await clickDownload('#home-move-download');assert.match(moveCSV,/"2028-02-13"/);assert.match(moveCSV,/'=SUM\(1,2\) <script>/);
  const calendar=await clickDownload('#home-move-calendar');assert.match(calendar,/DTSTART;VALUE=DATE:20280312\r\nDTEND;VALUE=DATE:20280313/);
  await page.reload();await page.locator('#tool-tab-move').click();assert.equal(await page.locator('#home-move-date').inputValue(),'2028-03-12');assert.equal(await page.locator('[data-move-task]').first().isChecked(),true);assert.equal(await page.locator('[data-delete-task]').count(),1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#tool-tab-apply').click();for(const input of await page.locator('[data-prep]').all())await input.check();assert.equal(await page.locator('#home-prep-progress').getAttribute('value'),'100');assert.equal(await page.locator('.home-confetti').count(),0);assert.match(await page.locator('#home-milestone').innerText(),/Preparation complete/);
  await page.getByText('Required or optional? Get a clear answer.',{exact:true}).click();assert.match(await page.locator('#tool-panel-apply .home-guide').first().innerText(),/current landlord name/i);await page.getByText('A little rental language, translated',{exact:true}).click();await page.locator('#home-glossary-search').fill('deposit');assert.equal(await page.locator('#home-glossary dt').count(),1);
  await page.locator('#tool-tab-tour').click();await page.getByText('Build a question list for your viewing',{exact:true}).click();await page.locator('#home-tour-questions input').first().check();const questionText=await clickDownload('#home-questions-download');assert.match(questionText,/Which utilities are included/);await page.locator('[data-tour]').first().check();
  await page.locator('#home-faq-topic').selectOption('documents');await page.locator('#home-faq-search').fill('rental history');assert.equal(await page.locator('.faq-list details:visible').count(),2);await page.locator('#home-faq-expand').click();assert.equal(await page.locator('.faq-list details[open]:visible').count(),2);
  await page.locator('#home-faq-search').fill('no such topic zzz');assert.match(await page.locator('#home-faq-count').innerText(),/No matching/);
  // Unavailable saves reveal no stale address or private property data.
  await post('/api/properties/'+listings[0].id+'/availability',{available:false});await page.locator('.home-shortlist summary').click();await page.locator('#refresh-vacancies').click();await page.locator('#home-shortlist-homes').getByText(/no longer publicly available/).waitFor();assert.doesNotMatch(await page.locator('#home-shortlist-homes').innerText(),/10 Cedar Street/);await page.locator('#home-clean-saved').click();assert.equal(await page.locator('#home-saved-count').innerText(),'0');
  const fresh=await browser.newPage();await fresh.goto(app.base);assert.equal(await fresh.locator('#home-saved-count').innerText(),'0');assert.equal(await fresh.locator('#home-move-date').inputValue(),'');await fresh.close();
  await page.setViewportSize({width:390,height:844});for(const name of ['budget','move','apply','tour']){await page.locator('#tool-tab-'+name).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' phone overflow');}
  await page.locator('#tool-tab-budget').click();await page.locator('#home-toolkit').screenshot({path:'/tmp/ctpm-home-tools-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/ctpm-home-50-desktop.png',fullPage:true});
  await page.locator('#home-budget-clear').click();await page.locator('#tool-tab-move').click();await page.locator('#home-move-clear').click();await page.locator('#tool-tab-apply').click();await page.locator('#home-prep-reset').click();await page.locator('#tool-tab-tour').click();await page.locator('#home-tour-reset').click();await page.locator('#home-forget-search').click();await page.locator('#home-clear-recent').click();
  assert.deepEqual(errors,[]);console.log('PASS: home discovery, local shortlists and stale saves, shared/remembered filters, pagination, budget arithmetic, CSV/ICS downloads, move/checklist persistence, privacy, keyboard tabs, reduced motion, FAQ/glossary search and phone layouts.');
 }finally{await browser?.close();await app.cleanup();}
})().catch(error=>{console.error(error);process.exit(1);});
