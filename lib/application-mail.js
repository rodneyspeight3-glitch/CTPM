const { randomBytes } = require('node:crypto');
const ApplicationStates=require('../public/application-states');
const { migrate, digest, stamp, publicOrigin, transaction, fail, rateLimit } = require('./service-utils');
function createApplicationMail(db, mail) {
  migrate(db, 'applications', 'email_updates', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE TABLE IF NOT EXISTS application_email_tokens(token_hash TEXT PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),expires_at INTEGER NOT NULL)');
  const statuses = { Submitted: 'Your application was received and is waiting for management review.', Reviewing: 'Management is reviewing your application.', Contacted: 'Management has marked your application as contacted. Check your messages and supplied contact details.', Closed: 'Management has closed this application review. Contact the team for the outcome or any questions; this status alone does not mean approval or denial.', Withdrawn: 'Your application has been marked withdrawn. The submitted record is retained.' };
  for(const status of ['Approved','Rejected'])statuses[status]=ApplicationStates.description(status);
  return {
    send(value, event, { trackingUrl, documentRequestId } = {}) {
      const app = db.prepare('SELECT id,email,email_updates,reference,status,updated_at FROM applications WHERE id=?').get(value);
      if (!app?.email_updates || !mail.configured() || !publicOrigin()) return false;
      const key = 'application-email:' + app.id + ':' + (documentRequestId ? 'document:' + documentRequestId : event + ':' + app.updated_at);
      if (db.prepare('SELECT 1 FROM email_outbox WHERE event_key=?').get(key)) return false;
      // Limit transaction mail to the opted-in address without accepting arbitrary recipients.
      if (db.prepare('SELECT COUNT(*) AS n FROM email_outbox WHERE recipient=? AND application_id IS NOT NULL AND created_at>=?').get(app.email, new Date(Date.now() - 86400000).toISOString()).n >= 30) return false;
      const token = randomBytes(32).toString('hex'), unsubscribeUrl = publicOrigin() + '/application-email#unsubscribe=' + token;
      const info = documentRequestId ? 'Management requested additional supporting documents. Sign in to My applications to review and respond.' : statuses[event];
      if (!info) return false;
      const link = event === 'Submitted' && trackingUrl ? publicOrigin() + trackingUrl : publicOrigin() + '/dashboard#my-applications';
      const body = 'Come Together Property Management\n\nApplication reference: ' + app.reference + '\n' + info + '\n\n' + (event === 'Submitted' ? 'Save your private receipt link. You can use it to check progress or claim the application in a tenant account with the same email:\n' : 'Open My applications, or use the private receipt link you saved when applying:\n') + link + '\n\nSubmitting an application does not reserve a property or create a lease. Management records any approval or rejection explicitly. Identity documents, financial answers, and private staff notes are never attached to these emails.\n\nYou requested email updates when applying. Stop these application emails:\n' + unsubscribeUrl + '\n\nIf you did not submit this application, unsubscribe above or contact management through the website.';
      transaction(db, () => {
        db.prepare('DELETE FROM application_email_tokens WHERE expires_at<=?').run(Date.now());
        db.prepare('INSERT INTO application_email_tokens VALUES(?,?,?)').run(digest(token), app.id, Date.now() + 90 * 86400000);
        if (event !== 'Submitted' && !documentRequestId) db.prepare("UPDATE email_outbox SET status='Cancelled',body='',unsubscribe_url='' WHERE application_id=? AND kind='application-progress' AND status='Pending'").run(app.id);
        mail.enqueue({ to: app.email, subject: documentRequestId ? 'Application documents requested | Come Together' : event === 'Submitted' ? 'Application received | Come Together' : 'Application update: ' + event + ' | Come Together', body, kind: documentRequestId ? 'application-document' : event === 'Submitted' ? 'application-receipt' : 'application-progress', key, applicationId: app.id, unsubscribeUrl, statusSnapshot:app.status, expiresAt: Date.now() + 7 * 86400000 });
      });
      return true;
    },
    unsubscribe(input, req) {
      rateLimit(db, 'application-email-unsubscribe', req.socket.remoteAddress, 60, 900000);
      if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) fail('Use the unsubscribe link from an application email.', 400);
      const row = db.prepare('SELECT * FROM application_email_tokens WHERE token_hash=? AND expires_at>?').get(digest(input.token), Date.now());
      if (!row) fail('This unsubscribe link is invalid or expired. Contact management for help.', 400);
      transaction(db, () => {
        db.prepare('UPDATE applications SET email_updates=0 WHERE id=?').run(row.application_id);
        db.prepare("UPDATE email_outbox SET status='Cancelled',body='',unsubscribe_url='' WHERE application_id=? AND status='Pending'").run(row.application_id);
      });
      return { message: 'Email updates for this application are off. Your application and dashboard access remain available.' };
    }
  };
}
module.exports = { createApplicationMail };
