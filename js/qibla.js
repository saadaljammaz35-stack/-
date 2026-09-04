/**
 * القبلة — اتجاه الكعبة المشرّفة والمسافة إليها، مع بوصلة الجهاز.
 */

export const KAABA = { lat: 21.4224779, lng: 39.8251832 };

const DEG = Math.PI / 180;

/** اتجاه القبلة بالدرجات من الشمال الجغرافي */
export function qiblaBearing(lat, lng) {
  const φ1 = lat * DEG, φ2 = KAABA.lat * DEG;
  const Δλ = (KAABA.lng - lng) * DEG;
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  let θ = Math.atan2(y, x) / DEG;
  return (θ + 360) % 360;
}

/** المسافة إلى الكعبة بالكيلومترات */
export function distanceToKaaba(lat, lng) {
  const R = 6371;
  const dLat = (KAABA.lat - lat) * DEG;
  const dLng = (KAABA.lng - lng) * DEG;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat * DEG) * Math.cos(KAABA.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** الجهة بالعربية */
export function bearingToDirection(b) {
  const names = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي',
    'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];
  return names[Math.round(b / 45) % 8];
}

/**
 * بوصلة الجهاز. تُرجع دالة إيقاف، وتستدعي onHeading بزاوية الشمال.
 */
export async function startCompass(onHeading, onError) {
  const handler = (e) => {
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number') {
      heading = e.webkitCompassHeading;               // iOS: من الشمال المغناطيسي
    } else if (typeof e.alpha === 'number') {
      heading = e.absolute || e.type === 'deviceorientationabsolute'
        ? (360 - e.alpha) % 360
        : (360 - e.alpha) % 360;
    }
    if (heading !== null && !Number.isNaN(heading)) onHeading(heading, !!e.absolute);
  };

  try {
    // iOS 13+ يتطلّب إذنًا صريحًا بعد تفاعل المستخدم
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      const state = await DOE.requestPermission();
      if (state !== 'granted') {
        onError?.('لم يُسمح باستخدام بوصلة الجهاز. يمكنك الاعتماد على الزاوية الرقمية.');
        return () => {};
      }
    }
    const evt = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, handler, true);
    return () => window.removeEventListener(evt, handler, true);
  } catch (e) {
    onError?.('بوصلة الجهاز غير متاحة على هذا الجهاز.');
    return () => {};
  }
}

/** تحديد الموقع */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('خدمة تحديد الموقع غير متاحة في هذا المتصفح.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: 'تم رفض إذن الموقع. يمكنك اختيار مدينتك يدويًّا من الإعدادات.',
          2: 'تعذّر تحديد الموقع حاليًّا.',
          3: 'انتهت مهلة تحديد الموقع.'
        };
        reject(new Error(messages[err.code] || 'تعذّر تحديد الموقع.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000, ...options }
    );
  });
}

/** مدن جاهزة للاختيار اليدوي */
export const CITIES = [
  { city: 'مكة المكرمة', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  { city: 'المدينة المنورة', lat: 24.4686, lng: 39.6142, tz: 'Asia/Riyadh' },
  { city: 'الرياض', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  { city: 'جدة', lat: 21.4858, lng: 39.1925, tz: 'Asia/Riyadh' },
  { city: 'الدمام', lat: 26.4207, lng: 50.0888, tz: 'Asia/Riyadh' },
  { city: 'بريدة', lat: 26.3260, lng: 43.9750, tz: 'Asia/Riyadh' },
  { city: 'تبوك', lat: 28.3835, lng: 36.5662, tz: 'Asia/Riyadh' },
  { city: 'أبها', lat: 18.2465, lng: 42.5117, tz: 'Asia/Riyadh' },
  { city: 'حائل', lat: 27.5114, lng: 41.7208, tz: 'Asia/Riyadh' },
  { city: 'الطائف', lat: 21.2703, lng: 40.4158, tz: 'Asia/Riyadh' },
  { city: 'نجران', lat: 17.4917, lng: 44.1322, tz: 'Asia/Riyadh' },
  { city: 'جازان', lat: 16.8892, lng: 42.5511, tz: 'Asia/Riyadh' },
  { city: 'الأحساء', lat: 25.3833, lng: 49.5833, tz: 'Asia/Riyadh' },
  { city: 'ينبع', lat: 24.0895, lng: 38.0618, tz: 'Asia/Riyadh' },
  { city: 'الجبيل', lat: 27.0174, lng: 49.6225, tz: 'Asia/Riyadh' },
  { city: 'خميس مشيط', lat: 18.3060, lng: 42.7290, tz: 'Asia/Riyadh' },
  { city: 'الدوحة', lat: 25.2854, lng: 51.5310, tz: 'Asia/Qatar' },
  { city: 'دبي', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  { city: 'أبوظبي', lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai' },
  { city: 'الكويت', lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait' },
  { city: 'المنامة', lat: 26.2285, lng: 50.5860, tz: 'Asia/Bahrain' },
  { city: 'مسقط', lat: 23.5880, lng: 58.3829, tz: 'Asia/Muscat' },
  { city: 'صنعاء', lat: 15.3694, lng: 44.1910, tz: 'Asia/Aden' },
  { city: 'عمّان', lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman' },
  { city: 'القدس', lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem' },
  { city: 'غزة', lat: 31.5017, lng: 34.4668, tz: 'Asia/Gaza' },
  { city: 'بيروت', lat: 33.8938, lng: 35.5018, tz: 'Asia/Beirut' },
  { city: 'دمشق', lat: 33.5138, lng: 36.2765, tz: 'Asia/Damascus' },
  { city: 'بغداد', lat: 33.3152, lng: 44.3661, tz: 'Asia/Baghdad' },
  { city: 'القاهرة', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  { city: 'الخرطوم', lat: 15.5007, lng: 32.5599, tz: 'Africa/Khartoum' },
  { city: 'طرابلس', lat: 32.8872, lng: 13.1913, tz: 'Africa/Tripoli' },
  { city: 'تونس', lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis' },
  { city: 'الجزائر', lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers' },
  { city: 'الرباط', lat: 34.0209, lng: -6.8416, tz: 'Africa/Casablanca' },
  { city: 'نواكشوط', lat: 18.0735, lng: -15.9582, tz: 'Africa/Nouakchott' },
  { city: 'إسطنبول', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  { city: 'كوالالمبور', lat: 3.1390, lng: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  { city: 'جاكرتا', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta' },
  { city: 'إسلام آباد', lat: 33.6844, lng: 73.0479, tz: 'Asia/Karachi' },
  { city: 'لندن', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { city: 'باريس', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  { city: 'برلين', lat: 52.5200, lng: 13.4050, tz: 'Europe/Berlin' },
  { city: 'نيويورك', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  { city: 'تورونتو', lat: 43.6532, lng: -79.3832, tz: 'America/Toronto' }
];
