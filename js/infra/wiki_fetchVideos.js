
//const API_URL = "https://ru.wikipedia.org/w/index.php?" +
//new URLSearchParams({
//    action: "edit",
//    title: "Орёл_и_решка_(телепередача)",
//    section: "4",
//    prop: "wikitext",
//    format: "json",
//    origin: "*"
//});



async function fetchWikiWikitext({
    api = "https://ru.wikipedia.org/w/api.php",
    page,
    section = null
}) {
    if (!page) {
        throw new Error("Page title is required");
    }

    const params = new URLSearchParams({
        action: "parse",
        page,
        prop: "wikitext",
        format: "json",
        origin: "*"
    });

    if (section !== null) {
        params.set("section", section);
    }

    const url = `${api}?${params.toString()}`;

    let response;
    try {
        response = await fetch(url);
    } catch (e) {
        throw new Error("Network error (no connection or CORS)");
    }

    /* ================= HTTP GUARD ================= */

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        throw new Error("Invalid response type (not JSON)");
    }

    /* ================= JSON GUARD ================= */

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error("Failed to parse JSON");
    }

    if (data.error) {
        throw new Error(`API error: ${data.error.info}`);
    }

    if (!data.parse) {
        throw new Error("Missing 'parse' in API response");
    }

    if (!data.parse.wikitext || typeof data.parse.wikitext["*"] !== "string") {
        throw new Error("Missing wikitext content");
    }

    /* ================= OK ================= */

    return data.parse.wikitext["*"];
}



//export async function fetchWiki() {
//    console.log(API_URL);
//    const res = await fetch(API_URL);
//    if (!res.ok) throw new Error("Ошибка API");
//
//    const data = await res.json();
//    if (!data?.parse?.wikitext?.["*"]) {
//        throw new Error("Некорректный ответ API");
//    }
//    return data.parse.wikitext["*"];
//}

export async function fetchWiki() {
    try {
        const wikiText = await fetchWikiWikitext({
            page: "Орёл_и_решка_(телепередача)",
            section: 4
        });
        return wikiText;

//        console.log("WikiText loaded:", wikiText.slice(0, 200));

    } catch (e) {
        console.error("❌ Wiki fetch failed:", e.message);
    }
}


//-------------


