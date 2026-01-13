import { fetchWiki } from './js/externalApi.js'
import { parseWiki } from './js/funcs.js'
import { UIManager } from './js/ui.js';
import { getCoordiantes, translateLocation } from './js/funcs.js'


const uiManager = new UIManager();

init();

/* ==================== INIT ==================== */

async function init() {
    try {
        const wikiText = await fetchWiki();
        const episodes = parseWiki(wikiText);
        await plotEpisodes(episodes);
        uiManager.updateStatus(`✅ Точек на карте: ${uiManager.markerCount}`);
        uiManager.fitMap();
    } catch (e) {
        uiManager.updateStatus("❌ " + e.message);
        console.error(e);
    }
}




/* ==================== MAP PLOT ==================== */

async function plotEpisodes(episodes) {
    uiManager.updateStatus(`Найдено выпусков: ${episodes.length}`);

    for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        const en = translateLocation(ep.location);
        const coords = await getCoordiantes(en);
        await sleep(300);

        if (coords) {
            const idx = parseIndex(ep.idx);
            const content = `
            <div style="min-width:220px; line-height:1.45;">
                <div style="font-weight:600; font-size:15px;">
                    ${escapeHtml(ep.location)}
                </div>
                <div style="color:#665; font-size:12px; margin-bottom:6px;">
                    ${escapeHtml(en)}
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

            uiManager.addMarker(coords, content);
            uiManager.addLog(`✔ ${en}`, "ok");
        } else {
            uiManager.addLog(`✖ ${en}`, "err");
        }

        uiManager.updateStatus(`Обработано ${i + 1} / ${episodes.length}`);
    }
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


function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }



function parseIndex(idxRaw) {
    if (!idxRaw) return { overall: null, season: null };

    const m = idxRaw.match(/(\d+)(?:\s*\((\d+)\))?/);

    return {
        inSeason: m ? m[1] : null,
        overall: m && m[2] ? m[2] : m ? m[1] : null
    };
}



