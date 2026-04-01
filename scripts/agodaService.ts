import axios from 'axios';

// The base URL for the backend (using relative path to use Vite proxy)
const API_BASE_URL = '/api';

export interface AgodaHotel {
    hotelId: number;
    name: string;
    rating: number;
    price: number;
    image: string;
    currency?: string;
    address?: string;
    landingURL?: string;
}

export const searchAgodaHotels = async (searchText: string): Promise<AgodaHotel[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/agoda/hotels`, {
            params: { searchText }
        });

        // Adapt response to frontend model
        // Assuming backend returns { results: [] } or standard Agoda response structure we can parse
        if (response.data && response.data.results) {
            return response.data.results;
        }

        return [];
    } catch (error) {
        console.error('Failed to search Agoda hotels:', error);
        return [];
    }
};
