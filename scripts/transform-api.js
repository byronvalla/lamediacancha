/**
 * transform-api.js
 * Converts API-Football raw JSON → site's data format
 * Output: data/partidos.json and data/standings.json
 */

const fs = require("fs");
const path = require("path");

// ── Team name normalization (matches TMAP in index.html) ──
const TMAP = {
  "Colo-Colo": "Colo Colo",
  "Club Universidad de Chile": "Universidad de Chile",
  "Universidad de Chile": "Universidad de Chile",
  "CD Universidad Católica": "Universidad Católica",
  "Universidad Católica": "Universidad Católica",
  "Ñublense": "Ñublense",
  "CD Huachipato": "Huachipato",
  "Huachipato": "Huachipato",
  "Audax Italiano": "Audax Italiano",
  "Audax Club Sportivo Italiano": "Audax Italiano",
  "Unión La Calera": "Unión La Calera",
  "Union La Calera": "Unión La Calera",
  "Everton de Viña del Mar": "Everton",
  "Everton": "Everton",
  "Cobresal": "Cobresal",
  "O'Higgins": "O'Higgins",
  "O\u2019Higgins": "O'Higgins",
  "Palestino": "Palestino",
  "Coquimbo Unido": "Coquimbo Unido",
  "Deportes La Serena": "Deportes La Serena",
  "Deportes Limache": "Deportes Limache",
  "Deportes Concepción": "Deportes Concepción",
  "Deportes Concepcion": "Deportes Concepción",
  "Universidad de Concepción": "U. de Concepción",
  "U. de Concepción": "U. de Concepción",
  "Cobreloa": "Cobreloa",
  "Deportes Recoleta": "Deportes Recoleta",
  "Deportes Puerto Montt": "Deportes Puerto Montt",
  "Unión Española": "Unión Española",
  "Deportes Iquique": "Deportes Iquique",
  "Curicó Unido": "Curicó Unido",
  "Deportes Temuco": "Deportes Temuco",
  "Magallanes": "Magallanes",
  "Santiago Wanderers": "Santiago Wanderers",
  "Deportes Antofagasta": "Deportes Antofagasta",
  "San Marcos de Arica": "San Marcos de Arica",
  "Unión San Felipe": "Unión San Felipe",
  "Rangers de Talca": "Rangers de Talca",
  "San Luis de Quillota": "San Luis de Quillota",
  "Deportes Copiapó": "Deportes Copiapó",
  "Deportes Santa Cruz": "Deportes Santa Cruz",
};

function nn(raw) {
  if (!raw) return "";
  if (TMAP[raw]) return TMAP[raw];
  const low = raw.toLowerCase();
  for (const k in TMAP) {
    if (k.toLowerCase() === low) return TMAP[k];
    if (low.includes(k.toLowerCase()) || k.toLowerCase().includes(low)) return TMAP[k];
  }
  return raw;
}

function fmtDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]}`;
}

function fmtHour(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  // Convert UTC to Chile time (UTC-3 or UTC-4)
  const chileOffset = -3;
  const local = new Date(d.getTime() + chileOffset * 3600000);
  return `${String(local.getUTCHours()).padStart(2,"0")}:${String(local.getUTCMinutes()).padStart(2,"0")}`;
}

function transformFixtures(rawFile, liga) {
  if (!fs.existsSync(rawFile)) return [];
  let raw;
  try { raw = JSON.parse(fs.readFileSync(rawFile, "utf8")); } catch (e) { return []; }
  const fixtures = raw.response || [];

  return fixtures.map(f => {
    const s = f.fixture.status.short;
    const isLive = ["1H","2H","HT","ET","P"].includes(s);
    const isFin  = ["FT","AET","PEN"].includes(s);
    const status = isLive ? "live" : isFin ? "fin" : "prog";
    const home = nn(f.teams.home.name);
    const away = nn(f.teams.away.name);
    const obj = {
      home, away, status, liga,
      fecha: fmtDate(f.fixture.date),
      hora:  fmtHour(f.fixture.date),
      _homeLogo: f.teams.home.logo || "",
      _awayLogo: f.teams.away.logo || "",
    };
    if (status === "live" || status === "fin") {
      obj.hs  = f.goals.home  !== null ? String(f.goals.home)  : "";
      obj.as_ = f.goals.away !== null ? String(f.goals.away) : "";
    }
    if (status === "live" && f.fixture.status.elapsed) {
      obj.min = String(f.fixture.status.elapsed);
    }
    return obj;
  }).filter(m => m.home && m.away);
}

// ── Build partidos.json ──
const primera  = transformFixtures("data/raw_primera.json",  "Primera División");
const primerab = transformFixtures("data/raw_primerab.json", "Primera B");

// Sort: live first, then by date desc
const all = [...primera, ...primerab].sort((a, b) => {
  if (a.status === "live" && b.status !== "live") return -1;
  if (b.status === "live" && a.status !== "live") return  1;
  return 0;
});

fs.writeFileSync(
  "data/partidos.json",
  JSON.stringify({ updated: new Date().toISOString(), partidos: all }, null, 2),
  "utf8"
);

// ── Build standings.json from raw_primera.json (standings endpoint would need separate call) ──
// For now just write an empty placeholder — standings come from a separate fetchStandings call
if (!fs.existsSync("data/standings.json")) {
  fs.writeFileSync("data/standings.json", JSON.stringify({ updated: "", primera: [], primerab: [] }), "utf8");
}

console.log(`✓ partidos.json: ${all.length} matches (${primera.length} Primera + ${primerab.length} Primera B)`);
console.log(`  Live: ${all.filter(m => m.status==="live").length}`);
console.log(`  Finished: ${all.filter(m => m.status==="fin").length}`);
console.log(`  Scheduled: ${all.filter(m => m.status==="prog").length}`);
