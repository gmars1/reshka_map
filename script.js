/* ==================== MAP ==================== */

const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
}).addTo(map);

const markers = L.featureGroup().addTo(map);

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

/* ==================== API ==================== */

const API_URL =
    "https://cyclowiki.org/w/api.php?" +
    new URLSearchParams({
        action: "parse",
        page: "Выпуски_телепередачи_«Орёл_и_решка»",
        section: "2",
        prop: "wikitext",
        format: "json",
        origin: "*"
    });

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

/* ==================== FETCH ==================== */

async function fetchWiki() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Ошибка API");

    const data = await res.json();
    if (!data?.parse?.wikitext?.["*"]) {
        throw new Error("Некорректный ответ API");
    }
    return data.parse.wikitext["*"];
}

/* ==================== PARSER ==================== */

function parseWiki(text) {
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

                const idx = extractIndex(cells);
                if (!idx) return;

                const locations = extractLocations(cells);
                if (!locations.length) return;

                episodes.push({
                    season,
                    idx,
                    location: locations.join("; ")
                });
            });
        });
    }
    return episodes;
}

function extractIndex(cells) {
    const bold = cells.join(" ").match(/'''([^']+)'''/);
    if (bold) return bold[1].trim();
    const fallback = cells[0].match(/\d+[\d\s()]+/);
    return fallback ? fallback[0].trim() : null;
}

function extractLocations(cells) {
    const out = [];

    cells.forEach(cell => {
        const flags = [...cell.matchAll(/\{\{[Фф]лаг\|([^}|]+)/g)]
            .map(m => m[1].trim());

        const links = cell.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g) || [];
        const names = links
            .map(l => l.replace(/[\[\]]/g, "").split("|").pop().trim())
            .filter(n =>
                n.length > 1 &&
                !/^(Файл|File|Image|Категория):/i.test(n) &&
                !/px/i.test(n)
            );

        if (!names.length) return;

        const city = names[0];
        const countries = flags.filter(f => f.toLowerCase() !== city.toLowerCase());
        const prefix = [...new Set(countries)].join("/");

        const label = prefix ? `${prefix}: ${city}` : city;
        if (!out.includes(label)) out.push(label);
    });

    return out;
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

/* ==================== GEOCODE ==================== */

async function geocode(name) {
    const key = "geo_" + name;
    const cached = coord.getItem(key);
    if (cached) return JSON.parse(cached);

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`,
            { headers: { "User-Agent": "orel-reshka-map" } }
        );
        const data = await res.json();
        if (data[0]) {
            const coords = [+data[0].lat, +data[0].lon];
            localStorage.setItem(key, JSON.stringify(coords));
            return coords;
        }
    } catch {}
    return null;
}

/* ==================== TRANSLATE ==================== */

function translateLocation(ru) {
    return ru.split(";").map(part =>
        part.split(/[:\/]/).map(p =>
            geoDict.countries[p.trim()] ||
            geoDict.cities[p.trim()] ||
            p.trim()
        ).join(", ")
    ).join(" | ");
}

/* ==================== UTILS ==================== */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg, cls) {
    logEl.innerHTML = `<div class="${cls}">${msg}</div>` + logEl.innerHTML;
}

/* ==================== DICT ==================== */

const geoDict = {
    countries: {
        "США": "USA", "Соединённые Штаты Америки": "USA", "Испания": "Spain", "Италия": "Italy",
        "Иордания": "Jordan", "Израиль": "Israel", "Камбоджа": "Cambodia", "Таиланд": "Thailand",
        "Вьетнам": "Vietnam", "Азербайджан": "Azerbaijan", "Мексика": "Mexico", "Куба": "Cuba",
        "Нидерланды": "Netherlands", "Грузия": "Georgia", "Франция": "France", "Турция": "Turkey",
        "Германия": "Germany", "Греция": "Greece", "ОАЭ": "UAE", "Объединённые Арабские Эмираты": "UAE",
        "Непал": "Nepal", "Индия": "India", "Швеция": "Sweden", "Китай": "China", "Никарагуа": "Nicaragua",
        "Ливан": "Lebanon", "Бразилия": "Brazil", "Чили": "Chile", "Перу": "Peru", "Аргентина": "Argentina",
        "Сингапур": "Singapore", "Шри-Ланка": "Sri Lanka", "Малайзия": "Malaysia", "Россия": "Russia",
        "Великобритания": "UK", "Англия": "England", "Шотландия": "Scotland", "Кения": "Kenya",
        "Латвия": "Latvia", "Дания": "Denmark", "ЮАР": "South Africa", "Норвегия": "Norway",
        "Мадагаскар": "Madagascar", "Монако": "Monaco", "Марокко": "Morocco", "Португалия": "Portugal",
        "Индонезия": "Indonesia", "Швейцария": "Switzerland", "Австрия": "Austria", "Чехия": "Czech Republic",
        "Бельгия": "Belgium", "Боливия": "Bolivia", "Эквадор": "Ecuador", "Хорватия": "Croatia",
        "Мальта": "Malta", "Беларусь": "Belarus", "Литва": "Lithuania", "Молдавия": "Moldova",
        "Украина": "Ukraine", "Эстония": "Estonia", "Армения": "Armenia", "Таджикистан": "Tajikistan",
        "Киргизия": "Kyrgyzstan", "Казахстан": "Kazakhstan", "Мальдивы": "Maldives", "Эфиопия": "Ethiopia",
        "Танзания": "Tanzania", "Сейшелы": "Seychelles", "Филиппины": "Philippines", "Бруней": "Brunei",
        "Палау": "Palau", "Австралия": "Australia", "Новая Зеландия": "New Zealand", "Вануату": "Vanuatu",
        "Япония": "Japan", "Тайвань": "Taiwan", "Китайская Республика": "Taiwan", "Монголия": "Mongolia", 
        "Канада": "Canada", "Исландия": "Iceland", "Гренландия": "Greenland", "Ирландия": "Ireland", 
        "Маврикий": "Mauritius", "Панама": "Panama", "Колумбия": "Colombia", "Босния и Герцеговина": "Bosnia and Herzegovina",
        "Сербия": "Serbia", "Польша": "Poland", "Мьянма": "Myanmar", "Гватемала": "Guatemala",
        "Лаос": "Laos", "Египет": "Egypt", "Доминиканская Республика": "Dominican Republic",
        "Венгрия": "Hungary", "Кабо-Верде": "Cape Verde", "Сенегал": "Senegal", "Албания": "Albania",
        "Румыния": "Romania", "Лихтенштейн": "Liechtenstein", "Финляндия": "Finland", "Намибия": "Namibia",
        "Зимбабве": "Zimbabwe", "Мозамбик": "Mozambique", "Уганда": "Uganda", "Оман": "Oman",
        "Бангладеш": "Bangladesh", "Фиджи": "Fiji", "Французская Полинезия": "French Polynesia",
        "Гондурас": "Honduras", "Гайана": "Guyana", "Уругвай": "Uruguay", "Парагвай": "Paraguay",
        "Венесуэла": "Venezuela", "Новая Каледония": "New Caledonia", "Нигерия": "Nigeria",
        "Тунис": "Tunisia", "Гана": "Ghana", "Южная Корея": "South Korea", "Кот-д'Ивуар": "Ivory Coast",
        "Андорра": "Andorra", "Пакистан": "Pakistan", "Кипр": "Cyprus", "КНДР": "North Korea",
        "Либерия": "Liberia", "Бутан": "Bhutan", "Чад": "Chad", "Багамы": "Bahamas", "Багамские острова": "Bahamas",
        "Ямайка": "Jamaica", "Соломоновы острова": "Solomon Islands", "Центральноафриканская Республика": "CAR",
        "Сьерра-Леоне": "Sierra Leone", "Мартиника": "Martinique",
        // Добавленные регионы (исправление Missing translation)
        "Канары": "Canary Islands",
        "Каталония": "Catalonia",
        "Бавария": "Bavaria",
        "Калифорния": "California",
        "Вайоминг": "Wyoming",
        "Мичиган": "Michigan",
        "Невада": "Nevada",
        "Северные Марианские острова": "Northern Mariana Islands",
        "Доминикана": "Dominica"
    },
    cities: {
        "Нью-Йорк": "New York", "Лас-Вегас": "Las Vegas", "Сан-Франциско": "San Francisco",
        "Лос-Анджелес": "Los Angeles", "Барселона": "Barcelona", "Рим": "Rome", "Мадрид": "Madrid",
        "Милан": "Milan", "Пномпень": "Phnom Penh", "Бангкок": "Bangkok", "Хошимин": "Ho Chi Minh City",
        "Баку": "Baku", "Мехико": "Mexico City", "Гавана": "Havana", "Амстердам": "Amsterdam",
        "Канкун": "Cancun", "Батуми": "Batumi", "Париж": "Paris", "Стамбул": "Istanbul",
        "Берлин": "Berlin", "Афины": "Athens", "Дубай": "Dubai", "Катманду": "Kathmandu",
        "Мумбаи": "Mumbai", "Чикаго": "Chicago", "Новый Орлеан": "New Orleans", "Даллас": "Dallas",
        "Стокгольм": "Stockholm", "Пекин": "Beijing", "Гонконг": "Hong Kong", "Майами": "Miami",
        "Манагуа": "Managua", "Бейрут": "Beirut", "Рио-де-Жанейро": "Rio de Janeiro", "Сантьяго": "Santiago",
        "Сан-Паулу": "Sao Paulo", "Мачу-Пикчу": "Machu Picchu", "Буэнос-Айрес": "Buenos Aires",
        "Куала-Лумпур": "Kuala Lumpur", "Санкт-Петербург": "Saint Petersburg", "Эдинбург": "Edinburgh",
        "Найроби": "Nairobi", "Рига": "Riga", "Лондон": "London", "Копенгаген": "Copenhagen",
        "Кейптаун": "Cape Town", "Алесунд": "Alesund", "Палермо": "Palermo", "Лазурный Берег": "French Riviera",
        "Марракеш": "Marrakech", "Канарские острова": "Canary Islands", "Лиссабон": "Lisbon",
        "Шанхай": "Shanghai", "Остров Бали": "Bali", "Швейцарские Альпы": "Swiss Alps", "Вена": "Vienna",
        "Прага": "Prague", "Брюссель": "Brussels", "Венеция": "Venice", "Ла-Пас": "La Paz",
        "Кито": "Quito", "Абу-Даби": "Abu Dhabi", "Анталия": "Antalya", "Корсика": "Corsica",
        "Дубровник": "Dubrovnik", "Валенсия": "Valencia", "Крит": "Crete", "Минск": "Minsk",
        "Вильнюс": "Vilnius", "Казань": "Kazan", "Одесса": "Odessa", "Таллин": "Tallinn",
        "Иркутск": "Irkutsk", "Владивосток": "Vladivostok", "Камчатка": "Kamchatka", "Ереван": "Yerevan",
        "Душанбе": "Dushanbe", "Бишкек": "Bishkek", "Алматы": "Almaty", "Калининград": "Kaliningrad",
        "Львов": "Lviv", "Аддис-Абеба": "Addis Ababa", "Манила": "Manila", "Борнео": "Borneo",
        "Ханой": "Hanoi", "Мельбурн": "Melbourne", "Окленд": "Auckland", "Сидней": "Sydney",
        "Токио": "Tokyo", "Киото": "Kyoto", "Тайбэй": "Taipei", "Улан-Батор": "Ulaanbaatar",
        "Гонолулу": "Honolulu", "Аляска": "Alaska", "Торонто": "Toronto", "Монреаль": "Montreal",
        "Гренландия": "Greenland", "Богота": "Bogota", "Ушуайя": "Ushuaia", "Бордо": "Bordeaux",
        "Франкфурт-на-Майне": "Frankfurt", "Нормандия": "Normandy", "Роттердам": "Rotterdam",
        "Сараево": "Sarajevo", "Страна Басков": "Basque Country", "Сарагоса": "Zaragoza",
        "Белград": "Belgrade", "Фарерские острова": "Faroe Islands", "Болонья": "Bologna",
        "Краков": "Krakow", "Карпаты": "Carpathians", "Азорские острова": "Azores", "Глазго": "Glasgow",
        "Дели": "Delhi", "Гуанчжоу": "Guangzhou", "Варанаси": "Varanasi", "Мандалай": "Mandalay",
        "Луангпрабанг": "Luang Prabang", "Каир": "Cairo", "Пуэрто-Рико": "Puerto Rico",
        "Неаполь": "Naples", "Вашингтон": "Washington", "Будапешт": "Budapest", "Сиэтл": "Seattle",
        "Аризона": "Arizona", "Сан-Диего": "San Diego", "Дакар": "Dakar", "Мадейра": "Madeira",
        "Орландо": "Orlando", "Бостон": "Boston", "Саванна": "Savannah", "Йеллоустон": "Yellowstone",
        "Салоники": "Thessaloniki", "Осло": "Oslo", "Тирана": "Tirana", "Шпицберген": "Svalbard",
        "Варшава": "Warsaw", "Трансильвания": "Transylvania", "Детройт": "Detroit", "Квебек": "Quebec",
        "Рино": "Reno", "Мюнхен": "Munich", "Хельсинки": "Helsinki", "Манаус": "Manaus",
        "Лима": "Lima", "Патагония": "Patagonia", "Антверпен": "Antwerp", "Дюссельдорф": "Dusseldorf",
        "Флоренция": "Florence", "Йоханнесбург": "Johannesburg", "Хараре": "Harare", "Мапуту": "Maputo",
        "Маскат": "Muscat", "Гоа": "Goa", "Бангалор": "Bangalore", "Покхара": "Pokhara",
        "Дакка": "Dhaka", "Пхукет": "Phuket", "Чиангмай": "Chiang Mai", "Джакарта": "Jakarta",
        "Хайнань": "Hainan", "Макао": "Macau", "Себу": "Cebu", "Хиросима": "Hiroshima",
        "Осака": "Osaka", "Сайпан": "Saipan", "Таити": "Tahiti", "Ванкувер": "Vancouver",
        "Сакраменто": "Sacramento", "Солт-Лейк-Сити": "Salt Lake City", "Гвадалахара": "Guadalajara",
        "Акапулько": "Acapulco", "Гуаякиль": "Guayaquil", "Икитос": "Iquitos", "Атакама": "Atacama",
        "Асунсьон": "Asuncion", "Монтевидео": "Montevideo", "Порту": "Porto", "Фес": "Fes",
        "Кордова": "Cordoba", "Нант": "Nantes", "Момбаса": "Mombasa", "Калькутта": "Kolkata",
        "Сан-Педро-Сула": "San Pedro Sula", "Кюрасао": "Curacao", "Каракас": "Caracas",
        "Куинстаун": "Queenstown", "Новая Каледония": "New Caledonia", "Квинсленд": "Queensland",
        "Лагос": "Lagos", "Аккра": "Accra", "Астана": "Astana", "Сеул": "Seoul", "Ибица": "Ibiza",
        "Сардиния": "Sardinia", "Сплит": "Split", "Гамбург": "Hamburg", "Синтра": "Sintra",
        "Прованс": "Provence", "Керала": "Kerala", "Ливерпуль": "Liverpool", "Ионические острова": "Ionian Islands",
        "Виндхук": "Windhoek", "Пиза": "Pisa", "Бухарест": "Bucharest", "Абиджан": "Abidjan",
        "Карачи": "Karachi", "Пхеньян": "Pyongyang", "Монровия": "Monrovia", "Гётеборг": "Gothenburg",
        "Фритаун": "Freetown", "Нджамена": "N'Djamena", "Байкал": "Baikal", "Эс-Сувейра": "Essaouira",
        "Севилья": "Seville", "Женева": "Geneva", "Грозный": "Grozny", "Крым": "Crimea",
        "Кишинёв": "Chisinau", "Казань": "Kazan", "Сантьяго-де-Куба": "Santiago de Cuba",
        "Банги": "Bangui",
        // Добавленные города
        "Ноттингем": "Nottingham"
    }
};


const coord = {
	"geo_Albania, Tirana": [41.3281482,19.8184435],	
	"geo_Argentina, Buenos Aires": [-34.6095579,-58.3887904],	
	"geo_Argentina, Patagonia": [-51.6538867,-69.2921939],	
	"geo_Argentina, Ushuaia": [-54.807306,-68.3084133],	
	"geo_Armenia, Yerevan": [40.1777112,44.5126233],	
	"geo_Australia, Melbourne": [-37.8142454,144.9631732],	
	"geo_Australia, Queensland": [-22.1646782,144.5844903],	
	"geo_Australia, Sydney": [-33.8698439,151.2082848],	
	"geo_Austria, Vienna": [48.2083537,16.3725042],	
	"geo_Azerbaijan, Baku": [40.3755885,49.8328009],	
	"geo_Bahamas": [24.7736546,-78.0000547],	
	"geo_Bangladesh, Dhaka": [23.7643863,90.3890144],	
	"geo_Belarus, Minsk": [53.9024716,27.5618225],	
	"geo_Belgium, Antwerp": [51.2211097,4.3997081],	
	"geo_Belgium, Brussels": [50.8467372,4.352493],	
	"geo_Bolivia, La Paz": [-16.4955455,-68.1336229],	
	"geo_Bosnia and Herzegovina, Sarajevo": [43.8570713,18.4126147],	
	"geo_Brazil, Manaus": [-3.1316333,-59.9825041],	
	"geo_Brazil, Rio de Janeiro": [-22.9110137,-43.2093727],	
	"geo_Brazil, Sao Paulo": [-23.5506507,-46.6333824],	
	"geo_Cambodia": [12.5433216,104.8144914],	
	"geo_Cambodia, Phnom Penh": [11.5730391,104.857807],	
	"geo_Canada, Montreal": [45.5031824,-73.5698065],	
	"geo_Canada, Quebec": [52.4760892,-71.8258668],	
	"geo_Canada, Toronto": [43.6534817,-79.3839347],	
	"geo_Canada, Vancouver": [49.2608724,-123.113952],	
	"geo_Cape Verde": [16.0000552,-24.0083947],	
	"geo_Chile, Atacama": [-24.5563029,-69.4226479],	
	"geo_Chile, Santiago": [-33.4377756,-70.6504502],	
	"geo_China, Beijing": [40.190632,116.412144],	
	"geo_China, Guangzhou": [23.1288454,113.2590064],	
	"geo_China, Hainan": [19.2000001,109.5999999],	
	"geo_China, Macau": [22.1757605,113.5514142],	
	"geo_China, Shanghai": [31.2312707,121.4700152],	
	"geo_Colombia, Bogota": [4.6533817,-74.0836331],	
	"geo_Croatia, Dubrovnik": [42.6491029,18.0939501],	
	"geo_Cuba, Havana": [23.135305,-82.3589631],	
	"geo_Cuba, Santiago de Cuba": [20.0214263,-75.8294928],	
	"geo_Czech Republic, Prague": [50.0874654,14.4212535],	
	"geo_Denmark, Copenhagen": [55.6867243,12.5700724],	
	"geo_Denmark, Greenland": [71.7919151,-38.8397752],	
	"geo_Dominican Republic, Dominica": [19.0974031,-70.3028026],	
	"geo_Ecuador, Guayaquil": [-2.1900572,-79.8868669],	
	"geo_Ecuador, Quito": [-0.2201641,-78.5123274],	
	"geo_Egypt, Cairo": [30.0443879,31.2357257],	
	"geo_Estonia, Tallinn": [59.4372419,24.7572802],	
	"geo_Ethiopia, Addis Ababa": [9.0358287,38.7524127],	
	"geo_Fiji": [-18.1239696,179.0122737],	
	"geo_Finland, Helsinki": [60.1666204,24.9435408],	
	"geo_France, Bordeaux": [44.841225,-0.5800364],	
	"geo_France, Corsica": [42.188098,9.0683139],	
	"geo_France, Nantes": [47.2186371,-1.5541362],	
	"geo_France, New Caledonia": [-21.3019905,165.4880773],	
	"geo_France, Normandy": [49.0677708,0.3138532],	
	"geo_France, Paris": [48.8534951,2.3483915],	
	"geo_Georgia": [32.3293809,-83.1137366],	
	"geo_Georgia, Batumi": [41.6509502,41.6360085],	
	"geo_Germany, Bavaria, Munich": [48.1371079,11.5753822],	
	"geo_Germany, Berlin": [52.5173885,13.3951309],	
	"geo_Germany, Dusseldorf": [51.2254018,6.7763137],	
	"geo_Germany, Frankfurt": [50.1106444,8.6820917],	
	"geo_Greece, Athens": [37.9755648,23.7348324],	
	"geo_Greece, Crete": [35.3084952,24.4633423],	
	"geo_Greece, Thessaloniki": [40.6403167,22.9352716],	
	"geo_Guatemala": [15.5855545,-90.345759],	
	"geo_Guyana": [4.8417097,-58.6416891],	
	"geo_Honduras": [15.2572432,-86.0755145],	
	"geo_Honduras, San Pedro Sula": [15.5053535,-88.0250839],	
	"geo_Hong Kong": [22.2792968,114.1628907],	
	"geo_Hungary, Budapest": [47.4978789,19.0402383],	
	"geo_Iceland": [64.9841821,-18.1059013],	
	"geo_India, Bangalore": [12.9767936,77.590082],	
	"geo_India, Delhi": [28.6138954,77.2090057],	
	"geo_India, Goa": [15.3004543,74.0855134],	
	"geo_India, Kolkata": [22.5726459,88.3638953],	
	"geo_India, Mumbai": [19.054999,72.8692035],	
	"geo_India, Varanasi": [25.3356491,83.0076292],	
	"geo_Indonesia": [-2.4833826,117.8902853],	
	"geo_Indonesia, Bali": [-8.2271303,115.1919203],	
	"geo_Indonesia, Jakarta": [-6.1754049,106.827168],	
	"geo_Ireland": [52.865196,-7.9794599],	
	"geo_Israel": [30.8124247,34.8594762],	
	"geo_Italy, Bologna": [44.4938203,11.3426327],	
	"geo_Italy, Florence": [43.7697955,11.2556404],	
	"geo_Italy, Milan": [45.4641943,9.1896346],	
	"geo_Italy, Naples": [40.8358846,14.2487679],	
	"geo_Italy, Palermo": [38.1112268,13.3524434],	
	"geo_Italy, Rome": [41.8933203,12.4829321],	
	"geo_Italy, Venice": [45.4371908,12.3345898],	
	"geo_Jamaica": [18.1850507,-77.3947693],	
	"geo_Japan, Hiroshima": [34.3917241,132.4517589],	
	"geo_Japan, Kyoto": [35.0115754,135.7681441],	
	"geo_Japan, Osaka": [34.6937569,135.5014539],	
	"geo_Japan, Tokyo": [35.6768601,139.7638947],	
	"geo_Jordan": [31.1667049,36.941628],	
	"geo_Kazakhstan, Almaty": [43.2363924,76.9457275],	
	"geo_Kenya, Mombasa": [-4.05052,39.667169],	
	"geo_Kenya, Nairobi": [-1.2890006,36.8172812],	
	"geo_Kyrgyzstan, Bishkek": [42.8761424,74.6036724],	
	"geo_Laos, Luang Prabang": [19.8887438,102.135898],	
	"geo_Latvia, Riga": [56.9493977,24.1051846],	
	"geo_Lebanon, Beirut": [33.8892265,35.5025585],	
	"geo_Liechtenstein": [47.1416307,9.5531527],	
	"geo_Lithuania, Vilnius": [54.6870458,25.2829111],	
	"geo_Madagascar": [-18.9249604,46.4416422],	
	"geo_Malaysia, Kuala Lumpur": [3.1526589,101.7022205],	
	"geo_Maldives": [3.7203503,73.2244152],	
	"geo_Malta": [35.9311442,14.3951627],	
	"geo_Mauritius": [-20.2759451,57.5703566],	
	"geo_Mexico, Acapulco": [16.8680495,-99.8940182],	
	"geo_Mexico, Cancun": [21.1527467,-86.8425761],	
	"geo_Mexico, Guadalajara": [20.6720375,-103.338396],	
	"geo_Mexico, Mexico City": [19.3207722,-99.1514678],	
	"geo_Moldova, Chisinau": [47.0245117,28.8322923],	
	"geo_Mongolia, Ulaanbaatar": [47.9184676,106.9177016],	
	"geo_Morocco, Fes": [34.0346534,-5.0161926],	
	"geo_Morocco, Marrakech": [31.6258257,-7.9891608],	
	"geo_Mozambique, Maputo": [-25.966213,32.56745],	
	"geo_Myanmar, Mandalay": [21.9596834,96.0948743],	
	"geo_Namibia": [-23.2335499,17.3231107],	
	"geo_Nepal, Kathmandu": [27.708317,85.3205817],	
	"geo_Nepal, Pokhara": [28.209538,83.991402],	
	"geo_Netherlands, Amsterdam": [52.3730796,4.8924534],	
	"geo_Netherlands, Curacao": [12.2135136,-69.040892],	
	"geo_Netherlands, Rotterdam": [51.9244424,4.47775],	
	"geo_New Zealand, Auckland": [-36.852095,174.7631803],	
	"geo_New Zealand, Queenstown": [-45.0321923,168.661],	
	"geo_Nicaragua, Managua": [12.1547116,-86.273725],	
	"geo_Norway, Alesund": [62.4802363,6.5550739],	
	"geo_Norway, Oslo": [59.9133301,10.7389701],	
	"geo_Norway, Svalbard": [78.7198519,20.3493328],	
	"geo_Oman, Muscat": [23.6123628,58.5938134],	
	"geo_Palau": [5.3783537,132.9102573],	
	"geo_Panama": [8.559559,-81.1308434],	
	"geo_Paraguay, Montevideo": [-34.9083157,-56.1922545],	
	"geo_Peru, Iquitos": [-3.749365,-73.2444145],	
	"geo_Peru, Lima": [-12.0459808,-77.0305912],	
	"geo_Peru, Machu Picchu": [-13.164341,-72.5450094],	
	"geo_Philippines, Cebu": [10.47,123.83],	
	"geo_Philippines, Manila": [14.5904492,120.9803621],	
	"geo_Poland, Krakow": [50.0469432,19.9971534],	
	"geo_Poland, Warsaw": [52.2333742,21.0711489],	
	"geo_Portugal, Azores": [37.8085565,-25.4731374],	
	"geo_Portugal, Lisbon": [38.7077507,-9.1365919],	
	"geo_Portugal, Madeira": [32.7517501,-16.9817487],	
	"geo_Portugal, Porto": [41.1502195,-8.6103497],	
	"geo_Romania, Transylvania": [46.5971623,24.3740295],	
	"geo_Russia, Grozny": [43.3086383,45.7065735],	
	"geo_Russia, Irkutsk": [52.2891225,104.279829],	
	"geo_Russia, Kaliningrad": [54.710128,20.5105838],	
	"geo_Russia, Kamchatka": [57.1914882,160.0383819],	
	"geo_Russia, Kazan": [55.7946485,49.1115022],	
	"geo_Russia, Saint Petersburg": [59.9606739,30.1586551],	
	"geo_Russia, Vladivostok": [43.1150678,131.8855768],	
	"geo_Senegal, Dakar": [14.693425,-17.447938],	
	"geo_Serbia, Belgrade": [44.8153318,20.4456588],	
	"geo_Seychelles": [-4.6574977,55.4540146],	
	"geo_Singapore": [1.357107,103.8194992],	
	"geo_Solomon Islands": [-8.7053941,159.1070694],	
	"geo_South Africa, Cape Town": [-33.9288301,18.4172197],	
	"geo_South Africa, Johannesburg": [-26.205,28.049722],	
	"geo_Spain, Barcelona": [41.3825802,2.177073],	
	"geo_Spain, Basque Country": [42.9911816,-2.5543023],	
	"geo_Spain, Canary Islands, Canary Islands": [28.2935785,-16.6214471],	
	"geo_Spain, Cordoba": [37.8845813,-4.7760138],	
	"geo_Spain, Madrid": [40.416782,-3.703507],	
	"geo_Spain, Valencia": [39.4697065,-0.3763353],	
	"geo_Spain, Zaragoza": [41.6521342,-0.8809428],	
	"geo_Sri Lanka": [7.5554942,80.7137847],	
	"geo_Sweden, Stockholm": [59.3251172,18.0710935],	
	"geo_Switzerland": [46.7985624,8.2319736],	
	"geo_Switzerland, Swiss Alps": [46.944057,7.4481778],	
	"geo_Taiwan, Taipei": [25.0375198,121.5636796],	
	"geo_Tajikistan, Dushanbe": [38.5762709,68.7863573],	
	"geo_Tanzania": [-6.5247123,35.7878438],	
	"geo_Thailand": [14.8971921,100.83273],	
	"geo_Thailand, Bangkok": [13.7524938,100.4935089],	
	"geo_Thailand, Chiang Mai": [18.7882778,98.9858802],	
	"geo_Thailand, Phuket": [7.9366015,98.3529292],	
	"geo_Turkey, Antalya": [36.8865728,30.7030242],	
	"geo_Turkey, Istanbul": [41.006381,28.9758715],	
	"geo_UAE, Abu Dhabi": [24.4538352,54.3774014],	
	"geo_UAE, Dubai": [25.0742823,55.1885387],	
	"geo_UK, Edinburgh": [55.9533456,-3.1883749],	
	"geo_UK, England, Liverpool": [53.4071991,-2.99168],	
	"geo_UK, England, London": [51.5074456,-0.1277653],	
	"geo_UK, England, Nottingham": [52.9534193,-1.1496461],	
	"geo_UK, Scotland, Glasgow": [55.861155,-4.2501687],	
	"geo_USA, Alaska": [64.4459613,-149.680909],	
	"geo_USA, Arizona": [34.395342,-111.763275],	
	"geo_USA, Boston": [42.3588336,-71.0578303],	
	"geo_USA, California, San Diego": [32.7174202,-117.162772],	
	"geo_USA, Chicago": [41.8755616,-87.6244212],	
	"geo_USA, Dallas": [32.7762719,-96.7968559],	
	"geo_USA, Honolulu": [21.304547,-157.855676],	
	"geo_USA, Las Vegas": [36.1674263,-115.1484131],	
	"geo_USA, Los Angeles": [34.0536909,-118.242766],	
	"geo_USA, Miami": [25.7741566,-80.1935973],	
	"geo_USA, Michigan, Detroit": [42.3315509,-83.0466403],	
	"geo_USA, Nevada, Reno": [39.5261788,-119.812658],	
	"geo_USA, New Orleans": [29.9561422,-90.0733934],	
	"geo_USA, New York": [40.7127281,-74.0060152],	
	"geo_USA, Orlando": [28.5421218,-81.379045],	
	"geo_USA, Puerto Rico": [18.2247706,-66.4858295],	
	"geo_USA, Sacramento": [38.5810606,-121.493895],	
	"geo_USA, Salt Lake City": [40.7596198,-111.886797],	
	"geo_USA, San Francisco": [37.7879363,-122.4075201],	
	"geo_USA, Savannah": [32.0790074,-81.0921335],	
	"geo_USA, Washington": [38.8950368,-77.0365427],	
	"geo_USA, Washington, Seattle": [47.6038321,-122.330062],	
	"geo_USA, Wyoming, Yellowstone": [44.6200885,-110.5606893],	
	"geo_Uganda": [1.5333554,32.2166578],	
	"geo_Ukraine, Carpathians": [48.6499199,23.4200824],	
	"geo_Ukraine, Crimea": [45.2835044,34.2008188],	
	"geo_Ukraine, Lviv": [49.841952,24.0315921],	
	"geo_Ukraine, Odessa": [46.4843023,30.7322878],	
	"geo_Uruguay, Asuncion": [-25.2580104,-57.5635801],	
	"geo_Vanuatu": [-16.5255069,168.1069154],	
	"geo_Venezuela, Caracas": [10.5060934,-66.9146008],	
	"geo_Vietnam": [15.9266657,107.9650855],	
	"geo_Vietnam, Hanoi": [21.0283334,105.854041],	
	"geo_Vietnam, Ho Chi Minh City": [10.7755254,106.7021047],	
	"geo_Zimbabwe, Harare": [-17.8567035,31.0601584],	
	"geo_Nigeria, Lagos": [6.4550575,3.3941795],	
	"geo_Tunisia": [33.8439408,9.400138],	
	"geo_Ghana, Accra": [5.5571096,-0.2012376],	
	"geo_Kazakhstan, Astana": [51.1282205,71.4306682],	
	"geo_South Korea, Seoul": [37.5666791,126.9782914],	
	"geo_Spain, Catalonia, Barcelona": [41.3825802,2.177073],	
	"geo_Spain, Ibiza": [38.9743901,1.4197463],	
	"geo_Scotland, Edinburgh": [55.9533456,-3.1883749],	
	"geo_Italy, Sardinia": [40.0912813,9.0305773],	
	"geo_Croatia, Split": [43.5116383,16.4399659],	
	"geo_Germany, Hamburg": [53.550341,10.000654],	
	"geo_Sweden": [59.6749712,14.5208584],	
	"geo_Portugal, Sintra": [38.8355446,-9.3522371],	
	"geo_France, Provence": [44.0580563,6.0638506],	
	"geo_India, Kerala": [10.3528744,76.5120396],	
	"geo_UK, Liverpool": [53.4071991,-2.99168],	
	"geo_Greece, Ionian Islands": [37.7891385,20.7900896],	
	"geo_Namibia, Windhoek": [-22.5335601,17.0454775],	
	"geo_Italy, Pisa": [43.4714722,10.6797912],	
	"geo_Romania, Bucharest": [44.4361414,26.102684],	
	"geo_Ivory Coast, Abidjan": [5.4091179,-4.0422099],	
	"geo_Andorra": [42.5407167,1.5732033],	
	"geo_Pakistan, Karachi": [24.8546842,67.0207055],	
	"geo_Cyprus": [34.9174159,32.8899027],	
	"geo_North Korea, Pyongyang": [39.0167979,125.7473609],	
	"geo_Liberia, Monrovia": [6.3203562,-10.8060492],	
	"geo_Martinique": [14.6113732,-60.9620777],	
	"geo_Bhutan": [27.549511,90.5119273],	
	"geo_CAR, Bangui": [4.3645749,18.5764693],	
	"geo_Sweden, Gothenburg": [57.7072326,11.9670171],	
	"geo_Sierra Leone, Freetown": [8.479004,-13.26795],	
	"geo_Croatia": [45.3658443,15.6575209],	
	"geo_Chad, N'Djamena": [12.1191543,15.0502758]
}
