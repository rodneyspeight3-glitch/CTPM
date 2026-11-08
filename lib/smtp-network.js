const {lookup} = require('node:dns/promises');
const {BlockList, isIP, connect} = require('node:net');

// SMTP credentials must never be sent to loopback, metadata or private networks.
const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(ip,prefix,'ipv4');
const globalV6 = new BlockList(); globalV6.addSubnet('2000::',3,'ipv6');
for (const [ip,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]]) blocked.addSubnet(ip,prefix,'ipv6');
function publicAddress(ip) {
  const family=isIP(ip);
  return family===4 ? !blocked.check(ip,'ipv4') : family===6 && globalV6.check(ip,'ipv6') && !blocked.check(ip,'ipv6');
}
function publicHost(host) {
  if (typeof host!=='string' || host.length>253) return false;
  if (isIP(host)) return publicAddress(host);
  return host.includes('.') && host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    !/\.(?:localhost|local|internal|home|lan|test|invalid|example)$/i.test(host) && !/^\d+(?:\.\d+)*$/.test(host);
}
const unsafeHost=()=>Object.assign(Error('Use a public SMTP server with an encrypted connection.'),{code:'SMTP_HOST_BLOCKED'});

// Resolve each connection afresh, validate every result, then dial only those IPs.
// Hand the connected TCP socket to Nodemailer, which performs TLS/STARTTLS using
// the original hostname for SNI and certificate checks. No second DNS lookup.
function createSmtpSocket({resolve=lookup,dial=connect,timeout=12000}={}) {
  return (options,callback)=>{
    let socket,done=false;
    const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);if(error)socket?.destroy();callback(error,result);};
    const timer=setTimeout(()=>finish(Object.assign(Error('SMTP connection timed out.'),{code:'ETIMEDOUT'})),timeout);
    (async()=>{
      if(!publicHost(options.host))throw unsafeHost();
      const records=isIP(options.host)?[{address:options.host}]:await resolve(options.host,{all:true,verbatim:true});
      if(done)return;
      if(!Array.isArray(records)||!records.length||records.some(record=>!publicAddress(record.address)))throw unsafeHost();
      const addresses=[...new Set(records.map(record=>record.address))].sort((a,b)=>isIP(a)-isIP(b));
      let position=0;
      const attempt=()=>{
        if(done)return;
        socket=dial({host:addresses[position++],port:options.port,family:isIP(addresses[position-1])});
        const failed=error=>{socket.destroy();if(position<addresses.length&&!done)attempt();else finish(error);};
        socket.once('error',failed);
        socket.once('connect',()=>{socket.removeListener('error',failed);finish(null,{connection:socket});});
      };
      attempt();
    })().catch(error=>finish(error));
  };
}
module.exports={publicAddress,publicHost,createSmtpSocket};
