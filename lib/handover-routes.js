const fs = require('node:fs');
const { fail } = require('./service-utils');
function createHandoverRoutes({ applicationMail,vacancies, freeAccess, portfolio, workspace, handover, notices, body, json }) {
  const send = (res, data, status = 200) => { json(res, status, data); return true; };
  const file = (res, data, mime, name) => { res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${name}"` }); res.end(data); return true; };
  return async (req, res, url, user) => {
    const p = url.pathname, method = req.method, match = pattern => p.match(pattern); let m;
    if (p === '/api/application-email/unsubscribe' && method === 'POST') return send(res,applicationMail.unsubscribe(await body(req),req));
    if (p === '/api/open-applications' && method === 'POST') { vacancies.beginApplication(null, req.socket.remoteAddress); return send(res, vacancies.apply(null, await body(req, 14500000))); }
    if (p === '/api/application-receipts/status' && method === 'POST') return send(res, freeAccess.receiptStatus(await body(req), req));
    if (p === '/api/account/recover-with-code' && method === 'POST') return send(res, await freeAccess.recover(await body(req), req));
    const ours = /^\/api\/(application-receipts|account\/(recovery-codes|personal-export)|admin\/identity|applications\/\d+\/(withdraw|match|follow-up|calendar)|portfolio|gallery\/\d+\/cover|properties\/\d+\/gallery-order|workspace|community|calendar|work-orders|documents-library|ledger-export|lease-calendar|rent-reminder|expense-files|expense-attachments|handover|notifications\/(read-all|filtered))/.test(p);
    if (!ours) return false;
    if (!user) fail('Please sign in to continue.', 401);
    if (p === '/api/application-receipts/claim' && method === 'POST') return send(res, freeAccess.claim(user, await body(req)));
    if (p === '/api/account/recovery-codes') { if (method === 'GET') return send(res, freeAccess.recoveryStatus(user)); if (method === 'POST') return send(res, await freeAccess.generateCodes(user, await body(req))); }
    if (p === '/api/account/personal-export' && method === 'GET') return file(res, JSON.stringify(freeAccess.exportPersonal(user), null, 2), 'application/json', 'my-ctpm-records.json');
    if ((m = match(/^\/api\/admin\/identity\/(\d+)$/)) && method === 'POST') return send(res, freeAccess.confirmIdentity(user, m[1], await body(req)));
    if ((m = match(/^\/api\/applications\/(\d+)\/(withdraw|match|follow-up|calendar)$/))) {
      if (method === 'GET' && m[2] === 'calendar') return file(res, workspace.followUpCalendar(user, m[1]), 'text/calendar; charset=utf-8', 'application-follow-up.ics');
      if (method === 'POST' && m[2] !== 'calendar') { const input = await body(req); return send(res, m[2] === 'withdraw' ? freeAccess.withdraw(user, m[1], input) : m[2] === 'match' ? portfolio.matchApplication(user, m[1], input) : portfolio.followUp(user, m[1], input)); }
    }
    if (p === '/api/portfolio/quality' && method === 'GET') return send(res, { properties: portfolio.quality(user) });
    if ((m = match(/^\/api\/properties\/(\d+)\/gallery-order$/)) && method === 'POST') return send(res, portfolio.reorderGallery(user, m[1], await body(req)));
    if ((m = match(/^\/api\/gallery\/(\d+)\/cover$/)) && method === 'POST') return send(res, portfolio.promoteCover(user, m[1]));
    if (p === '/api/workspace' && method === 'GET') return send(res, { tasks: workspace.tasks(user), plans: workspace.plans(user), members: workspace.members(user) });
    if (p === '/api/workspace/tasks' && method === 'POST') return send(res, workspace.saveTask(user, null, await body(req)), 201);
    if ((m = match(/^\/api\/workspace\/tasks\/(\d+)(?:\/(calendar))?$/))) { if (method === 'GET' && m[2]) return file(res, workspace.taskCalendar(user, m[1]), 'text/calendar; charset=utf-8', 'team-task.ics'); if (method === 'POST') return send(res, workspace.saveTask(user, m[1], await body(req))); }
    if (p === '/api/workspace/plans' && method === 'POST') return send(res, workspace.savePlan(user, null, await body(req)), 201);
    if ((m = match(/^\/api\/workspace\/plans\/(\d+)$/)) && method === 'POST') return send(res, workspace.savePlan(user, m[1], await body(req)));
    if (p === '/api/community') { if (method === 'GET') return send(res, { notices: workspace.notices(user) }); if (method === 'POST') return send(res, workspace.publishNotice(user, await body(req)), 201); }
    if ((m = match(/^\/api\/community\/(\d+)\/archive$/)) && method === 'POST') return send(res, workspace.archiveNotice(user, m[1]));
    if (p === '/api/calendar' && method === 'GET') return file(res, workspace.personalCalendar(user), 'text/calendar; charset=utf-8', 'my-community-calendar.ics');
    if ((m = match(/^\/api\/work-orders\/(\d+)$/)) && method === 'GET') return file(res, await workspace.workOrder(user, m[1]), 'application/pdf', 'maintenance-work-order.pdf');
    if (p === '/api/documents-library' && method === 'GET') return send(res, { documents: handover.documents(user) });
    if (p === '/api/ledger-export' && method === 'GET') return file(res, handover.ledgerCSV(user), 'text/csv; charset=utf-8', 'rent-ledger.csv');
    if ((m = match(/^\/api\/lease-calendar\/(\d+)$/)) && method === 'GET') return file(res, workspace.leaseCalendar(user, m[1]), 'text/calendar; charset=utf-8', 'lease-end.ics');
    if ((m = match(/^\/api\/rent-reminder\/(\d+)$/)) && method === 'GET') return file(res, await handover.reminderLetter(user, m[1]), 'application/pdf', 'rent-balance-summary.pdf');
    if ((m = match(/^\/api\/expense-files\/(\d+)$/))) { if (method === 'GET') return send(res, { files: handover.expenseFiles(user, m[1]) }); if (method === 'POST') return send(res, handover.addExpenseFile(user, m[1], await body(req, 3000000)), 201); }
    if ((m = match(/^\/api\/expense-attachments\/(\d+)\/(download|remove)$/))) { if (method === 'GET' && m[2] === 'download') { const data = handover.expenseFile(user, m[1]); return file(res, data.data, data.mime, 'expense-receipt.' + ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[data.mime])); } if (method === 'POST' && m[2] === 'remove') return send(res, handover.removeExpenseFile(user, m[1], await body(req))); }
    if (p === '/api/notifications/read-all' && method === 'POST') return send(res, notices.readAll(user));
    if (p === '/api/notifications/filtered' && method === 'GET') return send(res, { notifications: notices.list(user).filter(n => !url.searchParams.get('kind') || n.kind === url.searchParams.get('kind')) });
    if (p === '/api/handover' && method === 'GET') return send(res, { report: handover.readiness(user) });
    if (p === '/api/handover/audit' && method === 'GET') return send(res, { events: handover.auditList(user) });
    if (p === '/api/handover/checklist' && method === 'POST') return send(res, handover.check(user, await body(req)));
    if (p === '/api/handover/backup' && method === 'POST') {
      const snapshot = await handover.backup(user, await body(req), req), stream = fs.createReadStream(snapshot.path);
      res.writeHead(200, { 'Content-Type': 'application/vnd.sqlite3', 'Content-Disposition': 'attachment; filename="ctpm-private-backup.sqlite"', 'Cache-Control': 'private, no-store' });
      stream.on('error', () => res.destroy()); stream.on('close', snapshot.cleanup); res.on('close', () => { stream.destroy(); snapshot.cleanup(); }); stream.pipe(res); return true;
    }
    return false;
  };
}
module.exports = { createHandoverRoutes };
