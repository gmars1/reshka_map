

const cache = localStorage;

export function addGeoCache(key, value) {
    cache.setItem(key, JSON.stringify(value));
}

export function getGeoCache(key) {
    const cached = cache.getItem(key)
    if(cached) return JSON.parse(cached);

    return null; 
}


