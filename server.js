const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {createAuth}=require('./lib/auth');
const {createManagement}=require('./lib/management');
const {createVacancies}=require('./lib/vacancies');
const {createSettings}=require('./lib/settings');
const {createOperations}=require('./lib/operations');
const {seedShowcase}=require('./lib/showcase');
const {createApplicationMail}=require('./lib/application-mail');
const {createNotifications}=require('./lib/notifications');
const {createAccountServices}=require('./lib/account-services');
const {createResidentServices}=require('./lib/resident-services');
const {createFinance}=require('./lib/finance');
const {createSignatures}=require('./lib/signatures');
const {createExperience}=require('./lib/experience');
const {createAgents}=require('./lib/agents');
const {createServiceRoutes}=require('./lib/service-routes');
const {createFreeAccess}=require('./lib/free-access');
const {createPortfolioTools}=require('./lib/portfolio-tools');
const {createWorkspace}=require('./lib/workspace');
const {createHandover}=require('./lib/handover');
const {createHandoverRoutes}=require('./lib/handover-routes');
const root=path.join(__dirname,'public');
async function main(){
 const auth=await createAuth(process.env.DATABASE_PATH||path.join(__dirname,'.data','app.sqlite'));
 const management=createManagement(auth.db);seedShowcase(auth.db);
 let resident;const vacancies=createVacancies(auth.db,{onEvent:(...args)=>resident.applicationEvent(...args)});
 const settings=createSettings(auth.db);
 const operations=createOperations(auth.db);
 const notices=createNotifications(auth.db),accounts=createAccountServices(auth.db,notices);
 const applicationMail=createApplicationMail(auth.db,notices);
 resident=createResidentServices(auth.db,notices,{applicationMail});
 const finance=createFinance(auth.db,notices),signatures=createSignatures(auth.db,notices),experience=createExperience(auth.db,notices),agents=createAgents(auth.db);
 const freeAccess=createFreeAccess(auth.db,operations,notices,applicationMail),portfolio=createPortfolioTools(auth.db,management,resident),workspace=createWorkspace(auth.db,notices),handover=createHandover(auth.db,operations,freeAccess,settings);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const redirect=(res,to)=>{res.writeHead(302,{Location:to,'Cache-Control':'no-store'}).end();};
 function dashboardTarget(value){try{const target=new URL(value,'https://ctpm.local');if(target.origin==='https://ctpm.local'&&target.pathname==='/dashboard')return target.pathname+target.search+target.hash;}catch{}return '/dashboard';}
 async function rawBody(req,maxSize=16384){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxSize){const e=new Error('Request too large.');e.status=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks);}
 async function body(req,maxSize=16384){
  if(!req.headers['content-type']?.startsWith('application/json')){const e=new Error('JSON content is required.');e.status=415;throw e;}
  const bytes=await rawBody(req,maxSize);try{const parsed=JSON.parse(bytes.toString('utf8'));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error();return parsed;}catch{const e=new Error('Invalid request.');e.status=400;throw e;}
 }
 const services=createServiceRoutes({accounts,notices,resident,finance,signatures,experience,agents,body,rawBody,json});
 const handoverRoutes=createHandoverRoutes({applicationMail,vacancies,freeAccess,portfolio,workspace,handover,notices,body,json});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const requestURL=new URL(req.url,'http://localhost'),pathname=requestURL.pathname;
   if(pathname==='/health'&&req.method==='GET'){
    auth.db.prepare('SELECT 1').get();
    return json(res,200,{status:'ok',revision:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null});
   }
   const user=auth.userFor(req);
   res.on('finish',()=>{if(req.method==='POST'&&res.statusCode>=200&&res.statusCode<300&&['admin','agent'].includes(user?.role)&&!/^\/api\/(login|logout|password|account\/)/.test(pathname)){try{handover.audit(user,'POST '+pathname);}catch{}}});
   const photoRead=pathname.match(/^\/property-photos\/(\d+)$/);
   if(photoRead&&['GET','HEAD'].includes(req.method)){const photo=management.photo(user,photoRead[1]);res.writeHead(200,{'Content-Type':photo.mime,'Cache-Control':'private, no-store'});return res.end(req.method==='HEAD'?undefined:photo.data);}
   if(/^\/(agent-photos|gallery-photos)\/\d+$/.test(pathname)&&await services(req,res,requestURL,user))return;
   if(pathname.startsWith('/api/')){
    if(req.method==='POST'&&pathname!=='/api/webhooks/stripe'){
     // Browser clients must send an Origin matching the host; JSON prevents form-based CSRF.
     const origin=req.headers.origin;
     const expected=process.env.APP_ORIGIN||(req.headers.host?`${process.env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`:'');
     if(!origin||origin!==expected||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Request origin is not allowed.'});
    }
    if(await handoverRoutes(req,res,requestURL,user))return;
    if(await services(req,res,requestURL,user))return;
    if(pathname==='/api/login'&&req.method==='POST'){
     const result=await auth.login(await body(req),req);
     if(!result)return json(res,401,{error:'Email, password, or account type is incorrect.'});
     res.setHeader('Set-Cookie',result.cookie);return json(res,200,{user:result.user});
    }
    if(pathname==='/api/signup'&&req.method==='POST'){
     if(user)return json(res,409,{error:'Sign out before creating another account.'});
     const result=await auth.signup(await body(req),req);
     if(!result)return json(res,503,{error:'Account created. Please sign in to continue.'});
     accounts.welcome(result.user);
     if(accounts.status().emailEnabled)try{accounts.requestVerification(result.user,req,{welcome:true});}catch{}
     res.setHeader('Set-Cookie',result.cookie);return json(res,201,{user:result.user});
    }
    if(pathname==='/api/vacancies'&&req.method==='GET')return json(res,200,{properties:vacancies.listVacancies()});
    if(pathname==='/api/showcase'&&req.method==='GET')return json(res,200,{properties:management.showcase()});
    if(pathname==='/api/company'&&req.method==='GET')return json(res,200,{company:settings.publicContact()});
    const vacancyApplication=pathname.match(/^\/api\/vacancies\/(\d+)\/applications$/);
    if(vacancyApplication&&req.method==='POST'){vacancies.beginApplication(vacancyApplication[1],req.socket.remoteAddress);return json(res,200,vacancies.apply(vacancyApplication[1],await body(req,14500000)));}
    if(!user)return json(res,401,{error:'Please sign in to continue.'});
    if(pathname==='/api/saved-homes'&&req.method==='GET')return json(res,200,{properties:management.savedHomes(user)});
    const saveHome=pathname.match(/^\/api\/properties\/(\d+)\/save$/);
    if(saveHome&&req.method==='POST')return json(res,200,management.saveHome(user,saveHome[1],await body(req)));
    const documentRead=pathname.match(/^\/api\/lease-documents\/(\d+)\/download$/);
    if(documentRead&&['GET','HEAD'].includes(req.method)){const doc=operations.document(user,documentRead[1]);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="lease-document-${doc.id}.pdf"`,'Cache-Control':'private, no-store'});return res.end(req.method==='HEAD'?undefined:doc.data);}
    const documentUpload=pathname.match(/^\/api\/leases\/(\d+)\/documents$/);
    if(documentUpload&&req.method==='POST'){
     if(!['agent','admin'].includes(user.role))return json(res,403,{error:'Agent or administrator access is required.'});
     return json(res,201,{document:operations.addDocument(user,documentUpload[1],await body(req,7100000))});
    }
    const photoUpload=pathname.match(/^\/api\/properties\/(\d+)\/photo$/);
    if(photoUpload&&req.method==='POST'){
     if(!['agent','admin'].includes(user.role))return json(res,403,{error:'Agent or administrator access is required.'});
     return json(res,201,management.savePhoto(user,photoUpload[1],await body(req,1450000)));
    }
    if(pathname==='/api/residents'&&req.method==='GET')return json(res,200,{residents:operations.residents(user)});
    if(pathname==='/api/leases'){
     if(req.method==='GET')return json(res,200,{leases:operations.leases(user)});
     if(req.method==='POST')return json(res,201,{lease:operations.addLease(user,await body(req))});
    }
    const leaseEnd=pathname.match(/^\/api\/leases\/(\d+)\/end$/);
    if(leaseEnd&&req.method==='POST')return json(res,200,{lease:operations.endLease(user,leaseEnd[1])});
    if(pathname==='/api/ledger'){
     if(req.method==='GET')return json(res,200,{charges:operations.ledger(user)});
     if(req.method==='POST')return json(res,201,{charge:operations.addCharge(user,await body(req))});
    }
    const recordPayment=pathname.match(/^\/api\/ledger\/(\d+)\/payments$/);
    if(recordPayment&&req.method==='POST')return json(res,201,{payment:operations.recordPayment(user,recordPayment[1],await body(req))});
    const voidPayment=pathname.match(/^\/api\/payments\/(\d+)\/void$/);
    if(voidPayment&&req.method==='POST')return json(res,200,operations.voidPayment(user,voidPayment[1],await body(req)));
    if(pathname==='/api/conversations'){
     if(req.method==='GET')return json(res,200,{conversations:operations.conversations(user)});
     if(req.method==='POST')return json(res,201,{conversation:operations.newConversation(user,await body(req))});
    }
    const conversationMessages=pathname.match(/^\/api\/conversations\/(\d+)\/messages$/);
    if(conversationMessages){
     if(req.method==='GET')return json(res,200,operations.messages(user,conversationMessages[1]));
     if(req.method==='POST')return json(res,201,operations.reply(user,conversationMessages[1],await body(req)));
    }
    const conversationClose=pathname.match(/^\/api\/conversations\/(\d+)\/close$/);
    if(conversationClose&&req.method==='POST')return json(res,200,operations.closeConversation(user,conversationClose[1]));
    const propertyEdit=pathname.match(/^\/api\/properties\/(\d+)\/(edit|archive|delete)$/);
    if(propertyEdit&&req.method==='POST'){if(!['admin','agent'].includes(user.role))return json(res,403,{error:'Agent or administrator access is required.'});const property=propertyEdit[2]==='edit'?portfolio.saveProperty(user,propertyEdit[1],await body(req,14500000)):propertyEdit[2]==='delete'?management.deleteProperty(user,propertyEdit[1]):management.archiveProperty(user,propertyEdit[1],await body(req));experience.listingAlerts();return json(res,200,{property});}
    const accountEdit=pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if(accountEdit&&req.method==='POST')return json(res,200,{user:await auth.updateUser(user,accountEdit[1],await body(req))});
    if(pathname==='/api/settings'){
     if(req.method==='GET')return json(res,200,{settings:settings.forUser(user)});
     if(req.method==='POST')return json(res,200,{settings:settings.update(user,await body(req))});
    }
    const applicationDocument=pathname.match(/^\/api\/application-documents\/(\d+)\/(download|delete)$/);
    if(applicationDocument&&['GET','HEAD'].includes(req.method)&&applicationDocument[2]==='download'){const doc=vacancies.document(user,applicationDocument[1]),ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[doc.mime];res.writeHead(200,{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename="application-document-${doc.id}.${ext}"`,'Cache-Control':'private, no-store'});return res.end(req.method==='HEAD'?undefined:doc.data);}
    if(applicationDocument&&req.method==='POST'&&applicationDocument[2]==='delete')return json(res,200,vacancies.removeDocument(user,applicationDocument[1],await body(req)));
    const fullApplication=pathname.match(/^\/api\/applications\/(\d+)$/);
    if(fullApplication&&req.method==='GET')return json(res,200,{application:vacancies.application(user,fullApplication[1])});
    if(pathname==='/api/applications'&&req.method==='GET')return json(res,200,{applications:vacancies.listApplications(user)});
    const applicationUpdate=pathname.match(/^\/api\/applications\/(\d+)\/status$/);
    if(applicationUpdate&&req.method==='POST')return json(res,200,{application:vacancies.updateApplication(user,applicationUpdate[1],await body(req))});
    const availability=pathname.match(/^\/api\/properties\/(\d+)\/availability$/);
    if(availability&&req.method==='POST'){const property=management.setAvailability(user,availability[1],await body(req));experience.listingAlerts();return json(res,200,{property});}
    if(pathname==='/api/session'&&req.method==='GET')return json(res,200,{user});
    if(pathname==='/api/properties'){
     if(req.method==='GET')return json(res,200,{properties:management.listProperties(user)});
     if(req.method==='POST'){if(!['admin','agent'].includes(user.role))return json(res,403,{error:'Agent or administrator access is required.'});const property=portfolio.saveProperty(user,null,await body(req,14500000));experience.listingAlerts();return json(res,201,{property});}
    }
    if(pathname==='/api/requests'){
     if(req.method==='GET')return json(res,200,{requests:management.listRequests(user)});
     if(req.method==='POST'){const request=management.addRequest(user,await body(req));experience.maintenanceEvent(request,user);return json(res,201,{request});}
    }
    const requestAction=pathname.match(/^\/api\/requests\/(\d+)\/(status|cancel)$/);
    if(requestAction&&req.method==='POST'){const request=management.updateRequest(user,requestAction[1],await body(req),requestAction[2]==='cancel');experience.maintenanceEvent(request,user);return json(res,200,{request});}
    if(pathname==='/api/logout'&&req.method==='POST'){auth.logout(req);res.setHeader('Set-Cookie',auth.sessionCookie('',0));return json(res,200,{ok:true});}
    if(pathname==='/api/password'&&req.method==='POST'){const data=await body(req);await auth.changePassword(user,data.currentPassword,data.newPassword);res.setHeader('Set-Cookie',auth.sessionCookie('',0));return json(res,200,{ok:true});}
    if(pathname==='/api/admin/users'){
     if(user.role!=='admin')return json(res,403,{error:'Administrator access is required.'});
     if(req.method==='GET')return json(res,200,{users:auth.listUsers()});
     if(req.method==='POST')return json(res,201,{user:await auth.addUser(await body(req))});
    }
    return json(res,404,{error:'Not found.'});
   }
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
   if(pathname==='/dashboard'&&!user)return redirect(res,'/login?next='+encodeURIComponent('/dashboard'+requestURL.search));
   if(pathname==='/index.html')return redirect(res,user?'/dashboard':'/login');
   if(['/login','/login.html','/signup','/signup.html'].includes(pathname)&&user)return redirect(res,dashboardTarget(requestURL.searchParams.get('next')));
   if(pathname==='/signup'||pathname==='/signup.html'){const params=new URLSearchParams(requestURL.search);params.set('mode','signup');return redirect(res,'/login?'+params.toString());}
   const relative=pathname==='/'||pathname==='/home'?'/home.html':pathname==='/dashboard'?'/index.html':pathname==='/login'?'/login.html':pathname==='/vacancies'?'/vacancies.html':pathname==='/agents'?'/agents.html':pathname==='/account-access'?'/account-access.html':pathname==='/apply'?'/apply.html':pathname==='/application-status'?'/application-status.html':pathname==='/application-email'?'/application-email.html':pathname;
   const file=path.resolve(root,'.'+decodeURIComponent(relative));
   if(!file.startsWith(root+path.sep))return json(res,403,{error:'Forbidden.'});
   fs.readFile(file,(error,data)=>{
    if(error)return json(res,404,{error:'Not found.'});
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control',path.extname(file)==='.html'?'no-store':'public, max-age=300');
    res.end(req.method==='HEAD'?undefined:data);
   });
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Something went wrong. Please try again.'});}
 });
 server.listen(process.env.PORT===undefined?3000:Number(process.env.PORT),'0.0.0.0',()=>console.log('App running on port '+server.address().port));
 workspace.runPlans();
 const delivery=setInterval(()=>notices.drain().catch(()=>{}),5000);delivery.unref();
 const reminders=setInterval(()=>{try{workspace.runPlans();notices.reminders();experience.listingAlerts();finance.syncPayments({role:'admin'}).catch(()=>{});for(const b of finance.budgets({role:'admin'})){if(b.spent_cents>b.amount_cents)notices.staffNotice({kind:'budget',title:'A property is over its monthly expense budget',link:'/dashboard#reports',key:'budget:'+b.property_id+':'+b.period});}}catch{}},3600000);reminders.unref();
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(delivery);clearInterval(reminders);server.close(()=>{auth.db.close();process.exit(0);});});
}
main().catch(()=>{console.error('Startup failed. Check database access and administrator configuration.');process.exit(1);});
