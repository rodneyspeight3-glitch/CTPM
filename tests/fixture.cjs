const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
async function fixture(overrides={}){
 const directory=mkdtempSync(path.join(tmpdir(),'ctpm-test-'));
 const password=randomBytes(24).toString('hex');let child;
 const credentials={email:'admin@example.test',password,role:'admin'};
 async function start(){
  child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,SEED_SHOWCASE_PROPERTIES:'0',...overrides,PORT:'0',NODE_ENV:overrides.NODE_ENV||'test',DATABASE_PATH:path.join(directory,'app.sqlite'),ADMIN_EMAIL:credentials.email,ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),10000);child.stdout.on('data',chunk=>{const match=String(chunk).match(/App running on port (\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});child.on('exit',code=>{clearTimeout(timer);if(code)reject(Error('Test server exited: '+code));});});
 }
 const base=await start();
 async function stop(){if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
 process.once('exit',()=>{child?.kill();rmSync(directory,{recursive:true,force:true});});
 return {base,credentials,stop,start,cleanup:async()=>{await stop();rmSync(directory,{recursive:true,force:true});}};
}
module.exports={fixture};
