/* CRUST sting — seek(f) is a pure function of the 29.97 fps frame number.
   f may be fractional (the 59.94 master asks for half frames).
   No timers, no transitions, no Math.random. */
'use strict';

/* ───────────────── helpers ───────────────── */
var $ = function (id) { return document.getElementById(id); };
function px(n) { return n.toFixed(3) + 'px'; }
function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

var Ease = {
  lin:   function (t) { return t; },
  out:   function (t) { return 1 - Math.pow(1 - t, 3); },
  out4:  function (t) { return 1 - Math.pow(1 - t, 4); },
  out5:  function (t) { return 1 - Math.pow(1 - t, 5); },
  in2:   function (t) { return t * t; },
  in3:   function (t) { return t * t * t; },
  in5:   function (t) { return t * t * t * t * t; },
  /* accelerates, but never sits still at the start of the move */
  accel: function (t) { return 0.32 * t + 0.68 * t * t; },
  inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  smooth:function (t) { return t * t * (3 - 2 * t); }
};

/* kf(f, [[frame, value, easeForThisSegment?], ...], defaultEase) */
function kf(f, tbl, ease) {
  var n = tbl.length;
  if (f <= tbl[0][0]) return tbl[0][1];
  if (f >= tbl[n - 1][0]) return tbl[n - 1][1];
  for (var i = 0; i < n - 1; i++) {
    var a = tbl[i], b = tbl[i + 1];
    if (f >= a[0] && f <= b[0]) {
      var span = b[0] - a[0];
      var t = span === 0 ? 1 : (f - a[0]) / span;
      var e = a[2] || ease || Ease.lin;
      return a[1] + (b[1] - a[1]) * e(t);
    }
  }
  return tbl[n - 1][1];
}

/* deterministic integer hash — stands in for Math.random */
function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

/* velocity of a position function, for speed- and direction-driven blur */
function vel(posFn, f) {
  var a = posFn(f - 0.5), b = posFn(f + 0.5);
  var vx = b[0] - a[0], vy = b[1] - a[1];
  return { vx: vx, vy: vy, sp: Math.sqrt(vx * vx + vy * vy), ang: Math.atan2(vy, vx) * 180 / Math.PI };
}

/* a directional smear built out of a rotate / scaleX / un-rotate sandwich:
   the shape stretches along its own motion without ending up rotated. */
function smearT(v, kStretch, maxStretch) {
  var s = 1 + Math.min(v.sp * kStretch, maxStretch);
  return ' rotate(' + v.ang.toFixed(2) + 'deg) scaleX(' + s.toFixed(4) + ') rotate(' + (-v.ang).toFixed(2) + 'deg)';
}

function sd(id, x, y) { $(id).setAttribute('stdDeviation', Math.max(0, x).toFixed(3) + ' ' + Math.max(0, y).toFixed(3)); }

/* ───────────────── the CRUST mark ───────────────── */
/* the real logo: cream disc, blue pinstripes in the outer ring, a cocoa
   hairline circle, CRUST over BAKERY in a serif. */
function discMark(uid, opts) {
  opts = opts || {};
  var cream = opts.cream || '#F7F1E4', ink = opts.ink || '#2A1710',
      stripe = opts.stripe || '#A8C0D8', rim = opts.rim || '#E8E4DC';
  var s = '';
  for (var i = 0; i < 18; i++) {
    var x = 8 + i * 10.6;
    var w = (i % 3 === 0) ? 3.1 : 1.7;
    s += '<rect x="' + (x - w / 2).toFixed(2) + '" y="0" width="' + w + '" height="200" fill="' + stripe + '" opacity="' + (i % 3 === 0 ? .78 : .52) + '"/>';
  }
  return '<svg class="mark" viewBox="0 0 200 200" width="100%" height="100%">' +
    '<defs><clipPath id="dc' + uid + '"><circle cx="100" cy="100" r="99"/></clipPath></defs>' +
    '<g clip-path="url(#dc' + uid + ')">' +
      '<rect width="200" height="200" fill="' + cream + '"/>' + s +
      '<circle cx="100" cy="100" r="76" fill="' + cream + '"/>' +
    '</g>' +
    '<circle cx="100" cy="100" r="99" fill="none" stroke="' + rim + '" stroke-width="2"/>' +
    '<circle cx="100" cy="100" r="76" fill="none" stroke="' + ink + '" stroke-width="1.7" opacity=".9"/>' +
    '<text x="100" y="104" text-anchor="middle" fill="' + ink + '" font-family="Amiri, serif" ' +
      'font-size="34" letter-spacing="3.4" style="text-indent:3.4px">CRUST</text>' +
    '<text x="100" y="126" text-anchor="middle" fill="' + ink + '" font-family="Amiri, serif" ' +
      'font-size="14" letter-spacing="2.6">BAKERY</text>' +
  '</svg>';
}

/* the flat, monochrome version used in the menu bar */
function markMono(col) {
  return '<svg viewBox="0 0 200 200" width="53" height="53">' +
    '<circle cx="100" cy="100" r="92" fill="none" stroke="' + col + '" stroke-width="11"/>' +
    '<g stroke="' + col + '" stroke-width="11" stroke-linecap="round">' +
      '<path d="M100 36 V164"/><path d="M62 52 V148"/><path d="M138 52 V148"/>' +
    '</g></svg>';
}

/* ───────────────── content ───────────────── */
var PROMPT = 'ابغى علبة بابكا اليوم';
var TYPE = [];          /* reveal frame per character */

/* ───────────────── init ───────────────── */
var LOCK_S = 1, DISC_CX = 540, S8_BASE = 240, S8_W0 = 1, SMEARS = [];
var KEY_X = 450, KEY_Y = 591;

function buildType(n, fa, fb) {
  var raw = [], fr = 0;
  for (var i = 0; i < n; i++) { raw.push(fr); fr += (hash(i * 13 + 5) < 0.45 ? 2 : 1); }
  var span = raw[n - 1] || 1, k = (fb - fa) / span;
  return raw.map(function (r) { return fa + r * k; });
}

function init() {
  /* marks */
  $('s1disc').innerHTML = discMark(1);
  $('s7disc').innerHTML = discMark(7, { cream: '#F7F3EC' });
  $('s3mark').innerHTML = markMono('#ffffff');

  /* fit the whole header lockup into the span x474–1063 (589 px) */
  var lock = $('s1lock');
  $('s1').style.display = 'block';
  /* an abspos box is capped by the space left of the frame edge and its flex
     children then shrink, so the lockup is measured on a free-standing clone. */
  var clone = lock.cloneNode(true);
  clone.style.position = 'absolute'; clone.style.left = '-6000px'; clone.style.top = '0';
  clone.style.transform = 'none'; clone.style.width = 'max-content';
  document.getElementById('stage').appendChild(clone);
  var natural = clone.getBoundingClientRect().width;
  clone.remove();
  LOCK_S = 589 / natural;
  lock.style.transform = 'scale(' + LOCK_S + ')';
  DISC_CX = 474 + 66 * LOCK_S;
  window.__LS = LOCK_S; window.__DCX = DISC_CX;
  $('s1').style.display = 'none';

  /* S6: align each frosted title's blurred backdrop with its own card art */
  $('s6').style.display = 'block';
  [['c6at', 'c6a', 'art/knots-blur.jpg'], ['c6bt', 'c6b', 'art/stripes-blur.jpg']].forEach(function (p) {
    var t = $(p[0]), card = $(p[1]);
    t.style.backgroundImage = 'linear-gradient(rgba(255,255,255,.56),rgba(255,255,255,.56)), url(' + p[2] + ')';
    t.style.backgroundSize = '538px 348px, 538px 348px';
    var avail = 538 - 30 - 26;                       /* right padding, then a left margin */
    var fs = 150;
    t.style.fontSize = fs + 'px';
    /* measure off-screen: inside the card the box is clipped to 508 px and lies */
    var m = document.createElement('div');
    m.style.cssText = 'position:absolute;left:-6000px;top:0;white-space:nowrap;direction:rtl;' +
                      'font-family:Tajawal;font-weight:700;line-height:1;font-size:' + fs + 'px';
    m.textContent = t.textContent;
    document.getElementById('stage').appendChild(m);
    var w0 = m.getBoundingClientRect().width;
    m.remove();
    if (w0 > avail) { fs = fs * avail / w0; t.style.fontSize = fs.toFixed(2) + 'px'; }
    var r = t.getBoundingClientRect(), c = card.getBoundingClientRect();
    var ox = (c.left - r.left).toFixed(2) + 'px ' + (c.top - r.top).toFixed(2) + 'px';
    t.style.backgroundPosition = ox + ', ' + ox;
  });
  $('s6').style.display = 'none';

  /* S8: measure the wordmark once, then drive its width by font-size */
  $('s8').style.display = 'block';
  var w = $('s8mainword');
  w.style.fontSize = S8_BASE + 'px';
  S8_W0 = w.getBoundingClientRect().width;
  /* 26 fading copies for the zoom streak */
  var html = '';
  for (var i = 0; i < 26; i++) html += '<div class="s8w"><div class="s8word" id="sm' + i + '">CRUST</div></div>';
  $('s8smear').innerHTML = html;
  for (var j = 0; j < 26; j++) SMEARS.push($('sm' + j));
  $('s8').style.display = 'none';

  /* where the cursor comes to rest in S4: measured, so it is always under the
     key phrase whatever the copy does to the line. */
  $('s4').style.display = 'block';
  $('s4scroll').style.transform = 'translateY(0px)';
  var kr = document.querySelector('#lbody .key').getBoundingClientRect();
  KEY_X = Math.round(kr.left + kr.width / 2);
  KEY_Y = Math.round(kr.bottom + 16);
  $('s4').style.display = 'none';

  TYPE = buildType(PROMPT.length, 117, 150);
}

/* ───────────────── shot plumbing ───────────────── */
var SHOT_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
function show() {
  var on = Array.prototype.slice.call(arguments);
  for (var i = 0; i < SHOT_IDS.length; i++) {
    $(SHOT_IDS[i]).style.display = on.indexOf(SHOT_IDS[i]) >= 0 ? 'block' : 'none';
  }
}
function cursorOff() { $('cursor').style.display = 'none'; }
function cursorAt(x, y, rot, scale) {
  var c = $('cursor');
  c.style.display = 'block';
  c.style.transform = 'translate(' + px(x - 1.5) + ',' + px(y - 1.5) + ') rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
}

/* ═══════════════ S1  f0–71 ═══════════════ */
var S1_CUR_X = [[27, 891], [44, 770, Ease.out], [47, 766], [51, 730, Ease.in2], [56, 629], [59, 587, Ease.out], [71, 555]];
var S1_CUR_Y = [[27, 393], [44, 383, Ease.out], [47, 384], [51, 430, Ease.in2], [56, 564], [59, 546, Ease.out], [71, 531]];
function s1CurPos(f) { return [kf(f, S1_CUR_X, Ease.out), kf(f, S1_CUR_Y, Ease.out)]; }

function s1(f) {
  show('s1');
  $('s1haze').style.opacity = kf(f, [[0, 1], [28, 0]], Ease.out).toFixed(4);

  var z = kf(f, [[0, 1], [46, 1, Ease.inOut], [60, 1.2], [61, 1.2, Ease.in2], [71, 1.04]]);
  $('s1cam').style.transform = 'scale(' + z.toFixed(5) + ')';

  $('s1win').style.opacity = kf(f, [[0, 0], [14, 0], [15, .53], [19, .7], [24, 1]]).toFixed(4);

  var cy = f <= 37 ? kf(f, [[0, 932], [2, 776], [5, 683], [10, 608], [24, 546], [37, 536]])
                   : 536 - (f - 37);
  var lock = $('s1lock');
  lock.style.top = px(cy - 66);
  lock.style.transform = 'scale(' + LOCK_S.toFixed(5) + ')';

  var name = $('s1name');
  name.style.opacity = kf(f, [[1.5, 0], [3, 1]]).toFixed(3);
  name.style.filter = 'blur(' + kf(f, [[2, 13], [12, 0]], Ease.out).toFixed(2) + 'px)';

  var pill = $('s1pill');
  pill.style.opacity = kf(f, [[3.5, 0], [5, 1]]).toFixed(3);
  pill.style.filter = 'blur(' + kf(f, [[4, 17], [12, 0]], Ease.out).toFixed(2) + 'px)';
  pill.style.transform = 'translateX(' + px(kf(f, [[4, 15], [11, 0]], Ease.out)) + ')';

  /* ice ring around the disc */
  var ring = $('s1ring'), rd = kf(f, [[53, 118], [58, 174], [71, 184]], Ease.out);
  ring.style.opacity = kf(f, [[52, 0], [56, 1]], Ease.out).toFixed(3);
  ring.style.width = ring.style.height = px(rd);
  ring.style.left = px(DISC_CX - rd / 2);
  ring.style.top = px(cy - rd / 2);
  ring.style.background = 'radial-gradient(circle, rgba(207,227,244,0) 58%, rgba(207,227,244,.9) 73%, rgba(251,253,255,.35) 88%, rgba(251,253,255,0) 100%)';
  ring.style.filter = 'blur(4px)';

  if (f >= 27) {
    var p = s1CurPos(f), v = vel(s1CurPos, f);
    var rot = kf(f, [[46, 0], [51, -95, Ease.lin], [55, -95], [61, 0]], Ease.inOut);
    var sc = kf(f, [[53, 1], [60, 1.55, Ease.lin], [69, 1.55], [71, 1.3175]], Ease.out);
    cursorAt(p[0], p[1], rot, sc);
    $('cursor').style.filter = 'blur(' + Math.min(v.sp * 0.085, 3.2).toFixed(2) + 'px)';
  } else cursorOff();
}

/* ═══════════════ S2  f72–100 ═══════════════ */
var S2_BASE = [180, 270, 0, 90];
var S2_COL = ['#FFFFFF', '#3E5A86', '#A8C0D8', '#6B4A34'];
var S2_ROW = [[540, 540], [600, 540], [644, 540], [688, 540]];

function s2SqPos(i, f) {
  var R = kf(f, [[72, 430], [86, 216]], Ease.out4);
  var D = kf(f, [[72, 300], [86, 0]], Ease.out4);
  var a = (S2_BASE[i] + D) * Math.PI / 180;
  var cx = 540 + R * Math.cos(a), cy = 540 + R * Math.sin(a);
  var m = kf(f, [[88, 0], [100, 1]], Ease.accel);
  return [cx + (S2_ROW[i][0] - cx) * m, cy + (S2_ROW[i][1] - cy) * m];
}

function s2(f) {
  show('s2');
  var icon = kf(f, [[72, 276], [86, 178, Ease.lin], [88, 172, Ease.accel], [100, 40]], Ease.out4);
  var halo = kf(f, [[72, 176], [75, 240], [86, 326, Ease.lin], [88, 322, Ease.accel], [100, 92]]);
  var sz = kf(f, [[72, 92], [86, 92, Ease.lin], [88, 90, Ease.accel], [100, 34]]);

  var H = $('s2halo');
  H.style.width = H.style.height = px(halo);
  H.style.left = px(540 - halo / 2); H.style.top = px(540 - halo / 2);
  H.style.opacity = kf(f, [[72, 0], [76, 1]], Ease.out).toFixed(3);

  var I = $('s2icon');
  I.style.width = I.style.height = px(icon);
  I.style.left = px(540 - icon / 2); I.style.top = px(540 - icon / 2);
  I.style.borderRadius = px(icon * 0.28);
  $('s2iconmark').style.fontSize = px(icon * 0.205);
  $('s2iconmark').style.letterSpacing = px(icon * 0.021);

  for (var i = 0; i < 4; i++) {
    var el = $('sq' + i);
    var p = s2SqPos(i, f);
    var v = vel(function (x) { return s2SqPos(i, x); }, f);
    el.style.width = el.style.height = px(sz);
    el.style.left = px(-sz / 2); el.style.top = px(-sz / 2);
    el.style.borderRadius = px(sz * 0.283);
    el.style.background = S2_COL[i];
    el.style.zIndex = (i === 0 ? 2 : 8);
    el.style.border = i === 0 ? '1px solid #E3E8EF' : 'none';
    el.style.boxShadow = i === 0 ? '0 3px 12px rgba(42,23,16,.13)' : 'none';
    el.style.transform = 'translate(' + px(p[0]) + ',' + px(p[1]) + ')' + smearT(v, 0.020, 1.5);
    el.style.filter = 'blur(' + Math.min(v.sp * 0.055, 7).toFixed(2) + 'px)';
  }
  $('s2grp').style.filter = 'blur(' + kf(f, [[88, 0.3], [100, 6]], Ease.accel).toFixed(2) + 'px)';
  cursorOff();
}

/* ═══════════════ S3  f101–158 ═══════════════ */
var S3_PAN = [[115, 0], [118, 18], [120, 62], [123, 98], [126, 115], [130, 125]];
function s3(f) {
  show('s3');
  var pan = kf(f, S3_PAN);
  $('s3pan').style.transform = 'translateX(' + px(pan) + ')';
  $('s3wallart').style.transform = 'translateX(' + px(pan * 0.55) + ')';

  /* the whole scene drifts up and whips out */
  /* a long gentle drift that only turns into a whip at the very end:
     t^5 puts the scene at 25 px/frame on f158, the brief's number, while
     f150 is still almost still — which is what makes the prompt readable. */
  var rise = kf(f, [[136, 0], [158, -110]], Ease.in5);
  var enter = kf(f, [[101, 3], [110, 0]], Ease.lin);
  var t3 = clamp((f - 136) / 22, 0, 1);
  var whip = 7.6 * Math.pow(t3, 6);
  $('s3all').style.transform = 'translateY(' + px(rise) + ')';
  var vb = Math.max(enter, whip);
  if (vb > 0.02) { sd('dirYb', Math.max(enter * 0.55, whip * 0.12), vb); $('s3all').style.filter = 'url(#dirY)'; }
  else $('s3all').style.filter = 'none';
  $('s3tint').style.opacity = kf(f, [[154, 0], [158, .88]], Ease.in2).toFixed(3);

  /* the frosted prompt box springs out from under the mark */
  var w = kf(f, [[116, 86], [119, 420], [122, 636], [126, 744], [131, 733], [135, 724], [138, 726]], Ease.out);
  var h = kf(f, [[116, 26], [119, 120], [122, 196], [126, 232], [131, 226], [135, 230], [138, 229]], Ease.out);
  var top = kf(f, [[116, 540], [119, 556], [122, 566], [126, 570], [131, 568], [138, 568]], Ease.out);
  var cx = kf(f, [[116, 560], [126, 559], [138, 559]]);
  var G = $('s3glass');
  if (f >= 116) {
    G.style.display = 'block';
    G.style.width = px(w); G.style.height = px(h);
    G.style.left = px(cx - w / 2); G.style.top = px(top);
    G.style.opacity = kf(f, [[116, .2], [119, 1]], Ease.out).toFixed(3);
    var inner = kf(f, [[116, 0], [120, 1]], Ease.out);
    $('s3prompt').style.opacity = $('s3send').style.opacity = $('s3tools').style.opacity = inner.toFixed(3);
  } else G.style.display = 'none';

  /* typing */
  var n = 0;
  for (var i = 0; i < TYPE.length; i++) if (f >= TYPE[i]) n = i + 1;
  $('s3txt').textContent = PROMPT.slice(0, n);

  /* cursor rises from below, rests on the mark, presses f113–117 */
  if (f >= 102) {
    var cxp = function (x) {
      return [557 + kf(x, S3_PAN), kf(x, [[102, 1090], [108, 640], [112, 508, Ease.out], [120, 503], [130, 503]], Ease.out)];
    };
    var p = cxp(f), v = vel(cxp, f);
    var sc = kf(f, [[112, 1], [114, .86, Ease.lin], [116, .86], [118, 1]], Ease.out);
    cursorAt(p[0], p[1], 0, sc);
    $('cursor').style.opacity = kf(f, [[126, 1], [132, 0]], Ease.out).toFixed(3);
    $('cursor').style.filter = 'blur(' + Math.min(v.sp * 0.05, 4).toFixed(2) + 'px)';
  } else cursorOff();
}

/* ═══════════════ S4  f159–186 ═══════════════ */
var S4_SCROLL = [[159, 420], [160, 315], [161, 210], [162, 170], [163, 140], [164, 116], [165, 96],
                 [166, 81], [168, 57], [170, 39], [172, 26], [175, 14], [177, 7], [180, 0], [186, -6]];
function s4(f, inS5) {
  var off = kf(f, S4_SCROLL);
  $('s4scroll').style.transform = 'translateY(' + px(off) + ')';
  $('s4flash').style.opacity = inS5 ? 0 : kf(f, [[159, 1], [165, 0]], Ease.out).toFixed(3);
  var b = inS5 ? kf(f, [[187, 0], [196, 2.5], [214, 2.5]], Ease.out)
               : kf(f, [[159, 24], [162, 8], [165, 1.5], [169, 0]], Ease.out);
  $('s4').style.filter = 'blur(' + b.toFixed(2) + 'px)';
  $('s4scroll').style.filter = 'none';
  if (inS5) return;
  show('s4');
  /* a cursor pointing straight up rides the scroll, then drifts right */
  var cp = function (x) { return [kf(x, [[159, KEY_X], [180, KEY_X], [186, KEY_X + 55]], Ease.out), KEY_Y + kf(x, S4_SCROLL)]; };
  var p = cp(f), v = vel(cp, f);
  cursorAt(p[0], p[1], 45, 1);
  $('cursor').style.opacity = kf(f, [[159, 0], [163, 0], [168, 1]], Ease.out).toFixed(3);
  $('cursor').style.filter = 'blur(' + Math.min(v.sp * 0.05, 6).toFixed(2) + 'px)';
}

/* ═══════════════ S5  f187–214 ═══════════════ */
function s5(f) {
  show('s4', 's5');
  s4(f, true);
  cursorOff();
  var coverTop = kf(f, [[187, 642], [191, 456], [196, 395], [200, 369], [205, 348],
                        [207, 340], [210, 322], [214, 286]], Ease.out);
  var card = $('s5card');
  card.style.top = px(coverTop - 24);
  card.style.transform = 'scale(' + kf(f, [[207, 1], [214, .95]], Ease.in2).toFixed(4) + ')';
  card.style.filter = 'blur(' + kf(f, [[187, 2.2], [189, 3.8], [193, 2.0], [197, .7], [201, 0]], Ease.out).toFixed(2) + 'px)';
  var fb = kf(f, [[207, 1], [214, 7]], Ease.in2);
  $('s4').style.filter = 'blur(' + (2.5 + fb).toFixed(2) + 'px)';
  $('s5').style.filter = 'blur(' + (f >= 207 ? fb : 0).toFixed(2) + 'px)';
}

/* ═══════════════ S6  f215–244 ═══════════════ */
function s6(f) {
  show('s6');
  cursorOff();
  var drift = kf(f, [[230, 0], [238, -24, Ease.in2], [244, -96]]);
  var blurOut = kf(f, [[238, 0], [244, 9]], Ease.in2);

  var ta = $('c6a'), tb = $('c6b');
  var ya = kf(f, [[215, 264], [219, 196], [223, 176], [227, 169], [230, 168]], Ease.out) + drift;
  var yb = kf(f, [[215, 927], [220, 660], [225, 585], [230, 552]], Ease.out) + drift * 1.12;
  var sa = kf(f, [[215, 1.08], [223, 1.01], [230, 1]], Ease.out);
  var sb = kf(f, [[215, 1.1], [224, 1.01], [230, 1]], Ease.out);
  ta.style.top = px(ya); tb.style.top = px(yb);
  ta.style.transform = 'scale(' + sa.toFixed(4) + ')';
  tb.style.transform = 'scale(' + sb.toFixed(4) + ')';
  var ba = kf(f, [[215, 12], [224, 0]], Ease.out);
  var bb = kf(f, [[215, 13], [225, 0]], Ease.out);
  ta.style.filter = 'blur(' + (ba + blurOut).toFixed(2) + 'px)';
  tb.style.filter = 'blur(' + (bb + blurOut).toFixed(2) + 'px)';
}

/* ═══════════════ S7  f245–300 ═══════════════ */
function s7(f) {
  show('s7');
  cursorOff();
  var size = kf(f, [[245, 168], [287, 168], [300, 123]], Ease.in2);
  var top = f <= 269 ? kf(f, [[245, 569], [250, 491], [255, 468], [269, 456]], Ease.out)
                     : 540 - size / 2;
  var d = $('s7disc');
  d.style.width = d.style.height = px(size);
  d.style.left = px(540 - size / 2);
  d.style.top = px(top);
  var sm = kf(f, [[245, 18], [250, 2], [254, 0]], Ease.out);
  sd('dirSb', sm * 0.08, sm);
  d.style.filter = sm > 0.01 ? 'url(#dirS)' : 'none';
}

/* ═══════════════ S8  f301–359 ═══════════════ */
var S8_W = [[301, 1650], [302, 1350], [303, 1110], [304, 1049], [309, 734], [311, 678],
            [320, 563], [342, 516], [350, 492], [355, 450, Ease.in2], [359, 267]];
function s8(f) {
  show('s8');
  cursorOff();
  var w = kf(f, S8_W);
  var fs = S8_BASE * w / S8_W0;
  $('s8mainword').style.fontSize = px(fs);
  $('s8haloword').style.fontSize = px(fs);
  $('s8halo').style.opacity = kf(f, [[301, .18], [310, .5], [359, .62]]).toFixed(3);

  var smear = kf(f, [[301, 1], [306, 0]], Ease.out);
  $('s8smear').style.display = smear > 0.002 ? 'block' : 'none';
  if (smear > 0.002) {
    for (var i = 0; i < 26; i++) {
      var k = (i + 1) / 26;
      SMEARS[i].style.fontSize = px(fs * (1 - 0.46 * k));
      SMEARS[i].parentNode.style.opacity = (smear * 0.17 * (1 - k)).toFixed(4);
    }
  }
  var hx = kf(f, [[301, 30], [303, 6], [305, 0]], Ease.out);
  sd('dirXb', hx, hx * 0.06);
  var tail = kf(f, [[350, 0], [359, 3.5]], Ease.in2);
  $('s8main').style.filter = (hx > 0.01 ? 'url(#dirX) ' : '') + 'blur(' + tail.toFixed(2) + 'px)';
}

/* ═══════════════ seek ═══════════════ */
function seek(f) {
  f = clamp(f, 0, 359.5);
  if (f < 72) s1(f);
  else if (f < 101) s2(f);
  else if (f < 159) s3(f);
  else if (f < 187) s4(f, false);
  else if (f < 215) s5(f);
  else if (f < 245) s6(f);
  else if (f < 301) s7(f);
  else s8(f);
}
window.seek = seek;
window.filmReady = (async function () {
  /* fonts.ready only waits on faces something already asked for. Nothing has been
     laid out yet, so every face has to be requested by hand — otherwise init()
     measures fallback metrics and every fitted box comes out the wrong width. */
  await Promise.all([
    '400 47px Tajawal', '500 46px Tajawal', '500 24px Tajawal', '700 78px Tajawal',
    '700 150px Tajawal', '400 34px Tajawal', '600 38px Tajawal', '700 26px Tajawal',
    '400 34px Amiri', '700 240px Amiri', '700 57px Amiri'
  ].map(function (s) { return document.fonts.load(s, 'نص CRUST'); }));
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map(function (i) { return i.decode ? i.decode().catch(function () {}) : null; }));
  /* give the CSS background images a chance to land */
  var urls = ['art/knots.jpg', 'art/stripes.jpg', 'art/box-wide.jpg', 'art/knots-small.jpg',
              'art/knots-blur.jpg', 'art/stripes-blur.jpg'];
  await Promise.all(urls.map(function (u) {
    return new Promise(function (res) { var im = new Image(); im.onload = im.onerror = res; im.src = u; });
  }));
  init();
  seek(0);
  return true;
})();
