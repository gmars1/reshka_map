import { fetchWiki } from './js/infra/wiki_fetchVideos.js';
import { parseWiki, getCoordiantes } from './js/services/funcs.js';
import { UIManager } from './js/ui/ui.js';

const uiManager = new UIManager();
init();

async function init() {
    try {
        const wikiText = await fetchWiki();
        const episodes = parseWiki(wikiText);

        await plotEpisodes(episodes);

        // статус и авто-подстройка карты
        uiManager.updateStatus(`✅ Точек на карте: ${uiManager.markerCount}`);
        uiManager.fitMap();

        // создаём легенду
        const uniqueSeasons = [...new Set(episodes.map(ep => ep.season))];
        uiManager.createLegend(uniqueSeasons);
        uiManager.collapseLegend();

    } catch (e) {
        uiManager.updateStatus("❌ " + e.message);
        console.error(e);
    }
}

async function plotEpisodes(episodes) {
    uiManager.updateStatus(`Найдено выпусков: ${episodes.length}`);

    for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];

        try {
            const coords = await getCoordiantes(ep.location);
            if (!coords) {
                uiManager.addLog(`✖ ${ep.location}`, "err");
                continue;
            }

            const idx = parseIndex(ep.idx);
            const content = `
                <div style="min-width:220px; line-height:1.45;">
                    <div style="font-weight:600; font-size:15px;">
                        ${escapeHtml(ep.location)}
                    </div>
                    <hr style="margin:6px 0">
                    <div style="font-size:12px; color:#444;">
                        <b>Сезон:</b> ${escapeHtml(ep.season)}<br>
                        <b>Серия:</b> ${escapeHtml(idx.inSeason)}
                    </div>
                    <hr style="margin:6px 0">
                    <div style="font-size:12px;">
                        📺 <b>Выпуск:</b> ${escapeHtml(idx.overall)}<br>
                        🎙 <b>Ведущие:</b> ${escapeHtml(ep.hosts)}<br>
                        💳 <b>Карта:</b> ${escapeHtml(ep.goldCard)}<br>
                        💰 <b>Валюта:</b> ${escapeHtml(ep.currency)}<br>
                        📅 <b>Премьера:</b> ${escapeHtml(ep.premiere)}
                    </div>
                </div>
            `;

            const season = parseSeason(ep.season);
            uiManager.addMarker(coords, content, season, escapeHtml(ep.season), escapeHtml(idx.inSeason));

        } catch (e) {
            console.error("Episode failed:", ep.location, e);
            uiManager.addLog(`🔥 ${ep.location}`, "err");
        }

        uiManager.updateStatus(`Обработано ${i + 1} / ${episodes.length}`);
    }
}

/* ==================== HELPERS ==================== */
function parseSeason(str) { //todo
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : null;
}

function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[m]);
}

function parseIndex(idxRaw) {
    if (!idxRaw) return { overall: null, season: null };
    const m = idxRaw.match(/(\d+)(?:\s*\((\d+)\))?/);
    return {
        inSeason: m ? m[1] : null,
        overall: m && m[2] ? m[2] : m ? m[1] : null
    };
}