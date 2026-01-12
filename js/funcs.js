
import {geoTranslateDict, geoCoordDict} from './data.js'
import {getGeoCache, addGeoCache} from './cache.js'
import {fetchCoordiantes} from './exterenalApi.js'

// ------------



export function parseWiki(text) {
    const episodes = [];
    const blocks = text.split(/^===\s*(.+?)\s*===/m);

    for (let i = 1; i < blocks.length; i += 2) {
        const season = blocks[i].trim();
        const content = blocks[i + 1];
        if (!content) continue;

        const tables = content.match(/\{\|[\s\S]*?\|\}/g) || [];
        tables.forEach(table => {
            table.split(/\n\|-/).forEach(row => {
                const clean = row.trim();
                if (!clean || clean.startsWith("!") || clean.includes("|}")) return;

                const cells = clean
                    .split(/\|\||(?<=\n)\|/)
                    .map(c => c.trim())
                    .filter(Boolean);

                const idx = this.#extractIndex(cells);
                if (!idx) return;

                const locations = this.#extractLocations(cells);
                if (!locations.length) return;

                episodes.push({
                    season,
                    idx,
                    location: locations.join("; ")
                });
            });
        });
    }
    return episodes;
}


function extractIndex(cells) {
    const bold = cells.join(" ").match(/'''([^']+)'''/);
    if (bold) return bold[1].trim();
    const fallback = cells[0].match(/\d+[\d\s()]+/);
    return fallback ? fallback[0].trim() : null;
}


function extractLocations(cells) {
    const out = [];

    cells.forEach(cell => {
        const flags = [...cell.matchAll(/\{\{[Фф]лаг\|([^}|]+)/g)]
            .map(m => m[1].trim());

        const links = cell.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g) || [];
        const names = links
            .map(l => l.replace(/[\[\]]/g, "").split("|").pop().trim())
            .filter(n =>
                n.length > 1 &&
                !/^(Файл|File|Image|Категория):/i.test(n) &&
                !/px/i.test(n)
            );

        if (!names.length) return;

        const city = names[0];
        const countries = flags.filter(f => f.toLowerCase() !== city.toLowerCase());
        const prefix = [...new Set(countries)].join("/");

        const label = prefix ? `${prefix}: ${city}` : city;
        if (!out.includes(label)) out.push(label);
    });

    return out;
}



//-------


export async function getCoordiantes(ruName) {
    const name = translateLocation(ruName);
    const key = "geo_" + name;
    const cached = geoCoordDict.getItem(key) || getGeoCache(key);
    if (cached) return JSON.parse(cached);

    return fetchAndSetToCache(name);
}

function fetchAndSetToCache(name) {
    const r = fetchCoordiantes(name);
    addGeoCache(name, r);
    return r;
}



function translateLocation(ru) {
    return ru.split(";").map(part =>
        part.split(/[:\/]/).map(p =>
            geoTranslateDict.countries[p.trim()] ||
            geoTranslateDict.cities[p.trim()] ||
            p.trim()
        ).join(", ")
    ).join(" | ");
}