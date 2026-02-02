export class UIManager {
    #statusEl; #logEl; #panelBody; #toggleBtn; #legendEl; #arrow; #legendBody;
    #map; #markers; #seasonMarkers = new Map();
    #seasonVisibility = new Map();
    #seasonColors = [];
    #seasonColorMap = new Map(); // { "Сезон 1": 1, "Сезон 5": 2 }
    #nextColorIndex = 1;

    constructor() {
        this.#statusEl = document.getElementById("status");
        this.#logEl = document.getElementById("log");
        this.#panelBody = document.getElementById("panelBody");
        this.#toggleBtn = document.getElementById("toggleBtn");
        this.#legendEl = document.getElementById("legend");
        this.#legendBody = document.getElementById("legendBody");
        this.#arrow = document.querySelector('.arrow-icon');

        this.#generateSeasonColors(36, 40);

        this.#map = L.map("map").setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© OpenStreetMap'
        }).addTo(this.#map);
        
        this.#markers = L.featureGroup().addTo(this.#map);

        this.#initToggle();
    }

    // Метод фильтрации, который отсутствовал!
    filterSeason(seasonName, show = true) {
        const markers = this.#seasonMarkers.get(seasonName);
        if (!markers) return;

        markers.forEach(marker => {
            if (show) {
                if (!this.#map.hasLayer(marker)) marker.addTo(this.#map);
            } else {
                if (this.#map.hasLayer(marker)) marker.remove();
            }
        });
    }

    #generateSeasonColors(totalSeasons, maxShades) {
        const start = { r: 148, g: 0, b: 211 };
        const end = { r: 0, g: 128, b: 0 };
        for (let s = 0; s < totalSeasons; s++) {
            const t = s / (totalSeasons - 1);
            const base = {
                r: Math.round(start.r + t * (end.r - start.r)),
                g: Math.round(start.g + t * (end.g - start.g)),
                b: Math.round(start.b + t * (end.b - start.b))
            };
            const shades = [];
            for (let i = 0; i < maxShades; i++) {
                const f = i / (maxShades - 1);
                shades.push(`rgb(${Math.round(base.r + f * (255 - base.r))},${Math.round(base.g + f * (255 - base.g))},${Math.round(base.b + f * (255 - base.b))})`);
            }
            this.#seasonColors.push(shades);
        }
    }

    #getColorByIndex(sIdx, eIdx) {
        const season = this.#seasonColors[sIdx - 1] || this.#seasonColors[0];
        return season[Math.min(eIdx || 0, season.length - 1)];
    }

    #initToggle() {
        const header = document.getElementById('panelHeader');
        const panelEl = document.getElementById('mainPanel');

        if (header && panelEl) {
            header.addEventListener('click', () => {
                // Только переключаем класс, высоту считает CSS
                panelEl.classList.toggle('collapsed');
                
                if (this.#toggleBtn) {
                    const isCollapsed = panelEl.classList.contains('collapsed');
                    this.#toggleBtn.innerText = isCollapsed ? '+' : '−';
                }
            });
        }
    }

    collapseLegend() {
        const header = document.getElementById('legendHeader');
        if (header) {
            header.addEventListener('click', () => {
                const isCollapsed = this.#legendEl.classList.toggle('collapsed');
                this.#legendBody.hidden = isCollapsed;
                if (this.#arrow) {
                    this.#arrow.textContent = isCollapsed ? '▸' : '▾';
                }
            });
        }
    }

    setLegendState(open = true) {
        const isCollapsed = !open;
        this.#legendEl.classList.toggle('collapsed', isCollapsed);
        this.#legendBody.hidden = isCollapsed;
        if (this.#arrow) {
            this.#arrow.textContent = isCollapsed ? '▸' : '▾';
        }
    }

    updateStatus(text) { if (this.#statusEl) this.#statusEl.textContent = text; }
    
    addLog(msg, type) {
        if (!this.#logEl) return;
        const div = document.createElement('div');
        div.style.color = type === 'err' ? 'red' : 'inherit';
        div.textContent = msg;
        this.#logEl.prepend(div);
    }

    addMarker(coords, content, seasonName, eIdx) {
        // Если этот сезон видим впервые, назначаем ему следующий свободный индекс цвета
        if (!this.#seasonColorMap.has(seasonName)) {
            this.#seasonColorMap.set(seasonName, this.#nextColorIndex++);
        }
        
        const sIdx = this.#seasonColorMap.get(seasonName);
        const color = this.#getColorByIndex(sIdx, eIdx);

        const marker = L.circleMarker(coords, {
            radius: 7, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1
        }).bindPopup(content);
        
        marker.addTo(this.#markers);
        if (!this.#seasonMarkers.has(seasonName)) this.#seasonMarkers.set(seasonName, []);
        this.#seasonMarkers.get(seasonName).push(marker);
        return marker;
    }

    fitMap() { if (this.#markers.getLayers().length) this.#map.fitBounds(this.#markers.getBounds().pad(0.1)); }
    get markerCount() { return this.#markers.getLayers().length; }

    createLegend(seasons) {
        if (!this.#legendBody) return;
        this.#legendBody.innerHTML = '';

        // (Тут код кнопок управления остается прежним...)
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:12px; gap:8px;';
        const createControlBtn = (text, isShow) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = 'flex:1; cursor:pointer; padding:4px; font-size:11px; border:1px solid #ccc; border-radius:4px; background:#f0f0f0;';
            btn.onclick = (e) => {
                e.stopPropagation();
                seasons.forEach(s => {
                    this.#seasonVisibility.set(s, isShow);
                    this.filterSeason(s, isShow);
                    const item = this.#legendBody.querySelector(`.legend-item[data-season="${s}"]`);
                    if (item) item.style.opacity = isShow ? '1' : '0.3';
                });
            };
            return btn;
        };
        controlsDiv.appendChild(createControlBtn('Вкл все', true));
        controlsDiv.appendChild(createControlBtn('Выкл все', false));
        this.#legendBody.appendChild(controlsDiv);

        // Список сезонов
        seasons.forEach((seasonName) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.setAttribute('data-season', seasonName);
            item.style.cssText = 'display:flex; align-items:center; margin-bottom:6px; cursor:pointer; transition:opacity 0.2s;';
            
            // Получаем индекс цвета из той же карты, что использовали маркеры
            const colorIndex = this.#seasonColorMap.get(seasonName) || 1;
            const color = this.#getColorByIndex(colorIndex, 0);
            
            item.innerHTML = `
                <span style="width:12px; height:12px; background:${color}; display:inline-block; margin-right:8px; border-radius:50%; border:1px solid rgba(0,0,0,0.2)"></span>
                <span style="flex:1; font-size: 13px;">${seasonName}</span>
            `;

            this.#seasonVisibility.set(seasonName, true);
            item.onclick = (e) => {
                e.stopPropagation();
                const visible = !this.#seasonVisibility.get(seasonName);
                this.#seasonVisibility.set(seasonName, visible);
                item.style.opacity = visible ? '1' : '0.3';
                this.filterSeason(seasonName, visible);
            };
            this.#legendBody.appendChild(item);
        });
    }
}