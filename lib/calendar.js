const { stamp } = require('./service-utils');
const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/[\r\n]+/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const instant = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const nextDay = value => new Date(new Date(value + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
function calendar(events, namespace) {
  const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Come Together//Community Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const event of events) {
    rows.push('BEGIN:VEVENT', 'UID:' + escape(event.id + '-' + namespace + '@ctpm'), 'DTSTAMP:' + instant(stamp()));
    if (event.allDay) rows.push('DTSTART;VALUE=DATE:' + event.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + (event.end || nextDay(event.start)).replace(/-/g, ''));
    else rows.push('DTSTART:' + instant(event.start), 'DTEND:' + instant(event.end));
    rows.push('SUMMARY:' + escape(event.title), 'DESCRIPTION:' + escape(event.description), 'LOCATION:' + escape(event.location), 'END:VEVENT');
  }
  rows.push('END:VCALENDAR');
  return rows.map(row => { let folded = '', current = ''; for (const c of row) { if (Buffer.byteLength(current + c) > 73) { folded += current + '\r\n '; current = ''; } current += c; } return folded + current; }).join('\r\n') + '\r\n';
}
module.exports = { calendar, nextDay };
