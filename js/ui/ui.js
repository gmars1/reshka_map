export class UIManager {
    #statusEl; #logEl; #panelBody; #toggleBtn; #legendEl; #arrow; #legendBody;
    #map; #markers; #seasonMarkers = new Map();
    #seasonVisibility = new Map();
    #seasonColors = [];

    constructor() {
        // Инициализация элементов
        this.#statusEl = document.getElementById("status");
        this.#logEl = document.getElementById("log");
        this.#panelBody = document.getElementById("panelBody");
        this.#toggleBtn = document.getElementById("toggleBtn");
        this.#legendEl = document.getElementById("legend");
        this.#legendBody = document.getElementById("legendBody");
        this.#arrow = document.querySelector('.arrow-icon');

        this.#generateSeasonColors(30, 20);

        this.#map = L.map("map").setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(this.#map);
        this.#markers = L.featureGroup().addTo(this.#map);

        this.#initToggle();
    }

    #generateSeasonColors(totalSeasons, maxShades) {
        const start = { r: 148, g: 0, b: 211 };
        const end = { r: 0, g: 128, b: 0 };
        for (let s = 0; s < totalSeasons; s++) {
            const t = s / (totalSeasons - 1);
            const base = {
                r: Math.round(start.r + t*(end.r - start.r)),
                g: Math.round(start.g + t*(end.g - start.g)),
                b: Math.round(start.b + t*(end.b - start.b))
            };
            const shades = [];
            for (let i = 0; i < maxShades; i++) {
                const f = i / (maxShades - 1);
                shades.push(`rgb(${Math.round(base.r + f*(255-base.r))},${Math.round(base.g + f*(255-base.g))},${Math.round(base.b + f*(255-base.b))})`);
            }
            this.#seasonColors.push(shades);
        }
    }

    #getColorByIndex(sIdx, eIdx) {
        const season = this.#seasonColors[sIdx - 1] || this.#seasonColors[0];
        return season[Math.min(eIdx, season.length - 1)];
    }

    #initToggle() {
        document.getElementById('panelHeader').addEventListener('click', () => {
            const isHidden = this.#panelBody.style.display === 'none';
            this.#panelBody.style.display = isHidden ? 'block' : 'none';
            this.#toggleBtn.innerText = isHidden ? '−' : '+';
        });
    }

    collapseLegend() {
        document.getElementById('legendHeader').addEventListener('click', () => {
            const isCollapsed = this.#legendEl.classList.toggle('collapsed');
            this.#legendBody.hidden = isCollapsed;
            this.#arrow.textContent = isCollapsed ? '▸' : '▾';
        });
    }

    updateStatus(text) { this.#statusEl.textContent = text; }
    
    addLog(msg, type) {
        const div = document.createElement('div');
        div.style.color = type === 'err' ? 'red' : 'inherit';
        div.textContent = msg;
        this.#logEl.prepend(div);
    }

    addMarker(coords, content, sIdx, sName, eIdx) {
        const color = this.#getColorByIndex(sIdx, eIdx);
        const marker = L.circleMarker(coords, {
            radius: 7, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1
        }).bindPopup(content);
        marker.addTo(this.#markers);
        if (!this.#seasonMarkers.has(sName)) this.#seasonMarkers.set(sName, []);
        this.#seasonMarkers.get(sName).push(marker);
        return marker;
    }

    fitMap() { if (this.#markers.getLayers().length) this.#map.fitBounds(this.#markers.getBounds()); }
    get markerCount() { return this.#markers.getLayers().length; }

    createLegend(seasons) {
        this.#legendBody.innerHTML = '';
        seasons.forEach((season, idx) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span style="width:12px;height:12px;background:${this.#getColorByIndex(idx+1, 0)};display:inline-block;margin-right:8px;border-radius:50%"></span>${season}`;
            this.#seasonVisibility.set(season, true);
            item.onclick = (e) => {
                e.stopPropagation();
                const visible = !this.#seasonVisibility.get(season);
                this.#seasonVisibility.set(season, visible);
                item.style.opacity = visible ? '1' : '0.3';
                this.#seasonMarkers.get(season)?.forEach(m => visible ? m.addTo(this.#map) : m.remove());
            };
            this.#legendBody.appendChild(item);
        });
    }
}