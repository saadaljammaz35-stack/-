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
const CREST_B64 = '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';

const COPY = {
  ar: {
    subject: 'وصلنا اسمك يا رافنكساوي',
    kicker: 'قائمة الانتظار',
    hello: name => 'هلا والله ' + name + '!',
    body: 'وصلنا اسمك بقائمة انتظار جيرسي RAVENX الجديد. وإلى نزل نعلمك قبل الكل.',
    slogan: 'جودتنا غيير',
    follow: 'تابعنا لين ينزل',
    site: 'زر الموقع',
    foot: 'وصلك هذا الإيميل لأنك سجّلت بقائمة الانتظار في موقع RAVENX. إذا ما سجّلت أنت، تجاهله.',
    dir: 'rtl', align: 'right'
  },
  en: {
    subject: 'You are on the RAVENX waitlist',
    kicker: 'Waitlist',
    hello: name => 'Welcome, ' + name + '!',
    body: 'You are on the waitlist for the new RAVENX kit. When it drops, you hear first.',
    slogan: 'جودتنا غيير',
    follow: 'Follow us until it drops',
    site: 'Visit the site',
    foot: 'You got this email because you joined the waitlist on the RAVENX site. If that was not you, ignore it.',
    dir: 'ltr', align: 'left'
  }
};

/* Run this once from the editor: it asks for permission, creates the sheet,
   and sends you a sample of the confirmation email. */
function setup() {
  const sheet = getSheet_();
  sendConfirmation_('رافنكساوي', TEAM_EMAIL, 'ar');
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
      sendConfirmation_(name, email, lang);
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

function sendConfirmation_(name, email, lang) {
  const c = COPY[lang];
  const html = confirmationHtml_(name, c);
  const text = c.hello(name) + '\n\n' + c.body + '\n\n' + c.slogan + '\nRAVENX ESPORTS';
  MailApp.sendEmail({
    to: email, subject: c.subject, htmlBody: html, body: text,
    name: 'RAVENX ESPORTS', replyTo: TEAM_EMAIL, inlineImages: { crest: crest_() }
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
    name: 'موقع RAVENX', replyTo: email, inlineImages: { crest: crest_() }
  });
}

function confirmationHtml_(name, c) {
  const socials = SOCIALS.map(s => '<a href="' + s[1] + '" style="color:#EDECF1;text-decoration:none;font-weight:bold;padding:0 8px">' + s[0] + '</a>').join('<span style="color:#6B6975">·</span>');
  const hero = SITE_URL ? '<tr><td style="padding:0"><img src="' + SITE_URL + '/assets/jersey-wide.jpg" width="560" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>' : '';
  const siteBtn = SITE_URL ? '<p style="margin:26px 0 0"><a href="' + SITE_URL + '" style="display:inline-block;background:#5737AA;color:#EDECF1;text-decoration:none;padding:13px 22px;font-weight:bold;font-size:15px">' + c.site + '</a></p>' : '';
  const inner =
    '<p style="margin:0 0 8px;color:#8F6FD3;font-size:14px;font-weight:bold">' + c.kicker + '</p>' +
    '<h1 style="margin:0 0 14px;color:#EDECF1;font-size:28px;line-height:1.45">' + esc_(c.hello(name)) + '</h1>' +
    '<p style="margin:0;color:#C9C8D1;font-size:17px;line-height:1.8">' + c.body + '</p>' +
    '<p dir="rtl" style="margin:30px 0 0;color:#EDECF1;font-size:40px;font-weight:900;line-height:1.3;text-align:center">' + c.slogan + '</p>' +
    siteBtn +
    '<p style="margin:30px 0 10px;color:#9F9FA7;font-size:13px">' + c.follow + '</p>' +
    '<p style="margin:0;font-size:14px" dir="ltr">' + socials + '</p>';
  return shell_(c.dir, inner, c.align, hero, c.foot);
}

function shell_(dir, inner, align, hero, foot) {
  return '<!doctype html><html dir="' + dir + '"><body style="margin:0;padding:0;background:#0B0A0F">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0A0F"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="560" cellspacing="0" cellpadding="0" dir="' + dir + '" style="width:100%;max-width:560px;background:#15141B;font-family:Tahoma,Arial,sans-serif;text-align:' + align + '">' +
    '<tr><td style="padding:22px 28px;border-bottom:3px solid #5737AA"><table role="presentation" cellspacing="0" cellpadding="0" dir="ltr"><tr>' +
    '<td><img src="cid:crest" width="44" height="44" alt="RAVENX" style="display:block;border:0"></td>' +
    '<td style="padding-left:12px;color:#EDECF1;font-size:20px;font-weight:900;letter-spacing:2px">RAVENX <span style="color:#8F6FD3;font-size:12px;letter-spacing:3px">ESPORTS</span></td>' +
    '</tr></table></td></tr>' + (hero || '') +
    '<tr><td style="padding:30px 28px 34px">' + inner + '</td></tr>' +
    '<tr><td style="padding:18px 28px;background:#0B0A0F;color:#6B6975;font-size:12px;line-height:1.7">' + (foot ? foot + '<br>' : '') + 'RAVENX × سهم</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function crest_() {
  return Utilities.newBlob(Utilities.base64Decode(CREST_B64), 'image/jpeg', 'crest.jpg');
}
function parse_(e) {
  try { return JSON.parse(e.postData.contents); } catch (err) { return (e && e.parameter) || {}; }
}
function clean_(v, max) { return String(v || '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, max); }
function esc_(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
