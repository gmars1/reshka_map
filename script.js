import { geoDict, coordDict } from './data.js';




init();

/* ==================== INIT ==================== */

async function init() {
    try {
        const wikiText = await fetchWiki();
        const episodes = parseWiki(wikiText);
        await plotEpisodes(episodes);
        statusEl.textContent = `✅ Точек на карте: ${markers.getLayers().length}`;
        if (markers.getLayers().length) {
            map.fitBounds(markers.getBounds().pad(0.15));
        }
    } catch (e) {
        statusEl.textContent = "❌ " + e.message;
        console.error(e);
    }
}




/* ==================== MAP PLOT ==================== */

async function plotEpisodes(episodes) {
    statusEl.textContent = `Найдено выпусков: ${episodes.length}`;

    for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        const en = translateLocation(ep.location);
        const coords = await geocode(en);

        if (coords) {
            L.marker(coords)
                .bindPopup(`<b>${ep.idx}</b><br>${ep.location}<br><i>${en}</i>`)
                .addTo(markers);

            log(`✔ ${en}`, "ok");
        } else {
            log(`✖ ${en}`, "err");
        }

        statusEl.textContent = `Обработано ${i + 1} / ${episodes.length}`;
        if (!localStorage.getItem("geo_" + en)) {
            await sleep(1000);
        }
    }
}




