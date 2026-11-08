const {fail,staff}=require('./service-utils');
function createLeasePreparationRoutes({preparations,offers,body,json}){
 return async(req,res,url,user)=>{
  const path=url.pathname,method=req.method;
  if(path.startsWith('/api/applicant-leases/')){
   if(method!=='POST')fail('Method not allowed.',405);const action=path.slice('/api/applicant-leases/'.length);if(!['open','original','signed','sign','decline'].includes(action))fail('Not found.',404);const input=await body(req);
   if(['original','signed'].includes(action)){const data=offers.download(input,req,action==='signed');res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="lease-agreement.pdf"','Cache-Control':'private, no-store'});res.end(data);return true;}
   json(res,200,await offers[action](input,req));return true;
  }
  if(!/^\/api\/(lease-template|lease-preparations)(?:\/|$)/.test(path))return false;
  if(!user)fail('Please sign in to continue.',401);staff(user);
  const send=data=>{json(res,200,data);return true;};let match;
  if(path==='/api/lease-template'){if(method==='GET')return send({template:preparations.template(user,url.searchParams.get('state')||'CA')});if(method==='POST')return send({template:preparations.saveTemplate(user,await body(req,250000))});}
  if(path==='/api/lease-preparations'&&method==='GET')return send({preparations:preparations.list(user)});
  if((match=path.match(/^\/api\/lease-preparations\/(\d+)(?:\/(save|upload|preview|send|invitation-link|withdraw-invitation|close-invitation|invitation-original|invitation-signed))?$/))){
   const [,id,action]=match;if(!action&&method==='GET')return send(preparations.detail(user,id));
   if(action==='invitation-link'&&method==='POST')return send(offers.link(user,id,await body(req)));
   if(action==='close-invitation'&&method==='POST')return send(offers.close(user,id,await body(req)));
   if(action==='withdraw-invitation'&&method==='POST')return send(offers.withdraw(user,id,await body(req)));
   if(['invitation-original','invitation-signed'].includes(action)&&['GET','HEAD'].includes(method)){const data=offers.staffDocument(user,id,action==='invitation-signed',url.searchParams.get('offerId'));res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="applicant-agreement.pdf"','Cache-Control':'private, no-store'});res.end(method==='HEAD'?undefined:data);return true;}
   if(action==='save'&&method==='POST')return send({preparation:preparations.save(user,id,await body(req,250000))});
   if(action==='upload'&&method==='POST')return send({preparation:await preparations.upload(user,id,await body(req,7100000))});
   if(action==='send'&&method==='POST')return send({preparation:await preparations.send(user,id,await body(req))});
   if(action==='preview'&&['GET','HEAD'].includes(method)){const data=await preparations.preview(user,id);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="lease-review.pdf"','Cache-Control':'private, no-store'});res.end(method==='HEAD'?undefined:data);return true;}
  }
  return false;
 };
}
module.exports={createLeasePreparationRoutes};
