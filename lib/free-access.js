const { randomBytes } = require('node:crypto');
const { passwordHash, verifyPassword } = require('./auth');
const { id, stamp, digest, admin, text, fail, transaction, migrate, rateLimit } = require('./service-utils');
function createFreeAccess(db, operations, notices) {
  migrate(db, 'users', 'identity_confirmed_at', 'TEXT');
  migrate(db, 'users', 'identity_confirmed_by', 'INTEGER REFERENCES users(id)');
  migrate(db, 'applications', 'origin', "TEXT NOT NULL DEFAULT 'listed'");
  migrate(db, 'applications', 'withdraw_reason', "TEXT NOT NULL DEFAULT ''");
  db.exec(`CREATE TABLE IF NOT EXISTS recovery_codes(code_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),password_fingerprint TEXT NOT NULL,email TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS identity_confirmations(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),actor_id INTEGER NOT NULL REFERENCES users(id),method TEXT NOT NULL,note TEXT NOT NULL,confirmed_at TEXT NOT NULL);`);
  const receipt = token => {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail('Use your private receipt link or contact management.', 404);
    const row = db.prepare('SELECT * FROM application_receipts WHERE token_hash=? AND expires_at>?').get(digest(token), Date.now());
    if (!row) fail('Use your private receipt link or contact management.', 404);
    return row;
  };
  const owns = (user, applicationId) => {
    const app = db.prepare('SELECT * FROM applications WHERE id=?').get(id(applicationId));
    const actor = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(user.id);
    const claim = app && db.prepare('SELECT 1 FROM application_claims WHERE application_id=? AND user_id=?').get(app.id, user.id);
    if (!app || user.role !== 'tenant' || (!claim && !(actor && (actor.email_verified_at || actor.identity_confirmed_at) && actor.email.toLowerCase() === app.email.toLowerCase()))) fail('Application not found.', 404);
    return app;
  };
  async function reauthenticate(user, password) {
    rateLimit(db, 'password-confirmation', user.id, 30, 3600000);
    const actor = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(user.id);
    if (!actor || typeof password !== 'string' || password.length > 128 || !await verifyPassword(password, actor.password_hash)) fail('Your current password is required.', 403);
    return actor;
  }
  return {
    reauthenticate, owns,
    receiptStatus(input, req) {
      rateLimit(db, 'receipt-status', req.socket.remoteAddress, 120, 900000);
      const r = receipt(input.token), a = r.application_id ? db.prepare("SELECT a.id,a.reference,a.requested_address,a.status,a.created_at,a.updated_at,COALESCE(p.name,'Address application') AS property_name FROM applications a LEFT JOIN properties p ON p.id=a.property_id WHERE a.id=?").get(r.application_id) : null;
      return { reference: r.reference, address: r.address, status: a?.status || 'Submitted', submittedAt: r.created_at, updatedAt: a?.updated_at || r.created_at, propertyName: a?.property_name || 'Address application', documentRequests: a ? db.prepare('SELECT kind,message,due_on,status FROM application_document_requests WHERE application_id=? ORDER BY id DESC').all(a.id) : [] };
    },
    claim(user, input) {
      if (user.role !== 'tenant') fail('Use a tenant account to claim an application.', 403);
      const r = receipt(input.token), a = r.application_id ? db.prepare('SELECT * FROM applications WHERE id=?').get(r.application_id) : null;
      if (!a || a.email.toLowerCase() !== user.email.toLowerCase() || (r.claimed_by && r.claimed_by !== user.id)) fail('This receipt cannot be claimed by this account. Use the application email or contact management.', 400);
      transaction(db, () => {
        db.prepare('INSERT OR IGNORE INTO application_claims VALUES(?,?,?)').run(a.id, user.id, stamp());
        db.prepare('UPDATE application_receipts SET claimed_by=? WHERE token_hash=?').run(user.id, r.token_hash);
      });
      return { ok: true };
    },
    withdraw(user, value, input) {
      const app = owns(user, value);
      if (['Closed', 'Withdrawn'].includes(app.status)) fail('This application is no longer open.', 409);
      const reason = text(input.reason, 'a withdrawal reason', 500), now = stamp();
      transaction(db, () => {
        db.prepare("UPDATE applications SET status='Withdrawn',withdraw_reason=?,updated_at=?,updated_by=? WHERE id=?").run(reason, now, user.id, app.id);
        db.prepare("INSERT INTO application_events(application_id,status,note,updated_by,created_at) VALUES(?,'Withdrawn',?,?,?)").run(app.id, 'Withdrawn by applicant: ' + reason, user.id, now);
      });
      notices.staffNotice({ kind: 'application', title: 'An applicant withdrew an application', link: '/dashboard#applications', key: 'withdraw:' + app.id });
      return { ok: true };
    },
    async generateCodes(user, input) {
      const actor = await reauthenticate(user, input.currentPassword);
      const codes = Array.from({ length: 8 }, () => randomBytes(16).toString('hex').toUpperCase());
      transaction(db, () => {
        db.prepare('DELETE FROM recovery_codes WHERE user_id=?').run(user.id);
        for (const code of codes) db.prepare('INSERT INTO recovery_codes VALUES(?,?,?,?,?)').run(digest(actor.id + ':' + code), actor.id, digest(actor.password_hash), actor.email, stamp());
      });
      return { codes: codes.map(code => code.match(/.{1,4}/g).join('-')), message: 'Save these codes privately. Each works once; generating a new set replaces the old set.' };
    },
    recoveryStatus(user) { return { remaining: db.prepare('SELECT COUNT(*) AS n FROM recovery_codes r JOIN users u ON u.id=r.user_id WHERE r.user_id=? AND r.email=u.email AND r.password_fingerprint=?').get(user.id, digest(db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id).password_hash)).n }; },
    async recover(input, req) {
      rateLimit(db, 'offline-recovery-ip', req.socket.remoteAddress, 20, 3600000);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      rateLimit(db, 'offline-recovery-account', email, 5, 3600000);
      if (typeof input.password !== 'string' || input.password.length < 16 || input.password.length > 128 || input.password !== input.confirmation) fail('Use matching passwords of 16–128 characters.');
      const actor = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email), code = typeof input.code === 'string' ? input.code.replace(/-/g, '').trim().toUpperCase() : '';
      const hash = digest((actor?.id || 0) + ':' + code), valid = actor && /^[A-F0-9]{32}$/.test(code) && db.prepare('SELECT * FROM recovery_codes WHERE code_hash=? AND user_id=? AND email=? AND password_fingerprint=?').get(hash, actor.id, actor.email, digest(actor.password_hash));
      if (!valid) fail('The email and recovery code could not be confirmed.', 400);
      const password = await passwordHash(input.password);
      transaction(db, () => {
        if (!db.prepare('SELECT 1 FROM recovery_codes WHERE code_hash=?').get(hash) || db.prepare('SELECT password_hash FROM users WHERE id=?').get(actor.id).password_hash !== actor.password_hash) fail('The email and recovery code could not be confirmed.', 400);
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(password, actor.id);
        db.prepare('DELETE FROM recovery_codes WHERE user_id=?').run(actor.id);
        db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(actor.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(actor.id);
      });
      return { message: 'Password updated. Sign in with your new password, then create a new recovery-code set.' };
    },
    confirmIdentity(user, value, input) {
      admin(user); const target = db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role='tenant'").get(id(value));
      if (!target) fail('Active tenant account not found.', 404);
      if (!['In person', 'Phone and documents', 'Known resident'].includes(input.method)) fail('Choose how identity was confirmed.');
      const note = text(input.note, 'a brief confirmation note without sensitive ID numbers', 300), now = stamp();
      transaction(db, () => {
        db.prepare('UPDATE users SET identity_confirmed_at=?,identity_confirmed_by=? WHERE id=?').run(now, user.id, target.id);
        db.prepare('INSERT INTO identity_confirmations(user_id,actor_id,method,note,confirmed_at) VALUES(?,?,?,?,?)').run(target.id, user.id, input.method, note, now);
      });
      notices.notify(target.id, { kind: 'account', title: 'Management confirmed your identity', body: 'Viewing requests and resident lease signing are now available.', link: '/dashboard#account', key: 'identity:' + target.id + ':' + now });
      return { ok: true };
    },
    exportPersonal(user) {
      const actor = db.prepare('SELECT * FROM users WHERE id=?').get(user.id), identity = actor.email_verified_at || actor.identity_confirmed_at;
      const apps = db.prepare('SELECT id,reference,requested_address,status,created_at,details FROM applications WHERE id IN (SELECT application_id FROM application_claims WHERE user_id=?)' + (identity ? ' OR email=? COLLATE NOCASE' : '')).all(user.id, ...(identity ? [user.email] : []));
      const self = { ...user, role: 'tenant' }, conversations = operations.conversations(self);
      return { exportedAt: stamp(), account: user, applications: apps.map(a => ({ ...a, details: JSON.parse(a.details) })), leases: operations.leases(self), ledger: operations.ledger(self), conversations: conversations.map(c => operations.messages(self, c.id)), note: 'Only your own records are included. Passwords, session tokens, recovery codes, private staff notes, and binary identity documents are excluded.' };
    }
  };
}
module.exports = { createFreeAccess };
