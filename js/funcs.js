
import {geoTranslateDict, geoCoordDict} from './data.js'
import {getGeoCache, addGeoCache} from './cache.js'
import {fetchCoordiantes} from './externalApi.js'

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

                if (cells.length < 2) return;

                const idx = extractIndex(cells);
                const locations = extractLocations(cells);

                if (!idx || locations.length === 0) return;

                const episodeData = {
                    season,
                    idx,
                    location: locations.join("; "),
                    currency: cleanWiki(cells[2] || "—"),
                    goldCard: cleanWiki(cells[3] || "—"),
                    premiere: cleanWiki(cells[4] || "—")
                };

                episodes.push(episodeData);
            });
        });
    }
    return episodes;
}


function cleanWiki(str) {
    if (!str) return "";

    return str
        .replace(/\{\{[^}]+\}\}/g, "")                     // {{Флаг|...}}
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[A|B]] → B
        .replace(/\d+px/gi, "")                            // 25px
        .replace(/'''/g, "")                               // жирный
        .replace(/<[^>]+>/g, "")                           // HTML
        .replace(/\s{2,}/g, " ")
        .trim();
}


function extractIndex(cells) {
    const bold = cells.join(" ").match(/'''([^']+)'''/);
    if (bold) return bold[1].trim();

    const fallback = cells[0].match(/\d+\s*\(\d+\)/);
    return fallback ? fallback[0] : null;
}


function extractLocations(cells) {
    const out = [];

    cells.slice(1).forEach(cell => {
        // Флаги
        const flags = [...cell.matchAll(/\{\{[Фф]лаг\|([^}|]+)/g)]
            .map(m => m[1].trim());

        // Ссылки
        const names = [...cell.matchAll(/\[\[([^\]]+)\]\]/g)]
            .map(m => {
                const content = m[1];
                return content.includes("|")
                    ? content.split("|").pop().trim()
                    : content.trim();
            })
            .filter(name =>
                name.length > 1 &&
                !/^(Файл|File|Image|Категория):/i.test(name) &&
                !/\.(svg|png|jpg)$/i.test(name)
            );

        if (!names.length) return;

        let city = names[names.length - 1];
        let country = flags[0] || (names.length > 1 ? names[0] : null);

        city = city.replace(/\s*\(.+?\)$/, "");

        const label = country && country !== city
            ? `${country}: ${city}`
            : city;

        if (!out.includes(label)) out.push(label);
    });

    return out;
}



//-------

let networkQueue = Promise.resolve();

export async function getCoordiantes(name) {
    const key = "geo_" + name;
    const cached = geoCoordDict[key] || getGeoCache(key);
    if (cached) return cached;

    networkQueue = networkQueue.then(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
        return await fetchCoordiantes(name);
    });

    return await networkQueue;
}



export function translateLocation(ru) {
    return ru.split(";").map(part =>
        part.split(/[:\/]/).map(p =>
            geoTranslateDict.countries[p.trim()] ||
            geoTranslateDict.cities[p.trim()] ||
            p.trim()
        ).join(", ")
    ).join(" | ");
}
