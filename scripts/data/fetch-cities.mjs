// City list for manual location selection: GeoNames «cities15000» (CC BY 4.0) with
// coordinates and IANA time zones. Keeps every city of 50k+ people in Arabic-speaking
// and Muslim-majority countries and 300k+ elsewhere, with Arabic names where available.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assert, fetchBuffer, log, writeJson } from './lib.mjs';

const URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const PRIORITY = new Set(
  ('SA AE KW QA BH OM YE IQ JO SY LB PS EG SD LY TN DZ MA MR SO DJ KM TR IR PK AF BD ID MY ' +
    'BN MV NG SN ML NE TD GM GN SL BF UZ TJ KG TM KZ AZ AL XK BA')
    .split(' '),
);
// Customary Arabic names for the two holy cities.
const NAME_OVERRIDES = { 104515: 'مكة المكرمة', 109223: 'المدينة المنورة' };
const PERSIAN_ONLY = /[پچژگکیۀ]/;
const ARABIC_ONLY = /^[ء-ي٠-٩\s\-]+$/;

async function main() {
  const zip = await fetchBuffer(URL);
  const dir = mkdtempSync(join(tmpdir(), 'cities-'));
  const file = join(dir, 'cities.zip');
  writeFileSync(file, zip);
  const tsv = execFileSync('unzip', ['-p', file, 'cities15000.txt'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const countryNames = new Intl.DisplayNames(['ar'], { type: 'region' });

  const cities = [];
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const [id, name, , alternates, lat, lng] = f;
    const country = f[8];
    const population = Number(f[14]);
    const timezone = f[17];
    const min = PRIORITY.has(country) ? 50_000 : 300_000;
    if (population < min || !timezone) continue;
    const arabic = alternates
      .split(',')
      .find((a) => ARABIC_ONLY.test(a) && !PERSIAN_ONLY.test(a));
    cities.push({
      id: Number(id),
      name: NAME_OVERRIDES[Number(id)] ?? arabic ?? name,
      nameEn: name,
      country,
      countryName: countryNames.of(country) ?? country,
      lat: Number(Number(lat).toFixed(4)),
      lng: Number(Number(lng).toFixed(4)),
      timezone,
      population,
    });
  }
  cities.sort((a, b) => b.population - a.population);
  for (const must of ['Riyadh', 'Makkah', 'Madinah', 'Jeddah', 'Dammam', 'Cairo', 'Dubai', 'Kuwait City']) {
    assert(cities.some((c) => c.nameEn === must), `${must} missing from city list`);
  }
  const r = writeJson('cities/cities.json', {
    source: 'GeoNames cities15000 — https://www.geonames.org (CC BY 4.0)',
    cities,
  });
  log('cities', cities.length, 'with Arabic name', cities.filter((c) => c.name !== c.nameEn).length, r.bytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
