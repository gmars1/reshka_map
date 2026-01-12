export class UIManager {
    #statusEl = document.getElementById("status");
    #logEl = document.getElementById("log");
    #panelBody = document.getElementById("panelBody"); // Добавили тело панели
    #toggleBtn = document.getElementById("toggleBtn"); // Добавили кнопку
    #map;
    #markers;

    constructor() {
        // 1. Инициализация карты
        this.#map = L.map("map").setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(this.#map);

        this.#markers = L.featureGroup().addTo(this.#map);

        // 2. Инициализация управления панелью
        this.#initToggle();
    }

    #initToggle() {
        const header = document.getElementById('panelHeader');
        if (header) {
            // Привязываем клик к методу класса
            header.addEventListener('click', () => this.togglePanel());
        }
    }

    togglePanel() {
        // Если стиль display пустой (в начале), считаем что панель видна
        const isHidden = this.#panelBody.style.display === 'none';
        
        this.#panelBody.style.display = isHidden ? 'block' : 'none';
        this.#toggleBtn.innerText = isHidden ? '−' : '+';
    }

    updateStatus(text) {
        this.#statusEl.textContent = text;
    }

    addLog(msg, type) {
        const div = document.createElement('div');
        div.className = type; // "ok" или "err"
        div.textContent = msg;
        this.#logEl.prepend(div);
    }

    addMarker(coords, popupContent) {
        return L.marker(coords)
            .bindPopup(popupContent)
            .addTo(this.#markers);
    }

    fitMap() {
        if (this.#markers.getLayers().length) {
            this.#map.fitBounds(this.#markers.getBounds().pad(0.15));
        }
    }

    get markerCount() {
        return this.#markers.getLayers().length;
    }
}