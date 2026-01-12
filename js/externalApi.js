

const API_URL = "https://cyclowiki.org/w/api.php?" +
new URLSearchParams({
    action: "parse",
    page: "Выпуски_телепередачи_«Орёл_и_решка»",
    section: "2",
    prop: "wikitext",
    format: "json",
    origin: "*"
});


export async function fetchWiki() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Ошибка API");

    const data = await res.json();
    if (!data?.parse?.wikitext?.["*"]) {
        throw new Error("Некорректный ответ API");
    }
    return data.parse.wikitext["*"];
}


//-------------


export async function fetchCoordiantes(enName) {
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
}