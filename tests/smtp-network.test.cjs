const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createServer,connect}=require('node:net'),nodemailer=require('nodemailer');
const {publicAddress,publicHost,createSmtpSocket}=require('../lib/smtp-network');
const {smtpSettings,createMailer,mailError}=require('../lib/mailer');
const socketResult=(provider,options)=>new Promise((resolve,reject)=>provider(options,(error,result)=>error?reject(error):resolve(result)));
function fakeDial(calls){return options=>{calls.push(options);const socket=new EventEmitter();socket.destroy=()=>{socket.destroyed=true;};queueMicrotask(()=>socket.emit('connect'));return socket;};}
test('custom SMTP accepts provider usernames, authorized separate senders and TLS on provider ports',async()=>{
 const env={SMTP_ENABLED:'true',SMTP_HOST:'smtp.postmarkapp.com',SMTP_PORT:'2525',SMTP_SECURITY:'starttls',SMTP_USER:'CaseSensitiveToken',SMTP_FROM:'notices@company.example',SMTP_PASSWORD:' token with spaces '};
 const config=smtpSettings(env);assert.equal(config.ready,true);assert.equal(config.user,'CaseSensitiveToken');assert.equal(config.password,env.SMTP_PASSWORD);assert.equal(config.provider,'Custom SMTP');let options,payload;
 const mailer=createMailer({settingsSource:()=>({env,source:'environment'}),transportFactory:opts=>{options=opts;return {verify:async()=>true,sendMail:async p=>{payload=p;return {messageId:'local-only'};}};}});await mailer.verify();await mailer.send({to:'resident@example.test',subject:'Synthetic',text:'Synthetic',key:'custom-smtp'});assert.equal(options.secure,false);assert.equal(options.requireTLS,true);assert.equal(options.tls.servername,env.SMTP_HOST);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.auth.user,'CaseSensitiveToken');assert.equal(payload.from.address,env.SMTP_FROM);assert.equal(mailer.status().security,'starttls');
 env.SMTP_PORT='8465';env.SMTP_SECURITY='tls';await mailer.verify();assert.equal(options.secure,true);assert.equal(options.requireTLS,false);assert.equal(options.port,8465);env.SMTP_SECURITY='none';assert.equal(mailer.configured(),false);
 for(const port of ['0','65536','25.5','NaN'])assert.equal(smtpSettings({...env,SMTP_PORT:port,SMTP_SECURITY:'starttls'}).ready,false);
 assert.equal(smtpSettings({...env,SMTP_USER:'bad\r\nuser',SMTP_SECURITY:'tls'}).ready,false);assert.equal(smtpSettings({...env,SMTP_FROM:'two@example.test,other@example.test',SMTP_SECURITY:'tls'}).ready,false);
});
test('SMTP destination validation rejects private, reserved, mapped and metadata addresses and URL syntax',()=>{
 for(const ip of ['0.0.0.0','10.1.2.3','127.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.100.100.200','198.18.0.1','224.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::','not-an-ip'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','142.250.1.1','2607:f8b0:4001::1','2001:4860:4860::8888'])assert.equal(publicAddress(ip),true,ip);
 for(const host of ['localhost','mail.localhost','mail.local','metadata.google.internal','smtp.test','smtp://smtp.gmail.com','user:pass@smtp.gmail.com','smtp.gmail.com/path','smtp.gmail.com:465','127.1','2130706433','a..com','a.\r\ncom','-a.example.com'])assert.equal(publicHost(host),false,host);
 assert.equal(publicHost('smtp.office365.com'),true);assert.equal(publicHost('smtp.fastmail.com'),true);
});
test('SMTP DNS checks all answers and pins the socket to validated public IPs on each new connection',async()=>{
 const calls=[];let resolutions=0,records=[{address:'8.8.8.8',family:4},{address:'2607:f8b0:4001::1',family:6}];
 const getSocket=createSmtpSocket({resolve:async(host,options)=>{resolutions++;assert.equal(host,'smtp.office365.com');assert.equal(options.all,true);return records;},dial:fakeDial(calls)});
 const result=await socketResult(getSocket,{host:'smtp.office365.com',port:2525});assert.ok(result.connection);assert.deepEqual(calls,[{host:'8.8.8.8',port:2525,family:4}]);assert.equal(resolutions,1);
 records=[{address:'8.8.8.8'},{address:'127.0.0.1'}];await assert.rejects(socketResult(getSocket,{host:'smtp.office365.com',port:2525}),e=>e.code==='SMTP_HOST_BLOCKED');assert.equal(calls.length,1);assert.equal(resolutions,2);
 for(const records of [[{address:'::ffff:169.254.169.254'}],[],[{address:'garbage'}]]){const blocked=createSmtpSocket({resolve:async()=>records,dial:fakeDial(calls)});await assert.rejects(socketResult(blocked,{host:'smtp.fastmail.com',port:465}),e=>e.code==='SMTP_HOST_BLOCKED');}assert.equal(calls.length,1);
 assert.equal(mailError({code:'SMTP_HOST_BLOCKED'}),'SMTP_HOST_BLOCKED');
});
test('SMTP connection timeout closes sockets and late DNS cannot open a connection',async()=>{
 let complete,callbacks=0;const calls=[],provider=createSmtpSocket({resolve:()=>new Promise(resolve=>complete=resolve),dial:fakeDial(calls),timeout:15});
 await new Promise(resolve=>provider({host:'smtp.fastmail.com',port:465},error=>{callbacks++;assert.equal(error.code,'ETIMEDOUT');resolve();}));complete([{address:'8.8.8.8'}]);await new Promise(setImmediate);assert.equal(calls.length,0);assert.equal(callbacks,1);
 let socket;const connecting=createSmtpSocket({resolve:async()=>[{address:'8.8.8.8'}],dial:()=>{socket=new EventEmitter();socket.destroy=()=>socket.destroyed=true;return socket;},timeout:15});await assert.rejects(socketResult(connecting,{host:'smtp.fastmail.com',port:465}),e=>e.code==='ETIMEDOUT');assert.equal(socket.destroyed,true);
});
test('real Nodemailer refuses a server without STARTTLS before sending authentication credentials',async()=>{
 const commands=[],sockets=new Set(),server=createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 local SMTP fixture\r\n');let pending='';socket.on('data',data=>{pending+=data.toString();let end;while((end=pending.indexOf('\r\n'))!==-1){const command=pending.slice(0,end);pending=pending.slice(end+2);commands.push(command);if(command.startsWith('EHLO'))socket.write('250-fixture\r\n250 AUTH PLAIN LOGIN\r\n');else if(command==='STARTTLS')socket.write('502 TLS unavailable\r\n');else socket.write('500 Unsupported\r\n');}});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,getSocket=createSmtpSocket({resolve:async()=>[{address:'8.8.8.8'}],dial:()=>connect({host:'127.0.0.1',port})});
 const client=nodemailer.createTransport({host:'smtp.fastmail.com',port:587,secure:false,requireTLS:true,getSocket,tls:{servername:'smtp.fastmail.com',rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:{user:'NEVER-SEND-THIS',pass:'SECRET'},connectionTimeout:2000,greetingTimeout:2000,socketTimeout:2000});
 try{await assert.rejects(client.verify(),e=>e.code==='ETLS');assert.ok(commands.some(command=>command==='STARTTLS'));assert.ok(commands.every(command=>!command.startsWith('AUTH')&&!command.includes('SECRET')));}finally{client.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
