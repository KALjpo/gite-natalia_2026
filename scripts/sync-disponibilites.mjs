// Synchronise assets/data/disponibilites.json avec l'agenda Google du gîte.
//
// Chaque événement de l'agenda = une période où le gîte est occupé.
// Seules les dates sont recopiées : ni titre, ni description, ni nom de locataire.
//
// Usage :
//   AGENDA_ICAL_URL="https://calendar.google.com/calendar/ical/.../basic.ics" node scripts/sync-disponibilites.mjs
//   node scripts/sync-disponibilites.mjs agenda.ics      (test avec un fichier local)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUTPUT = fileURLToPath(new URL('../assets/data/disponibilites.json', import.meta.url));
const TIMEZONE = 'Europe/Paris';

const parisDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const parisTime = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

async function loadCalendar() {
  const file = process.argv[2];
  if (file) return readFile(file, 'utf8');

  const url = process.env.AGENDA_ICAL_URL;
  if (!url) throw new Error("Variable AGENDA_ICAL_URL absente : renseignez l'adresse secrète iCal de l'agenda.");

  const response = await fetch(url, { redirect: 'follow' });
  // L'adresse est secrète : on n'affiche que le code de retour.
  if (!response.ok) throw new Error(`Agenda inaccessible (HTTP ${response.status}).`);
  return response.text();
}

// Une valeur iCal (20261016, 20261016T140000, 20261016T140000Z) → { date: 'AAAA-MM-JJ', midnight }
function parseDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, utc] = m;
  if (h === undefined) return { date: `${y}-${mo}-${d}`, midnight: true };
  if (!utc) return { date: `${y}-${mo}-${d}`, midnight: h + mi + s === '000000' };
  const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return { date: parisDate.format(instant), midnight: parisTime.format(instant) === '00:00' };
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function parseEvents(ics) {
  // Les lignes longues sont repliées : une ligne commençant par un espace prolonge la précédente.
  const lines = ics.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (['DTSTART', 'DTEND', 'STATUS', 'RRULE'].includes(name)) current[name] = value;
  }
  return events;
}

function toReservations(events) {
  const today = parisDate.format(new Date());
  const seen = new Set();
  const reservations = [];
  let recurring = 0;

  for (const event of events) {
    if (event.STATUS === 'CANCELLED') continue;
    if (event.RRULE) recurring += 1;

    const start = parseDate(event.DTSTART ?? '');
    if (!start) continue;
    const end = parseDate(event.DTEND ?? '');

    const du = start.date;
    // 'au' = jour de départ, qui reste libre pour une nouvelle arrivée.
    let au = end ? end.date : addDays(du, 1);
    if (au <= du) au = addDays(du, 1);

    if (au <= today) continue; // séjour terminé
    const key = `${du}|${au}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reservations.push({ du, au });
  }

  if (recurring) console.warn(`Attention : ${recurring} événement(s) récurrent(s) — seule la première occurrence est prise en compte.`);
  return reservations.sort((a, b) => a.du.localeCompare(b.du) || a.au.localeCompare(b.au));
}

const ics = await loadCalendar();
if (!ics.includes('BEGIN:VCALENDAR')) throw new Error("La réponse n'est pas un agenda iCal : fichier des disponibilités laissé intact.");

const reservations = toReservations(parseEvents(ics));
const json = [
  '{',
  `  "_aide": "Fichier généré automatiquement depuis l'agenda Google du gîte (scripts/sync-disponibilites.mjs) : ne pas le modifier à la main. 'du' = jour d'arrivée, 'au' = jour de départ, qui reste libre pour une nouvelle arrivée.",`,
  '  "reservations": [',
  reservations.map((r) => `    { "du": "${r.du}", "au": "${r.au}" }`).join(',\n'),
  '  ]',
  '}',
  '',
].filter((line, i) => !(i === 3 && line === '')).join('\n');

await writeFile(OUTPUT, json, 'utf8');
console.log(`${reservations.length} période(s) occupée(s) à venir enregistrée(s).`);
