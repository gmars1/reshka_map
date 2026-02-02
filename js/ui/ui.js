export class UIManager {
    // =================== Элементы DOM ===================
    #statusEl = document.getElementById("status");
    #logEl = document.getElementById("log");
    #panelBody = document.getElementById("panelBody");
    #toggleBtn = document.getElementById("toggleBtn");
    #legendEl = document.getElementById("legend");

    #arrow = document.getElementById('legendArrow');


    // =================== Карта и маркеры ===================
    #map;
    #markers;
    #seasonMarkers = new Map(); // { сезон: [маркер1, маркер2] }

    // =================== Легенда ===================
    #seasonVisibility = new Map(); // { сезон: видимость }

    // =================== Градиент ===================
    #colors = [];

    constructor() {
        this.#generateSeasonColors();

        // Инициализация карты
        this.#map = L.map("map").setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(this.#map);

        this.#markers = L.featureGroup().addTo(this.#map);

        this.#initToggle();
    }

    // =================== Градиент ===================
    #seasonColors = new Map(); // цвета по сезонам

    #generateSeasonColors(totalSeasons = 28, maxShades = 20) {
        // totalSeasons = 28, maxShades = максимально оттенков в сезоне
        this.#seasonColors = []; // массив сезонов, внутри – массив оттенков

        const start = { r: 148, g: 0, b: 211 }; // фиолет
        const end   = { r: 0, g: 128, b: 0 };   // зелёный

        for (let s = 0; s < totalSeasons; s++) {
            const t = s / (totalSeasons - 1);
            // базовый цвет сезона
            const baseR = Math.round(start.r + t*(end.r - start.r));
            const baseG = Math.round(start.g + t*(end.g - start.g));
            const baseB = Math.round(start.b + t*(end.b - start.b));

            // создаём градации для серий сезона
            const shades = [];
            for (let i = 0; i < maxShades; i++) {
                const f = i / (maxShades - 1);
                // интерполяция к белому для светлых оттенков
                const r = Math.round(baseR + f*(255 - baseR));
                const g = Math.round(baseG + f*(255 - baseG));
                const b = Math.round(baseB + f*(255 - baseB));
                shades.push(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
            }
            this.#seasonColors.push(shades);
        }
    }

    // Получение цвета: указываем сезон и индекс выпуска внутри сезона
    #getColorByIndex(seasonIndex, seriesIndex = 0) {
        const shades = this.#seasonColors[seasonIndex-1];
        if (!shades) return "#000000"; // fallback
        const idx = Math.min(seriesIndex-1, shades.length - 1);
        return shades[idx];
    }

    // =================== Панель ===================
    #initToggle() {
        const header = document.getElementById('panelHeader');
        if (header) {
            header.addEventListener('click', () => this.togglePanel());
        }
    }

    togglePanel() {
        const isHidden = this.#panelBody.style.display === 'none';
        this.#panelBody.style.display = isHidden ? 'block' : 'none';
        this.#toggleBtn.innerText = isHidden ? '−' : '+';
    }

    collapseLegend() {
        this.#legendEl.querySelector('.legend-header').addEventListener('click', () => {
            this.#legendEl.classList.toggle('collapsed');
            this.#arrow.textContent =
                this.#legendEl.classList.contains('collapsed') ? '▸' : '▾';
        });
    }

    // =================== Статус и логи ===================
    updateStatus(text) {
        this.#statusEl.textContent = text;
    }

    addLog(msg, type) {
        const div = document.createElement('div');
        div.className = type;
        div.textContent = msg;
        this.#logEl.prepend(div);
    }

    // =================== Маркеры ===================
    addMarker(coords, popupContent, seasonIndex, seasonName, videoIndex) {
        const color = this.#getColorByIndex(seasonIndex, videoIndex);

        const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="
                background:${color};
                width:14px;
                height:14px;
                border-radius:50%;
                border:2px solid white;
            "></div>`,
            iconSize: [14,14],
            iconAnchor: [7,7]
        });

        const marker = L.marker(coords, {icon}).bindPopup(popupContent);

        // Добавляем маркер в общий слой карты
        marker.addTo(this.#markers);

        // Сохраняем по сезону
        if (!this.#seasonMarkers.has(seasonName)) this.#seasonMarkers.set(seasonName, []);
        this.#seasonMarkers.get(seasonName).push(marker);

        return marker;
    }

    fitMap() {
        if (this.#markers.getLayers().length) {
            this.#map.fitBounds(this.#markers.getBounds().pad(0.15));
        }
    }

    get markerCount() {
        return this.#markers.getLayers().length;
    }

    // =================== Фильтр ===================
    filterSeason(season, show = true) {
        const markers = this.#seasonMarkers.get(season);
        if (!markers) return;

        markers.forEach(marker => {
            if (show && !this.#map.hasLayer(marker)) {
                marker.addTo(this.#map);
            } else if (!show && this.#map.hasLayer(marker)) {
                this.#map.removeLayer(marker);
            }
        });
    }

    // =================== Легенда ===================
    createLegend(seasons) {
        if (!this.#legendEl) return;
        this.#legendEl.innerHTML = '';

        // ================== Кнопки управления ==================
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.justifyContent = 'space-between';
        controlsDiv.style.marginBottom = '8px';

        const btnShowAll = document.createElement('button');
        btnShowAll.textContent = 'Вкл все';
        btnShowAll.style.flex = '1';
        btnShowAll.style.marginRight = '4px';
        btnShowAll.style.cursor = 'pointer';
        btnShowAll.addEventListener('click', () => {
            seasons.forEach(season => {
                this.#seasonVisibility.set(season, true);
                this.filterSeason(season, true);

                // обновляем прозрачность в легенде
                const div = this.#legendEl.querySelector(`.legend-item[data-season='${season}']`);
                if (div) div.style.opacity = '1';
            });
        });

        const btnHideAll = document.createElement('button');
        btnHideAll.textContent = 'Выкл все';
        btnHideAll.style.flex = '1';
        btnHideAll.style.marginLeft = '4px';
        btnHideAll.style.cursor = 'pointer';
        btnHideAll.addEventListener('click', () => {
            seasons.forEach(season => {
                this.#seasonVisibility.set(season, false);
                this.filterSeason(season, false);

                const div = this.#legendEl.querySelector(`.legend-item[data-season='${season}']`);
                if (div) div.style.opacity = '0.4';
            });
        });

        controlsDiv.appendChild(btnShowAll);
        controlsDiv.appendChild(btnHideAll);
        this.#legendEl.appendChild(controlsDiv);
        
        // ================== Сезоны ==================
        let idx = 1;
        seasons.forEach(season => {
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.dataset.season = season; // для кнопок
            div.style.cursor = 'pointer';
            div.style.marginBottom = '4px';

            const colorBox = document.createElement('span');
            colorBox.style.display = 'inline-block';
            colorBox.style.width = '16px';
            colorBox.style.height = '16px';
            colorBox.style.background = this.#getColorByIndex(idx, 1);
            idx+=1;
            colorBox.style.border = '1px solid #000';
            colorBox.style.marginRight = '6px';

            div.appendChild(colorBox);
            div.appendChild(document.createTextNode(`${season}`));

            // Изначально все сезоны видимы
            this.#seasonVisibility.set(season, true);

            div.addEventListener('click', () => {
                const visible = !this.#seasonVisibility.get(season);
                this.#seasonVisibility.set(season, visible);

                this.filterSeason(season, visible);
                div.style.opacity = visible ? '1' : '0.4';
            });

            this.#legendEl.appendChild(div);
        });
    }
}