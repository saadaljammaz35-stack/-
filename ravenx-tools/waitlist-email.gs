/**
 * RAVENX ESPORTS: waitlist emails and sign-up sheet.
 * Every sign-up from the site is saved in a Google Sheet, the visitor gets a
 * branded confirmation email, and the team gets a notification. All emails
 * are sent from this Google account.
 */

const TEAM_EMAIL = 'ravenxesports118@gmail.com';
const SITE_URL = ''; // after the site goes live, put its address here, for example 'https://ravenx.sa'
const SHEET_TITLE = 'RAVENX قائمة الانتظار';
const SOCIALS = [
  ['TikTok', 'https://www.tiktok.com/@ravenx.esport'],
  ['YouTube', 'https://youtube.com/@ravenxesports'],
  ['X', 'https://x.com/ravenx_esports'],
  ['Instagram', 'https://www.instagram.com/ravenxesports']
];
const IMG_HERO = 'https://raw.githubusercontent.com/saadaljammaz35-stack/-/c322dada406fa674c89e513bc1c3ae5278e8e771/ravenx-tools/email-hero.jpg';
const IMG_CREST = 'https://raw.githubusercontent.com/saadaljammaz35-stack/-/c322dada406fa674c89e513bc1c3ae5278e8e771/ravenx-tools/email-crest.jpg';

const COPY = {
  ar: {
    subject: 'وصلنا اسمك يا رافنكساوي',
    kicker: 'قائمة الانتظار',
    hello: name => 'هلا والله ' + name + '!',
    body: 'وصلنا اسمك بقائمة انتظار جيرسي RAVENX الجديد. وإلى نزل نعلمك قبل الكل.',
    spot: 'رقمك في القائمة', status: 'الحالة', statusVal: 'بالانتظار',
    next: 'وش الجاي؟',
    steps: ['نعلن الموعد والسعر', 'يوصلك إيميل قبل الكل', 'تكون أول من يلبسه'],
    cta: 'تابعنا على تيك توك', site: 'زر الموقع',
    follow: 'تابعنا لين ينزل',
    foot: 'وصلك هذا الإيميل لأنك سجّلت بقائمة الانتظار في موقع RAVENX. إذا ما سجّلت أنت، تجاهله.',
    dir: 'rtl', align: 'right', far: 'left'
  },
  en: {
    subject: 'You are on the RAVENX waitlist',
    kicker: 'WAITLIST',
    hello: name => 'Welcome, ' + name + '!',
    body: 'You are on the waitlist for the new RAVENX kit. When it drops, you hear first.',
    spot: 'Your spot', status: 'Status', statusVal: 'Waiting',
    next: 'What happens next',
    steps: ['We announce the date and price', 'You get an email before everyone else', 'You wear it first'],
    cta: 'Follow us on TikTok', site: 'Visit the site',
    follow: 'Follow us until it drops',
    foot: 'You got this email because you joined the waitlist on the RAVENX site. If that was not you, ignore it.',
    dir: 'ltr', align: 'left', far: 'right'
  }
};

/* Run this once from the editor: it asks for permission, creates the sheet,
   and sends you a sample of the confirmation email. */
function setup() {
  const sheet = getSheet_();
  sendConfirmation_('رافنكساوي', TEAM_EMAIL, 'ar', Math.max(1, sheet.getLastRow() - 1));
  Logger.log('Sheet ready: ' + sheet.getParent().getUrl());
}

function doGet() {
  return ContentService.createTextOutput('RAVENX waitlist is running.');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const d = parse_(e);
    if (d._honey) return json_({ success: true });
    const name = clean_(d.name, 80);
    const email = clean_(d.email, 120).toLowerCase();
    const country = clean_(d.country, 60);
    const lang = d.language === 'en' ? 'en' : 'ar';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ success: false, message: 'invalid' });

    const sheet = getSheet_();
    const last = sheet.getLastRow();
    const known = last > 1 ? sheet.getRange(2, 3, last - 1, 1).getValues().map(r => String(r[0]).toLowerCase()) : [];
    if (known.indexOf(email) !== -1) return json_({ success: true, repeat: true });

    sheet.appendRow([new Date(), name, email, country, lang === 'ar' ? 'عربي' : 'English']);
    const count = sheet.getLastRow() - 1;
    if (MailApp.getRemainingDailyQuota() >= 2) {
      sendConfirmation_(name, email, lang, count);
      sendTeam_(name, email, country, lang, count, sheet.getParent().getUrl());
    }
    return json_({ success: true });
  } catch (err) {
    return json_({ success: false, message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_TITLE);
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName('التسجيلات');
    sh.setRightToLeft(true);
    sh.appendRow(['الوقت', 'الاسم', 'الإيميل', 'الدولة', 'اللغة']);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#2E2155').setFontColor('#EDECF1');
    sh.setFrozenRows(1);
  }
  return ss.getSheets()[0];
}

function sendConfirmation_(name, email, lang, count) {
  const c = COPY[lang];
  const html = confirmationHtml_(name, c, count);
  const text = c.hello(name) + '\n\n' + c.body + '\n\n' + c.spot + ': #' + count + '\n\nجودتنا غيير\nRAVENX ESPORTS';
  MailApp.sendEmail({
    to: email, subject: c.subject, htmlBody: html, body: text,
    name: 'RAVENX ESPORTS', replyTo: TEAM_EMAIL
  });
}

function sendTeam_(name, email, country, lang, count, sheetUrl) {
  const rows = [['الاسم', esc_(name)], ['الإيميل', esc_(email)], ['الدولة', esc_(country || 'ما كتب')], ['لغة الموقع', lang === 'ar' ? 'عربي' : 'English']]
    .map(r => '<tr><td style="padding:10px 14px;color:#9F9FA7;border-bottom:1px solid #2a2933;white-space:nowrap">' + r[0] + '</td><td style="padding:10px 14px;color:#EDECF1;border-bottom:1px solid #2a2933;font-weight:bold">' + r[1] + '</td></tr>').join('');
  const html = shell_('rtl',
    '<p style="margin:0 0 6px;color:#8F6FD3;font-size:14px;font-weight:bold">تسجيل جديد</p>' +
    '<h1 style="margin:0 0 18px;color:#EDECF1;font-size:24px;line-height:1.5">' + esc_(name) + ' انضم لقائمة الانتظار</h1>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0B0A0F;font-size:15px">' + rows + '</table>' +
    '<p style="margin:20px 0 0;color:#EDECF1;font-size:16px">صار عدد القائمة: <b style="color:#8F6FD3">' + count + '</b></p>' +
    '<p style="margin:18px 0 0"><a href="' + sheetUrl + '" style="display:inline-block;background:#5737AA;color:#EDECF1;text-decoration:none;padding:12px 20px;font-weight:bold">افتح جدول التسجيلات</a></p>' +
    '<p style="margin:18px 0 0;color:#9F9FA7;font-size:13px">اضغط «رد» عشان ترد عليه مباشرة.</p>',
    'right');
  MailApp.sendEmail({
    to: TEAM_EMAIL, subject: 'تسجيل جديد: ' + name + ' (' + count + ')', htmlBody: html,
    body: 'تسجيل جديد: ' + name + ' <' + email + '> ' + country + '\nالعدد: ' + count + '\n' + sheetUrl,
    name: 'موقع RAVENX', replyTo: email
  });
}

const FONT = "'Readex Pro',Tahoma,'Segoe UI',Arial,sans-serif";

function confirmationHtml_(name, c, count) {
  const ctaHref = SITE_URL || SOCIALS[0][1];
  const ctaText = SITE_URL ? c.site : c.cta;
  const steps = c.steps.map((s, i) =>
    '<tr><td width="40" valign="top" style="padding:0 0 12px"><div style="width:30px;height:30px;line-height:30px;text-align:center;background:#2E2155;color:#EDECF1;font-weight:bold;font-size:15px">' + (i + 1) + '</div></td>' +
    '<td valign="middle" style="padding:0 0 12px;color:#EDECF1;font-size:16px">' + s + '</td></tr>').join('');
  const socials = SOCIALS.map(s => '<a href="' + s[1] + '" style="color:#EDECF1;text-decoration:none;font-weight:bold;padding:0 9px">' + s[0] + '</a>').join('<span style="color:#6B6975">|</span>');
  const inner =
    '<p style="margin:0 0 10px;color:#9B7FDA;font-size:14px;font-weight:bold;letter-spacing:' + (c.dir === 'ltr' ? '2px' : '0') + '">' + c.kicker + '</p>' +
    '<h1 style="margin:0 0 14px;color:#FFFFFF;font-size:30px;line-height:1.4;font-weight:bold">' + esc_(c.hello(name)) + '</h1>' +
    '<p style="margin:0 0 26px;color:#C9C8D1;font-size:17px;line-height:1.9">' + c.body + '</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0A0F;border:1px solid #2f2d3a;border-' + c.align + ':5px solid #5737AA"><tr>' +
      '<td style="padding:18px 20px"><div style="color:#9F9FA7;font-size:13px">' + c.spot + '</div>' +
      '<div dir="ltr" style="color:#9B7FDA;font-size:46px;line-height:1.1;font-weight:900;font-family:\'Arial Black\',Arial,sans-serif;text-align:' + c.align + '">#' + count + '</div></td>' +
      '<td style="padding:18px 20px;text-align:' + c.far + '"><div style="color:#9F9FA7;font-size:13px">' + c.status + '</div>' +
      '<div style="color:#FFFFFF;font-size:18px;font-weight:bold;margin-top:6px">' + c.statusVal + ' <span style="color:#CC0A18">&#9679;</span></div></td>' +
    '</tr></table>' +
    '<p style="margin:30px 0 14px;color:#FFFFFF;font-size:19px;font-weight:bold">' + c.next + '</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" dir="' + c.dir + '">' + steps + '</table>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px"><tr><td align="center">' +
      '<a href="' + ctaHref + '" style="display:inline-block;background:#5737AA;border:1px solid #8F6FD3;color:#FFFFFF;text-decoration:none;padding:15px 30px;font-weight:bold;font-size:17px">' + ctaText + '</a>' +
    '</td></tr></table>' +
    '<p style="margin:28px 0 8px;color:#9F9FA7;font-size:13px;text-align:center">' + c.follow + '</p>' +
    '<p dir="ltr" style="margin:0;font-size:14px;text-align:center">' + socials + '</p>';
  const hero = '<tr><td style="padding:0;line-height:0"><img src="' + IMG_HERO + '" width="560" alt="RAVENX ESPORTS · جودتنا غيير" style="display:block;width:100%;max-width:560px;height:auto;border:0"></td></tr>' +
    '<tr><td style="height:5px;line-height:5px;background:#5737AA;font-size:0">&nbsp;</td></tr>';
  return page_(c.dir, c.align, hero + '<tr><td style="padding:32px 30px 36px">' + inner + '</td></tr>', c.foot);
}

function page_(dir, align, rows, foot) {
  return '<!doctype html><html dir="' + dir + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;700&display=swap" rel="stylesheet"></head>' +
    '<body style="margin:0;padding:0;background:#0B0A0F">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0A0F"><tr><td align="center" style="padding:24px 10px">' +
    '<table role="presentation" width="560" cellspacing="0" cellpadding="0" dir="' + dir + '" style="width:100%;max-width:560px;background:#15141B;font-family:' + FONT + ';text-align:' + align + '">' +
    rows +
    '<tr><td style="padding:18px 30px 22px;background:#0B0A0F;color:#6B6975;font-size:12px;line-height:1.8;text-align:center">' + (foot ? foot + '<br>' : '') + 'RAVENX × سهم</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function shell_(dir, inner, align) {
  const head = '<tr><td style="padding:20px 28px;border-bottom:4px solid #5737AA"><table role="presentation" cellspacing="0" cellpadding="0" dir="ltr" align="center"><tr>' +
    '<td><img src="' + IMG_CREST + '" width="64" height="64" alt="RAVENX" style="display:block;border:0"></td>' +
    '<td style="padding-left:14px;color:#FFFFFF;font-size:24px;font-weight:900;letter-spacing:2px;font-family:\'Arial Black\',Arial,sans-serif">RAVENX<br><span style="color:#9B7FDA;font-size:12px;letter-spacing:5px">ESPORTS</span></td>' +
    '</tr></table></td></tr>';
  return page_(dir, align, head + '<tr><td style="padding:28px 30px 32px">' + inner + '</td></tr>', '');
}

function parse_(e) {
  try { return JSON.parse(e.postData.contents); } catch (err) { return (e && e.parameter) || {}; }
}
function clean_(v, max) { return String(v || '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, max); }
function esc_(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
