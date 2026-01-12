import { fetchWiki } from './js/externalApi.js'
import { parseWiki } from './js/funcs.js'
import { UIManager } from './js/ui.js';
import { getCoordiantes } from './js/funcs.js'


const uiManager = new UIManager();
init();

/* ==================== INIT ==================== */

async function init() {
    try {
        const wikiText = await fetchWiki();
        const episodes = parseWiki(wikiText);
        await plotEpisodes(episodes);
        uiManager.updateStatus(`✅ Точек на карте: ${markers.getLayers().length}`);
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
        const coords = await getCoordiantes(ep.location);
        await sleep(1000);

        if (coords) {
            uiManager.addMarker(coords, `<b>${ep.idx}</b><br>${ep.location}<br><i>${en}</i>`);
            uiManager.addLog(`✔ ${en}`, "ok");
        } else {
            uiManager.addLog(`✖ ${en}`, "err");
        }

        uiManager.updateStatus(`Обработано ${i + 1} / ${episodes.length}`);
    }
}




