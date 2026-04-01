import Fuse from 'fuse.js';
import klookData from '../../../src/data/klook_products.json';

export interface KlookProduct {
    id: string;
    name: string;
    region: string;
}

const options = {
    includeScore: true,
    keys: ['name', 'region'],
    threshold: 0.35, // 0.0 is perfect match, 0.35 is stricter to avoid bad matches
    ignoreLocation: true // Search anywhere in the string
};

const fuse = new Fuse(klookData, options);

export const klookService = {
    /**
     * Search for Klook products matching the query
     * @param query - The search term (e.g., "Tokyo Tower")
     * @param limit - Max results to return
     * @param threshold - Fuse.js threshold (0.0=exact, 1.0=loose). Default 0.4.
     * @returns Array of matching products
     */
    searchProducts: (query: string, limit: number = 3, threshold: number = 0.4): KlookProduct[] => {
        if (!query || query.length < 2) return [];

        const fuseInstance = new Fuse(klookData, { ...options, threshold });
        let results = fuseInstance.search(query);

        // Return strict top results
        return results.slice(0, limit).map(result => result.item);
    },

    /**
     * Search for Klook products but return a randomized selection from the top matches.
     * Useful for "You might also like" diversity.
     */
    searchRandomProducts: (query: string, limit: number = 3, threshold: number = 0.4): KlookProduct[] => {
        if (!query || query.length < 2) return [];

        const fuseInstance = new Fuse(klookData, { ...options, threshold });
        const results = fuseInstance.search(query);

        // Take top 100 matches as the candidate pool
        const candidates = results.slice(0, 100).map(result => result.item);

        // Fisher-Yates Shuffle
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        return candidates.slice(0, limit);
    },

    /**
     * Generate affiliate link for a product
     * @param productId - The Klook product ID
     * @returns The full affiliate URL
     */
    getAffiliateLink: (productId: string): string => {
        return `https://www.klook.com/zh-TW/activity/${productId}?aid=30600`;
    }
};
