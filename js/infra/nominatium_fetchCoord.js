import { translateLocation } from "../services/funcs.js";
import { cache } from "./cache.js";

// check ru in cache 
// check ru vs en 
// fetch ru 
// add ru to cache
export async function fetchCoordiantes(ruName) {

    const cached = getGeoCache(ruName);
    if (cached) {
//        console.log("ret")
        return cached;
    }

    try {
        console.log("fetching ru from real API:", ruName);

        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ruName)}&limit=1`,
            { headers: { "User-Agent": "orel-reshka-map" } }
        );

        const data = await res.json();

//        console.log("coords:", coords);

        if (!Array.isArray(data) || !data.length) {
            console.warn("City not found:", ruName);
            return null;
        }



        const coords = [
            +data[0].lat,
            +data[0].lon,
        ];



        addGeoCache(ruName, coords);
        return coords;

    } catch (e) {
        console.error("Geo fetch failed:", ruName, e);
        return null;
    }
}


function addGeoCache(key, value) {
    try {
//        console.log(""+key+" "+value);
        cache.setItem(key + "_coord", JSON.stringify(value));
    } catch (e) {
        console.warn("Cache write failed:", e);
    }
}

function getGeoCache(key) {
    try {
        const cached = cache.getItem(key + "_coord");
        return cached ? JSON.parse(cached) : null;
    } catch (e) {
        console.warn("Cache read failed:", e);
        return null;
    }
}