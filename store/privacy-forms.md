# Store privacy forms

Answers for Google Play **Data safety** and App Store **App Privacy**, matching the privacy
policy at https://ma-allah.vercel.app/privacy. Re-check them whenever a feature starts sending
data anywhere.

## What leaves the device

| Feature | What is sent | Where | Optional |
| --- | --- | --- | --- |
| Group khatma | Khatma name, optional dedication name, the display name the user types, the juz taken and whether read, a random app-generated device token | Supabase (Mumbai), the app's own backend | Yes, only when the user creates or joins one |
| Family circle / adhkar buddy | Circle name, the display name the user types, a random device token, and for days the user chooses to share: four yes/no flags (five prayers, morning adhkar, evening adhkar, some Quran) and encouragements sent | Supabase (Mumbai), the app's own backend | Yes, only when the user creates or joins one |
| Reading circle | Page and verse chosen by the reader and display names, relayed live; not stored | Supabase Realtime (Mumbai) | Yes, only while in a circle |
| Recitations, online tafsir, translations | The request itself (surah, reciter, edition) | Quran.com / QuranCDN | Yes, on use |
| Hadith books | Download request | GitHub / jsDelivr | Yes, on use |
| Live Haramain / radio | Stream request | YouTube / mp3quran.net | Yes, on use |
| Nearby mosques | Approximate position, rounded to ~100 m (no identifier) | OpenStreetMap Overpass API | Yes, only when the page is opened |
| Rain and wind adhkar | Approximate position, rounded to ~1 km (no identifier) | MET Norway Locationforecast API | Yes, off by default |

Nothing else is sent. Location is used on the device to pick the nearest city and calculate
prayer times and the qibla; when no city is near, the phone's own geocoder (Apple / Google) may
name the place. The nearby mosques page sends an approximate position to OpenStreetMap's
Overpass API, only when opened. The app has no analytics, advertising or crash-reporting SDKs; crash reports
come only from the stores' own tools and from emails the user chooses to send.

## Google Play — Data safety

- Does the app collect or share user data? **Yes** (only for group khatma).
- Is all collected data encrypted in transit? **Yes** (HTTPS).
- Can users request deletion? **Yes** — the creator deletes a khatma in the app, members give back
  their juz, and anything else on request to saadaljammaz35@gmail.com.

Data types collected (not shared with third parties; Supabase processes it on the app's behalf):

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → Name (display name in a group khatma) | Yes | No | Yes | App functionality |
| App activity → Other user-generated content (khatma name, juz taken / read) | Yes | No | Yes | App functionality |
| Device or other IDs (random app-generated token) | Yes | No | Yes | App functionality |
| Location → Approximate location (nearby mosques, rounded to ~100 m; weather adhkar, ~1 km) | Yes | Yes (OpenStreetMap Overpass and MET Norway, to answer the request) | Yes | App functionality |

Steps to the mosque counts steps on the device only (activity recognition permission); the
count never leaves the phone, so it is not "collected" for Data safety.

Not collected: precise location, contacts, email, phone, financial info, health, messages, photos,
audio, files, calendar, web history, app interactions/analytics, crash logs, diagnostics.

## App Store — App Privacy

- Data used to track you: **None**.
- Data linked to you: **None** (no account; the display name is free text and the token is random).
- Data not linked to you:
  - **User Content → Other User Content** (group khatma name, juz status) — App Functionality.
  - **Identifiers → Device ID** (random app-generated token) — App Functionality.
  - **Contact Info → Name** (display name in a group khatma) — App Functionality.
  - **Location → Coarse Location** (nearby mosques, rounded to ~100 m, sent to OpenStreetMap's
    Overpass API only when the page is opened; the optional weather adhkar, ~1 km, sent to MET
    Norway) — App Functionality.

## Permissions to justify

- Location (when in use): prayer times and qibla for the user's city.
- Notifications: adhan and reminders the user turns on.
- Exact alarms / time-sensitive notifications: adhan at the exact prayer time.
- Foreground service (media playback): recitation keeps playing with the screen off.
- Activity recognition / Motion & Fitness: counting steps on the way to the mosque, on request only;
  stays on the device.
- Do Not Disturb access (Android, ACCESS_NOTIFICATION_POLICY): the optional «صامت في المسجد»
  switches Do Not Disturb on around the prayers the user chooses.
- Calendar (READ_CALENDAR / WRITE_CALENDAR, NSCalendarsFullAccessUsageDescription): «الصلاة في
  تقويمك» writes prayer times into a calendar the app creates, and reads the coming week's
  appointments on the device to show those that cover a prayer. Only on request; nothing is sent.
