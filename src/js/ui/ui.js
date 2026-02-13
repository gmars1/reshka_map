export class UIManager {
    #map;
    #markers;
    #seasonMarkers = new Map();
    #seasonVisibility = new Map();
    #seasonColors = [];
    #seasonColorMap = new Map();
    #nextColorIndex = 1;
    #coordsRegistry = new Map();
    #isMobile;
    #markerData = new Map();
    #allMarkers = [];
    #highlightedMarkers = new Set();

    constructor() {
        this.#isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
        this.#generateSeasonColors(36, 50);

        this.#map = L.map("map", {
            zoomControl: false
        }).setView([20, 0], 2);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© OpenStreetMap',
            maxZoom: 18
        }).addTo(this.#map);

        this.#markers = L.featureGroup().addTo(this.#map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.#map);

        this.#map.attributionControl.addAttribution('Данные: Википедия | CC BY-SA 4.0');

        this.#initializeElements();
        this.#initializeEventListeners();
        this.#initializeBottomSheet();
        this.#initializeResponsiveHandlers();
    }

    #initializeElements() {
    }

    #initializeEventListeners() {
        // Desktop: Season panel toggle
        const seasonsHeader = document.getElementById('seasonsHeader');
        if (seasonsHeader) {
            seasonsHeader.addEventListener('click', () => {
                const panel = document.getElementById('seasonsPanel');
                panel?.classList.toggle('expanded');
            });
        }

        // Desktop: Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.#handleSearch(e.target.value, 'searchResults'));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.#handleSearch('', 'searchResults');
                    searchInput.blur();
                }
            });
        }

        // Mobile: Search input
        const sheetSearchInput = document.getElementById('sheetSearchInput');
        if (sheetSearchInput) {
            sheetSearchInput.addEventListener('input', (e) => this.#handleSearch(e.target.value, 'sheetSearchResults'));
            sheetSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    sheetSearchInput.value = '';
                    this.#handleSearch('', 'sheetSearchResults');
                    sheetSearchInput.blur();
                }
            });
        }

        // Season controls (both desktop and mobile)
        document.querySelectorAll('.seasons-controls').forEach(container => {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.seasons-btn');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const seasons = Array.from(this.#seasonVisibility.keys());
                
                if (action === 'showAll') {
                    seasons.forEach(s => this.#setSeasonVisibility(s, true));
                } else if (action === 'hideAll') {
                    seasons.forEach(s => this.#setSeasonVisibility(s, false));
                }
            });
        });

        // License toggle
        const licenseToggle = document.getElementById('licenseToggle');
        const licenseExpanded = document.getElementById('licenseExpanded');
        if (licenseToggle && licenseExpanded) {
            licenseToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                licenseExpanded.classList.toggle('visible');
            });
            
            document.addEventListener('click', (e) => {
                if (!licenseExpanded.contains(e.target) && e.target !== licenseToggle) {
                    licenseExpanded.classList.remove('visible');
                }
            });
        }
    }

    #initializeBottomSheet() {
        const sheet = document.getElementById('bottomSheet');
        const handle = document.getElementById('bottomSheetHandle');
        const tabs = document.getElementById('bottomSheetTabs');
        
        if (!sheet || !handle || !tabs) return;

        // Tab switching
        tabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.sheet-tab');
            if (!tab) return;
            
            // Expand sheet when tab clicked
            if (!sheet.classList.contains('expanded')) {
                sheet.classList.add('expanded');
            }
            
            tabs.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.sheet-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`sheet${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
        });

        // Handle tap to toggle
        handle.addEventListener('click', () => {
            sheet.classList.toggle('expanded');
            this.#updateLicensePosition();
        });

        // Drag to expand/collapse
        let startY = 0;
        let startExpanded = false;

        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startExpanded = sheet.classList.contains('expanded');
            sheet.style.transition = 'none';
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            const diff = startY - currentY;
            
            if (diff > 30 && !startExpanded) {
                sheet.classList.add('expanded');
                this.#updateLicensePosition();
            } else if (diff < -30 && startExpanded) {
                sheet.classList.remove('expanded');
                this.#updateLicensePosition();
            }
        }, { passive: true });

        handle.addEventListener('touchend', () => {
            sheet.style.transition = '';
        });
    }

    #updateLicensePosition() {
        const sheet = document.getElementById('bottomSheet');
        const license = document.querySelector('.license-container');
        if (!sheet || !license) return;
        
        if (sheet.classList.contains('expanded') && window.innerWidth <= 768) {
            license.style.bottom = 'calc(60vh + 12px)';
        } else {
            license.style.bottom = '';
        }
    }

    #initializeResponsiveHandlers() {
        const handleResize = () => {
            const wasMobile = this.#isMobile;
            this.#isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
            
            if (wasMobile !== this.#isMobile) {
                this.#map.invalidateSize();
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));
    }

    #handleSearch(query, resultsContainerId) {
        const container = document.getElementById(resultsContainerId);
        if (!container) return;

        this.#clearHighlights();
        container.innerHTML = '';

        if (!query.trim()) {
            container.innerHTML = '<div class="search-no-results">Введите название города или страны</div>';
            return;
        }

        const q = query.toLowerCase();
        const results = [];

        for (const marker of this.#allMarkers) {
            const data = this.#markerData.get(marker);
            if (!data) continue;
            
            if (data.location.toLowerCase().includes(q)) {
                results.push({ marker, data });
            }
        }

        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
            return;
        }

        const maxResults = 15;
        results.forEach(({ marker, data }) => {
            this.#highlightMarker(marker);
            
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <span class="search-result-color" style="background: ${this.#getMarkerColor(data.season)}"></span>
                <span class="search-result-text">${this.#highlightText(data.location, q)}</span>
                <span class="search-result-season">${data.season}</span>
            `;
            
            item.addEventListener('click', () => {
                this.#flyToMarker(marker);
                marker.openPopup();
            });
            
            container.appendChild(item);
        });

        // if (results.length > maxResults) {
        //     const more = document.createElement('div');
        //     more.className = 'search-no-results';
        //     more.textContent = `и ещё ${results.length - maxResults} результатов`;
        //     container.appendChild(more);
        // }
    }

    #highlightMarker(marker) {
        marker._originalStyle = {
            color: marker.options.color,
            weight: marker.options.weight
        };
        marker.setStyle({ color: '#ff6600', weight: 3 });
        this.#highlightedMarkers.add(marker);
    }

    #clearHighlights() {
        for (const marker of this.#highlightedMarkers) {
            if (marker._originalStyle) {
                marker.setStyle(marker._originalStyle);
            }
        }
        this.#highlightedMarkers.clear();
    }

    #highlightText(text, query) {
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    #getMarkerColor(season) {
        const sIdx = this.#seasonColorMap.get(season) || 1;
        return this.#getColorByIndex(sIdx, 0);
    }

    #flyToMarker(marker) {
        this.#map.flyTo(marker.getLatLng(), 10, { duration: 0.6 });
    }

    #setSeasonVisibility(seasonName, visible) {
        this.#seasonVisibility.set(seasonName, visible);
        
        document.querySelectorAll(`[data-season="${seasonName}"]`).forEach(item => {
            item.classList.toggle('disabled', !visible);
        });

        const markers = this.#seasonMarkers.get(seasonName);
        if (markers) {
            markers.forEach(marker => {
                if (visible) {
                    if (!this.#map.hasLayer(marker)) marker.addTo(this.#map);
                } else {
                    if (this.#map.hasLayer(marker)) marker.remove();
                }
            });
        }
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

    updateStatus(text) {
        ['status', 'sheetStatusIndicator'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
    }

    addLog(msg, type) {
        ['log', 'sheetLog'].forEach(id => {
            const container = document.getElementById(id);
            if (!container) return;
            
            const div = document.createElement('div');
            div.className = type === 'err' ? 'log-item error' : 'log-item';
            div.textContent = msg;
            container.prepend(div);
        });
    }

    addMarker(coords, content, seasonName, eIdx, locationData = null) {
        if (!this.#seasonColorMap.has(seasonName)) {
            this.#seasonColorMap.set(seasonName, this.#nextColorIndex++);
        }

        const key = coords.join(',');
        let finalCoords = [...coords];

        if (!this.#coordsRegistry.has(key)) {
            this.#coordsRegistry.set(key, []);
        }
        
        const previousMarkers = this.#coordsRegistry.get(key);
        const count = previousMarkers.length;

        if (count > 0) {
            const radius = 0.007;
            const angle = (count - 1) * 137.5 * (Math.PI / 180);
            finalCoords[0] += radius * Math.sqrt(count) * Math.cos(angle);
            finalCoords[1] += radius * Math.sqrt(count) * Math.sin(angle);
        }

        const strokeColor = count > 0 ? '#1a350c' : '#f0eac0';
        const sIdx = this.#seasonColorMap.get(seasonName);
        const color = this.#getColorByIndex(sIdx, eIdx);
        const radius = this.#isMobile ? 8 : 7;

        const marker = L.circleMarker(finalCoords, {
            radius,
            fillColor: color,
            color: strokeColor,
            weight: 2,
            fillOpacity: 1
        }).bindPopup(content, {
            maxWidth: this.#isMobile ? 280 : 320,
            closeButton: this.#isMobile
        });

        if (count === 1) {
            previousMarkers[0].setStyle({ color: '#1a350c' });
        }

        previousMarkers.push(marker);
        marker.addTo(this.#markers);

        if (!this.#seasonMarkers.has(seasonName)) {
            this.#seasonMarkers.set(seasonName, []);
        }
        this.#seasonMarkers.get(seasonName).push(marker);

        this.#allMarkers.push(marker);
        this.#markerData.set(marker, {
            location: locationData || 'Unknown',
            season: seasonName,
            episode: eIdx
        });

        return marker;
    }

    fitMap() {
        if (this.#markers.getLayers().length) {
            this.#map.fitBounds(this.#markers.getBounds().pad(0.1));
        }
    }

    get markerCount() {
        return this.#markers.getLayers().length;
    }

    createLegend(seasons) {
        const createItems = (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';
            
            seasons.forEach((seasonName) => {
                const item = document.createElement('div');
                item.className = 'season-item';
                item.setAttribute('data-season', seasonName);

                const colorIndex = this.#seasonColorMap.get(seasonName) || 1;
                const color = this.#getColorByIndex(colorIndex, 0);

                item.innerHTML = `
                    <span class="season-color" style="background: ${color}"></span>
                    <span class="season-text">${seasonName}</span>
                `;

                this.#seasonVisibility.set(seasonName, true);

                item.addEventListener('click', () => {
                    const visible = !this.#seasonVisibility.get(seasonName);
                    this.#setSeasonVisibility(seasonName, visible);
                });

                container.appendChild(item);
            });
        };

        createItems('seasonsItems');
        createItems('sheetSeasonsItems');

        const count = seasons.length;
        const countEl = document.getElementById('seasonsCount');
        if (countEl) countEl.textContent = count;
    }

    collapseLegend() {
        document.getElementById('seasonsPanel')?.classList.remove('expanded');
    }

    setLegendState(open = true) {
        const panel = document.getElementById('seasonsPanel');
        if (panel) {
            panel.classList.toggle('expanded', open);
        }
    }
}
