// Sends Ek Haven's emails (welcome and password reset). Set ONE service's key in the server's environment:
//  · Brevo (brevo.com)  → BREVO_API_KEY      · Resend (resend.com) → RESEND_API_KEY
//  · MAIL_FROM = who the email is from, e.g.  Ek Haven <noreply@mail.sedigitaltransformation.com>
//    (the address or domain must be verified with that service)
// Without a key nothing is sent. MAIL_DEBUG=1 prints emails to the server log instead (for testing).
const FROM = () => String(process.env.MAIL_FROM || '').trim();
const REPLY_TO = () => String(process.env.MAIL_REPLY_TO || 'support@sedigitaltransformation.com').trim();
const parseFrom = s => { const m = s.match(/^(.*?)\s*<([^>]+)>$/); return m ? {name: m[1].replace(/^["']|["']$/g, '').trim() || 'Ek Haven', email: m[2].trim()} : {name: 'Ek Haven', email: s.trim()}; };
const configured = () => !!((process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && FROM()) || process.env.MAIL_DEBUG === '1';
async function sendMail(to, subject, text, html) {
  try {
    const brevo = String(process.env.BREVO_API_KEY || '').trim(), resend = String(process.env.RESEND_API_KEY || '').trim();
    if (brevo && FROM()) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {method: 'POST', headers: {'api-key': brevo, 'content-type': 'application/json'},
        body: JSON.stringify({sender: parseFrom(FROM()), to: [{email: to}], replyTo: {email: REPLY_TO()}, subject, textContent: text, htmlContent: html})});
      if (!r.ok) console.error('mail: Brevo refused', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return r.ok;
    }
    if (resend && FROM()) {
      const r = await fetch('https://api.resend.com/emails', {method: 'POST', headers: {authorization: `Bearer ${resend}`, 'content-type': 'application/json'},
        body: JSON.stringify({from: FROM(), to: [to], reply_to: REPLY_TO(), subject, text, html})});
      if (!r.ok) console.error('mail: Resend refused', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return r.ok;
    }
    if (process.env.MAIL_DEBUG === '1') { console.log(`MAIL to ${to}: ${subject}\n${text}`); return true; }
  } catch (e) { console.error('mail failed', e); }
  return false;
}
export { sendMail, configured as mailConfigured };
