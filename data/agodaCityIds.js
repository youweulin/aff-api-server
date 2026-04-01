// Japan City ID Mapping for Agoda Affiliate API
// These city IDs are required for the Agoda pricing API (lt_v1)
// Source: Agoda Hotel Data File + Web Research

export const AGODA_CITY_IDS = {
    // Major Cities (Most Common)
    "tokyo": 9395,
    "osaka": 7036,
    "kyoto": 4946,
    "fukuoka": 2688,
    "sapporo": 8466,
    "nagoya": 6553,
    "yokohama": 10820,
    "kobe": 4899,
    "hiroshima": 3486,
    "sendai": 8668,

    // Hokkaido
    "asahikawa": 620,
    "hakodate": 3202,
    "otaru": 7289,
    "niseko": 71364,
    "furano": 2682,
    "noboribetsu": 6789,
    "toya": 10319,
    "biei": 71408,
    "kushiro": 5071,
    "wakkanai": 10626,

    // Kyushu
    "beppu": 1102,
    "kumamoto": 5044,
    "nagasaki": 6525,
    "kagoshima": 4372,
    "oita": 7092,
    "saga": 8301,
    "miyazaki": 6384,
    "yufu": 10857, // 由布院
    "yufuin": 10857,
    "aso": 627,

    // Okinawa
    "okinawa": 7122,
    "naha": 6568,
    "ishigaki": 3754,
    "miyakojima": 6371,

    // Kanto Area
    "hakone": 3221,
    "nikko": 6716,
    "kamakura": 4435,
    "chiba": 1916,
    "karuizawa": 4637,
    "izu": 3808,
    "ito": 3795,
    "atami": 636,

    // Chubu Area
    "kanazawa": 4457,
    "takayama": 9921,
    "matsumoto": 5977,
    "nagano": 6517,
    "fujikawaguchiko": 2668,
    "hakuba": 3211,
    "shirakawago": 71422,

    // Kansai Area
    "nara": 6580,
    "himeji": 3387,

    // Shikoku
    "takamatsu": 9913,
    "matsuyama": 5985,

    // Chugoku
    "okayama": 7116,
    "kurashiki": 5048
};

// Get city ID by name (case-insensitive, supports partial match)
export function getCityId(cityName) {
    if (!cityName) return null;

    const normalized = cityName.toLowerCase().trim();

    // Direct match
    if (AGODA_CITY_IDS[normalized]) {
        return AGODA_CITY_IDS[normalized];
    }

    // Partial match (e.g., "Tokyo Station Area" -> "tokyo")
    for (const [key, id] of Object.entries(AGODA_CITY_IDS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return id;
        }
    }

    return null;
}

// Get all available cities
export function getAvailableCities() {
    return Object.keys(AGODA_CITY_IDS);
}
