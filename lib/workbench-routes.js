const {fail}=require('./service-utils');
function createWorkbenchRoutes({workbench,body,json}){
 return async(req,res,url,user)=>{
  const p=url.pathname,method=req.method,q=Object.fromEntries(url.searchParams);
  if(!/^\/api\/(workbench|organizer)(\/|$)/.test(p))return false;
  if(!user)fail('Please sign in to continue.',401);
  const send=(data,status=200)=>{json(res,status,data);return true;};
  const file=(data,name,type)=>{res.writeHead(200,{'Content-Type':type,'Content-Disposition':'attachment; filename="'+name+'"','Cache-Control':'private, no-store'});res.end(data);return true;};
  if(p==='/api/workbench/schema'&&method==='GET')return send(workbench.schema(user));
  let m;
  if((m=p.match(/^\/api\/workbench\/([a-z-]+)(?:\/(\d+)(?:\/(archive|comments))?|\/(export|calendar))?$/))){
   const [,board,value,action,exportKind]=m;
   if(exportKind&&method==='GET')return file(workbench.export(user,board,q,exportKind==='calendar'),board+(exportKind==='calendar'?'.ics':'.csv'),exportKind==='calendar'?'text/calendar; charset=utf-8':'text/csv; charset=utf-8');
   if(!value&&method==='GET')return send(workbench.list(user,board,q));
   if(!value&&method==='POST')return send(workbench.create(user,board,await body(req,131072)),201);
   if(value&&!action&&method==='GET')return send(workbench.detail(user,board,value));
   if(value&&!action&&method==='POST')return send(workbench.update(user,board,value,await body(req,131072)));
   if(value&&action&&method==='POST')return send(workbench[action==='comments'?'comment':'archive'](user,board,value,await body(req)));
  }
  if(p==='/api/organizer'&&method==='GET')return send(workbench.notes(user));
  if(p==='/api/organizer'&&method==='POST')return send(workbench.createNote(user,await body(req,65536)),201);
  if(['/api/organizer/export','/api/organizer/calendar'].includes(p)&&method==='GET'){const ics=p.endsWith('/calendar');return file(workbench.noteExport(user,ics),'my-organizer.'+(ics?'ics':'csv'),ics?'text/calendar; charset=utf-8':'text/csv; charset=utf-8');}
  if((m=p.match(/^\/api\/organizer\/(\d+)(?:\/(archive|pin|complete|reopen|delete))?$/))){if(!m[2]&&method==='GET')return send(workbench.note(user,m[1]));if(!m[2]&&method==='POST')return send(workbench.updateNote(user,m[1],await body(req,65536)));if(m[2]&&method==='POST')return send(workbench.noteAction(user,m[1],m[2],await body(req)));}
  fail('Endpoint not found.',404);
 };
}
module.exports={createWorkbenchRoutes};
