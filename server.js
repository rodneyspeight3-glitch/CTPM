const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {createAuth}=require('./lib/auth');
const {createManagement}=require('./lib/management');
const {createVacancies}=require('./lib/vacancies');
const {createSettings}=require('./lib/settings');
const root=path.join(__dirname,'public');
async function main(){
 const auth=await createAuth(process.env.DATABASE_PATH||path.join(__dirname,'.data','app.sqlite'));
 const management=createManagement(auth.db);
 const vacancies=createVacancies(auth.db);
 const settings=createSettings(auth.db);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const redirect=(res,to)=>{res.writeHead(302,{Location:to,'Cache-Control':'no-store'}).end();};
 async function body(req){
  if(!req.headers['content-type']?.startsWith('application/json')){const e=new Error('JSON content is required.');e.status=415;throw e;}
  let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16384){const e=new Error('Request too large.');e.status=413;throw e;}}
  try{const parsed=JSON.parse(data);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error();return parsed;}catch{const e=new Error('Invalid request.');e.status=400;throw e;}
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname==='/health'&&req.method==='GET'){
    auth.db.prepare('SELECT 1').get();
    return json(res,200,{status:'ok',revision:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null});
   }
   const user=auth.userFor(req);
   if(pathname.startsWith('/api/')){
    if(req.method==='POST'){
     // Browser clients must send an Origin matching the host; JSON prevents form-based CSRF.
     const origin=req.headers.origin;
     const expected=process.env.APP_ORIGIN||(req.headers.host?`${process.env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`:'');
     if(!origin||origin!==expected||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Request origin is not allowed.'});
    }
    if(pathname==='/api/login'&&req.method==='POST'){
     const result=await auth.login(await body(req),req);
     if(!result)return json(res,401,{error:'Email, password, or account type is incorrect.'});
     res.setHeader('Set-Cookie',result.cookie);return json(res,200,{user:result.user});
    }
    if(pathname==='/api/vacancies'&&req.method==='GET')return json(res,200,{properties:vacancies.listVacancies()});
    if(pathname==='/api/company'&&req.method==='GET')return json(res,200,{company:settings.publicContact()});
    const vacancyApplication=pathname.match(/^\/api\/vacancies\/(\d+)\/applications$/);
    if(vacancyApplication&&req.method==='POST')return json(res,200,vacancies.apply(vacancyApplication[1],await body(req),req.socket.remoteAddress));
    if(!user)return json(res,401,{error:'Please sign in to continue.'});
    if(pathname==='/api/settings'){
     if(req.method==='GET')return json(res,200,{settings:settings.get()});
     if(req.method==='POST')return json(res,200,{settings:settings.update(user,await body(req))});
    }
    if(pathname==='/api/applications'&&req.method==='GET')return json(res,200,{applications:vacancies.listApplications(user)});
    const applicationUpdate=pathname.match(/^\/api\/applications\/(\d+)\/status$/);
    if(applicationUpdate&&req.method==='POST')return json(res,200,{application:vacancies.updateApplication(user,applicationUpdate[1],await body(req))});
    const availability=pathname.match(/^\/api\/properties\/(\d+)\/availability$/);
    if(availability&&req.method==='POST')return json(res,200,{property:management.setAvailability(user,availability[1],await body(req))});
    if(pathname==='/api/session'&&req.method==='GET')return json(res,200,{user});
    if(pathname==='/api/properties'){
     if(req.method==='GET')return json(res,200,{properties:management.listProperties(user)});
     if(req.method==='POST')return json(res,201,{property:management.addProperty(user,await body(req))});
    }
    if(pathname==='/api/requests'){
     if(req.method==='GET')return json(res,200,{requests:management.listRequests(user)});
     if(req.method==='POST')return json(res,201,{request:management.addRequest(user,await body(req))});
    }
    const requestAction=pathname.match(/^\/api\/requests\/(\d+)\/(status|cancel)$/);
    if(requestAction&&req.method==='POST')return json(res,200,{request:management.updateRequest(user,requestAction[1],await body(req),requestAction[2]==='cancel')});
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
   if((pathname==='/'||pathname==='/index.html')&&!user)return redirect(res,'/login');
   if((pathname==='/login'||pathname==='/login.html')&&user)return redirect(res,'/');
   const relative=pathname==='/'?'/index.html':pathname==='/login'?'/login.html':pathname==='/vacancies'?'/vacancies.html':pathname;
   const file=path.resolve(root,'.'+decodeURIComponent(relative));
   if(!file.startsWith(root+path.sep))return json(res,403,{error:'Forbidden.'});
   fs.readFile(file,(error,data)=>{
    if(error)return json(res,404,{error:'Not found.'});
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control',path.extname(file)==='.html'?'no-store':'public, max-age=300');
    res.end(req.method==='HEAD'?undefined:data);
   });
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Something went wrong. Please try again.'});}
 });
 server.listen(process.env.PORT===undefined?3000:Number(process.env.PORT),'0.0.0.0',()=>console.log('App running on port '+server.address().port));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{auth.db.close();process.exit(0);}));
}
main().catch(()=>{console.error('Startup failed. Check database access and administrator configuration.');process.exit(1);});
