const {fail}=require('./service-utils');
function createAgentReviewRoutes({reviews,body,json}){
 return async(req,res,url,user)=>{const p=url.pathname,method=req.method;if(!/^\/api\/(agent-reviews|my-agent-reviews|admin\/agent-reviews)(?:\/|$)/.test(p))return false;
  if(p==='/api/agent-reviews'&&method==='GET'){json(res,200,{agents:reviews.publicList()});return true;}
  if(!user)fail('Please sign in to continue.',401);let result;
  if(p==='/api/my-agent-reviews'){if(method==='GET')result=reviews.mine(user);if(method==='POST')result=reviews.save(user,await body(req),req);}
  if(p==='/api/admin/agent-reviews'){if(method==='GET')result=reviews.adminList(user,Object.fromEntries(url.searchParams));if(method==='POST')result=reviews.record(user,await body(req));}
  const match=p.match(/^\/api\/admin\/agent-reviews\/(\d+)\/moderate$/);if(match&&method==='POST')result=reviews.moderate(user,match[1],await body(req));
  if(result){json(res,200,result);return true;}return false;
 };
}
module.exports={createAgentReviewRoutes};
