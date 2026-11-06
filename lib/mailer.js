const nodemailer = require('nodemailer');
const {automatedSenderName,automatedHeaders,automatedText}=require('./email-format');
const { createHash } = require('node:crypto');
const address = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const servers = Object.freeze({'smtp.mail.com':'mail.com SMTP','smtp.gmail.com':'Gmail SMTP'});
function smtpSettings(env = process.env) {
  const enabled = env.SMTP_ENABLED === 'true', host = (env.SMTP_HOST || 'smtp.mail.com').trim().toLowerCase(), port = Number(env.SMTP_PORT || 465);
  const user = (env.SMTP_USER || '').trim().toLowerCase(), from = (env.SMTP_FROM || '').trim().toLowerCase();
  // Google displays app passwords in spaced groups. Preserve mail.com passwords.
  const password = host === 'smtp.gmail.com' ? (env.SMTP_PASSWORD || '').replace(/[ \t\r\n]/g,'') : env.SMTP_PASSWORD;
  const missing = ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].filter(key => !(key === 'SMTP_PASSWORD' ? password : env[key]?.trim()));
  let problem = '';
  if (!Object.hasOwn(servers,host) || ![465, 587].includes(port)) problem = 'Use smtp.gmail.com or smtp.mail.com with TLS port 465 or STARTTLS port 587.';
  else if ((!missing.includes('SMTP_USER') && !address(user)) || (!missing.includes('SMTP_FROM') && !address(from))) problem = 'Use a single valid sender email address.';
  else if (user && from && user !== from) problem = 'Use the same authorized mailbox for SMTP_USER and SMTP_FROM; its address appears in email headers.';
  else if (host === 'smtp.gmail.com' && user && !/^[^@]+@(gmail|googlemail)\.com$/.test(user)) problem = 'Personal Gmail SMTP requires your full gmail.com or googlemail.com address and a Google app password.';
  else if (host === 'smtp.gmail.com' && password && !/^[A-Za-z0-9]{16}$/.test(password)) problem = 'Gmail requires a 16-character Google app password, not your regular sign-in password.';
  return { enabled, host, port, user, from, password, missing, problem, provider:servers[host] || 'SMTP', ready: enabled && !missing.length && !problem };
}
function mailError(error) {
  if (error?.code === 'EAUTH' || error?.responseCode === 535) return 'AUTHENTICATION_FAILED';
  if (['ETLS', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(error?.code)) return 'TLS_FAILED';
  if (['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(error?.code)) return 'CONNECTION_FAILED';
  if (error?.responseCode >= 500) return 'DELIVERY_REJECTED';
  return 'DELIVERY_FAILED';
}
function createMailer({ transportFactory = options => nodemailer.createTransport(options) } = {}) {
  let cached, fingerprint, lastVerifiedAt = null;
  function transport() {
    const config = smtpSettings();
    if (!config.ready) { const error = Error('Complete the sender SMTP settings in Render Environment.'); error.code = 'SMTP_NOT_CONFIGURED'; throw error; }
    const next = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    if (next !== fingerprint) {
      cached?.close?.(); lastVerifiedAt = null; fingerprint = next;
      cached = transportFactory({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: config.port === 587, auth: { user: config.user, pass: config.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true });
    }
    return { client: cached, config };
  }
  return {
    configured: () => smtpSettings().ready,
    status() { const c = smtpSettings(); return { enabled: c.enabled, configured: c.ready, provider:c.provider, host: c.host, port: c.port, missing: c.missing, problem: c.problem, senderConfigured: !!c.from, lastVerifiedAt }; },
    async verify() { const { client,config } = transport(); await client.verify(); lastVerifiedAt = new Date().toISOString(); return { message: config.provider+' accepted the encrypted connection and sender login. Delivery still depends on mailbox limits and recipient filters.', verifiedAt: lastVerifiedAt }; },
    async send({ to, subject, text, key, unsubscribeUrl }) {
      if (!address(to)) throw Error('Invalid recipient.');
      const { client, config } = transport(), messageId = '<' + createHash('sha256').update(key).digest('hex') + '@' + config.from.split('@')[1] + '>';
      const result = await client.sendMail({ from: { name: automatedSenderName, address: config.from }, to: { address: to }, envelope: { from: config.from, to: [to] }, subject, text:automatedText(text), messageId, headers:{...automatedHeaders,...(unsubscribeUrl?{'List-Unsubscribe':'<'+unsubscribeUrl+'>'}:{})} });
      if (result.rejected?.length) { const error = Error('Delivery rejected.'); error.responseCode = 550; throw error; }
      lastVerifiedAt = new Date().toISOString(); return { id: result.messageId || messageId };
    }
  };
}
module.exports = { createMailer, smtpSettings, mailError };
