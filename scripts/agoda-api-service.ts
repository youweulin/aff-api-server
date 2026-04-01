/**
 * Agoda Affiliate Lite API 服務
 * 使用即時 API 查詢取代本地資料庫
 */

import axios from 'axios';

// API 配置
const AGODA_API_CONFIG = {
  endpoint: 'https://affiliateapi7643.agoda.com/affiliateservice/lt_v1', // 改用 HTTPS
  siteId: '1913061',
  apiKey: '67077ce3-c505-4f2b-815a-a2b84306c2a7'
};

// 城市 ID 對照表 (根據 Agoda URL 確認)
const CITY_IDS: Record<string, number> = {
  '東京': 5085,   // 從 Agoda URL 確認的正確 ID
  '大阪': 9590,   // 已確認有效 (從 Agoda URL 取得)
  '京都': 1784,   // 已確認有效 (從 Agoda URL 取得)
  '福岡': 16527,  // 已確認有效 (從 Agoda URL 取得)
  '札幌': 3435,   // 已確認有效 (從 Agoda URL 取得)
  '名古屋': 13740, // 已確認有效 (從 Agoda URL 取得)
  '橫濱': 4590,   // 已確認有效 (從 Agoda URL 取得)
  '神戶': 5085,   // 臨時使用東京 ID，待找到正確的神戶 ID
  '奈良': 5085,   // 臨時使用東京 ID，待找到正確的奈良 ID
  '沖繩': 5085,   // 臨時使用東京 ID，待找到正確的沖繩 ID
  '那霸': 5085,   // 臨時使用東京 ID，待找到正確的那霸 ID
  '箱根': 5085,   // 臨時使用東京 ID，待找到正確的箱根 ID
  '鎌倉': 5085,   // 臨時使用東京 ID，待找到正確的鎌倉 ID
  '日光': 5085,   // 臨時使用東京 ID，待找到正確的日光 ID
  '富士': 5085    // 臨時使用東京 ID，待找到正確的富士 ID
};

// 請求介面
interface AgodaSearchRequest {
  criteria: {
    additional?: {
      currency: string;
      language: string;
      occupancy: {
        numberOfAdult: number;
        numberOfChildren?: number;
        childAges?: number[];
      };
    };
    checkInDate: string; // yyyy-MM-dd
    checkOutDate: string; // yyyy-MM-dd
    cityId?: number;
    hotelId?: number[];
    filterCriteria?: {
      minPrice?: number;
      maxPrice?: number;
      minStarRating?: number;
      minReviewScore?: number;
    };
  };
}

// 回應介面
interface AgodaHotel {
  hotelId: number;
  hotelName: string;
  starRating: number;
  reviewScore: number;
  numberOfReviews: number;
  address: string;
  dailyRate: number;
  crossedOutRate?: number;
  discount?: number;
  imageURL: string;
  landingURL: string; // 這是包含 CID 的完整聯盟連結！
}

interface AgodaSearchResponse {
  results: AgodaHotel[];
}

export class AgodaApiService {
  private static instance: AgodaApiService;
  
  private constructor() {}
  
  static getInstance(): AgodaApiService {
    if (!AgodaApiService.instance) {
      AgodaApiService.instance = new AgodaApiService();
    }
    return AgodaApiService.instance;
  }

  /**
   * 根據城市搜尋飯店
   */
  async searchByCity(
    cityName: string,
    checkIn: Date,
    checkOut: Date,
    adults: number = 2,
    filters?: {
      minPrice?: number;
      maxPrice?: number;
      minStarRating?: number;
      minReviewScore?: number;
    }
  ): Promise<AgodaHotel[]> {
    const cityId = CITY_IDS[cityName];
    if (!cityId) {
      console.warn(`找不到城市 ID: ${cityName}，使用東京作為預設`);
    }

    const request: AgodaSearchRequest = {
      criteria: {
        additional: {
          currency: 'TWD',
          language: 'zh-tw',
          occupancy: {
            numberOfAdult: adults
          }
        },
        checkInDate: this.formatDate(checkIn),
        checkOutDate: this.formatDate(checkOut),
        cityId: cityId || CITY_IDS['東京'],
        filterCriteria: filters
      }
    };

    return this.executeSearch(request);
  }

  /**
   * 根據飯店 ID 列表搜尋
   */
  async searchByHotelIds(
    hotelIds: number[],
    checkIn: Date,
    checkOut: Date,
    adults: number = 2
  ): Promise<AgodaHotel[]> {
    const request: AgodaSearchRequest = {
      criteria: {
        additional: {
          currency: 'TWD',
          language: 'zh-tw',
          occupancy: {
            numberOfAdult: adults
          }
        },
        checkInDate: this.formatDate(checkIn),
        checkOutDate: this.formatDate(checkOut),
        hotelId: hotelIds
      }
    };

    return this.executeSearch(request);
  }

  /**
   * 智能搜尋 - 根據用戶查詢自動判斷搜尋方式
   */
  async smartSearch(query: string, membershipLevel: string = 'free'): Promise<{
    hotels: AgodaHotel[];
    searchType: 'city' | 'keyword';
    query: string;
  }> {
    // 提取城市名稱
    let cityName = '';
    let searchKeyword = query;
    
    for (const city of Object.keys(CITY_IDS)) {
      if (query.includes(city)) {
        cityName = city;
        break;
      }
    }

    // 設定日期（預設明天入住，後天退房）
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

    // 根據會員等級設定篩選條件
    const filters = this.getFiltersByMembership(membershipLevel);

    let hotels: AgodaHotel[] = [];
    
    if (cityName) {
      // 有城市名稱，使用城市搜尋
      hotels = await this.searchByCity(cityName, checkIn, checkOut, 2, filters);
      
      // 檢查結果是否正確（智能驗證）
      const hasRelevantHotels = hotels.some(hotel => {
        const hotelText = `${hotel.hotelName} ${hotel.address || ''}`.toLowerCase();
        
        // 直接城市名稱匹配
        if (hotelText.includes(cityName.toLowerCase()) || 
            hotelText.includes('東京') || hotelText.includes('tokyo')) {
          return true;
        }
        
        // 東京地區/車站名稱匹配
        if (cityName === '東京') {
          const tokyoAreas = [
            'shinjuku', '新宿', 'shibuya', '澀谷', 'ginza', '銀座',
            'asakusa', '淺草', 'harajuku', '原宿', 'ueno', '上野',
            'akihabara', '秋葉原', 'ikebukuro', '池袋', 'roppongi', '六本木',
            'haneda', '羽田', 'narita', '成田', 'odaiba', '台場',
            'tsukiji', '築地', 'marunouchi', '丸之內', 'nihonbashi', '日本橋'
          ];
          
          return tokyoAreas.some(area => hotelText.includes(area));
        }
        
        // 其他城市的地標匹配
        if (cityName === '大阪') {
          return ['osaka', 'umeda', '梅田', 'namba', '難波', 'dotonbori', '道頓堀', 
                  'shinsekai', '新世界', 'tennoji', '天王寺'].some(area => hotelText.includes(area));
        }
        
        if (cityName === '京都') {
          return ['kyoto', 'gion', '祇園', 'kiyomizu', '清水', 'fushimi', '伏見',
                  'arashiyama', '嵐山', 'kawaramachi', '河原町'].some(area => hotelText.includes(area));
        }
        
        return false;
      });
      
      if (!hasRelevantHotels && hotels.length > 0) {
        console.warn(`城市 ${cityName} 的搜尋結果可能不正確，但仍返回結果`);
      }
      
      // 根據關鍵字進一步篩選
      if (searchKeyword !== cityName && searchKeyword.includes(cityName)) {
        const keywordWithoutCity = searchKeyword.replace(cityName, '').trim();
        if (keywordWithoutCity) {
          hotels = this.filterHotelsByKeyword(hotels, keywordWithoutCity);
        }
      }
    } else {
      // 沒有城市名稱，搜尋東京作為預設
      hotels = await this.searchByCity('東京', checkIn, checkOut, 2, filters);
    }

    // 根據會員等級限制數量
    const limits = { free: 3, plus: 5, b: 10, a: 20 };
    const limit = limits[membershipLevel as keyof typeof limits] || 3;
    
    return {
      hotels: hotels.slice(0, limit),
      searchType: cityName ? 'city' : 'keyword',
      query: searchKeyword
    };
    
    /* 
    // 以下代碼待城市 ID 問題解決後啟用
    
    // 提取城市名稱
    let cityName = '';
    let searchKeyword = query;
    
    for (const city of Object.keys(CITY_IDS)) {
      if (query.includes(city)) {
        cityName = city;
        break;
      }
    }

    // 設定日期（預設明天入住，後天退房）
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

    // 根據會員等級設定篩選條件
    const filters = this.getFiltersByMembership(membershipLevel);

    let hotels: AgodaHotel[] = [];
    
    if (cityName) {
      // 有城市名稱，使用城市搜尋
      hotels = await this.searchByCity(cityName, checkIn, checkOut, 2, filters);
      
      // 檢查結果是否正確（簡單驗證）
      const hasRelevantHotels = hotels.some(hotel => 
        hotel.hotelName.includes(cityName) || 
        (hotel.address && hotel.address.includes(cityName))
      );
      
      if (!hasRelevantHotels) {
        console.warn(\`城市 \${cityName} 的搜尋結果可能不正確，返回空結果\`);
        hotels = [];
      }
      
      // 根據關鍵字進一步篩選
      if (searchKeyword !== cityName && searchKeyword.includes(cityName)) {
        const keywordWithoutCity = searchKeyword.replace(cityName, '').trim();
        if (keywordWithoutCity) {
          hotels = this.filterHotelsByKeyword(hotels, keywordWithoutCity);
        }
      }
    } else {
      // 沒有城市名稱，返回空結果避免錯誤推薦
      hotels = [];
    }

    // 根據會員等級限制數量
    const limits = { free: 3, plus: 5, b: 10, a: 20 };
    const limit = limits[membershipLevel as keyof typeof limits] || 3;
    
    return {
      hotels: hotels.slice(0, limit),
      searchType: cityName ? 'city' : 'keyword',
      query: searchKeyword
    };
    */
  }

  /**
   * 執行 API 請求
   */
  private async executeSearch(request: AgodaSearchRequest): Promise<AgodaHotel[]> {
    try {
      console.log('🔍 Agoda API 請求開始');
      console.log('🌐 環境檢測: ', typeof window !== 'undefined' ? '瀏覽器' : '伺服器');
      console.log('📦 請求內容:', JSON.stringify(request, null, 2));
      
      // 檢查是否在瀏覽器環境
      if (typeof window !== 'undefined') {
        console.log('✅ 使用後端代理: /api/agoda/search');
        // 在瀏覽器環境，使用後端 API 代理
        const response = await fetch('/api/agoda/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request)
        });

        if (!response.ok) {
          console.error('❌ 後端 API 錯誤:', response.status);
          const errorData = await response.json();
          console.error('📝 錯誤詳情:', errorData);
          return [];
        }

        const data = await response.json();
        if (data && data.results) {
          console.log(`✅ Agoda API 成功回傳 ${data.results.length} 個結果`);
          return data.results;
        }
        console.warn('⚠️ 後端 API 回傳空結果');
        return [];
      } else {
        // 在服務器環境，直接調用 Agoda API
        const response = await axios.post<AgodaSearchResponse>(
          AGODA_API_CONFIG.endpoint,
          request,
          {
            headers: {
              'Authorization': `${AGODA_API_CONFIG.siteId}:${AGODA_API_CONFIG.apiKey}`,
              'Accept-Encoding': 'gzip,deflate',
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        if (response.data && response.data.results) {
          console.log(`Agoda API 回傳 ${response.data.results.length} 個結果`);
          return response.data.results;
        }
        return [];
      }
    } catch (error) {
      console.error('Agoda API 錯誤:', error);
      
      // 如果是網路錯誤，返回空陣列而不是拋出錯誤
      if (axios.isAxiosError(error)) {
        console.error('API 請求失敗:', error.message);
        if (error.response) {
          console.error('錯誤狀態碼:', error.response.status);
          console.error('錯誤回應:', JSON.stringify(error.response.data, null, 2));
        }
        return [];
      }
      
      return [];
    }
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 根據會員等級獲取篩選條件
   */
  private getFiltersByMembership(level: string): any {
    const filters = {
      free: {
        minReviewScore: 7.0,
        maxPrice: 5000
      },
      plus: {
        minReviewScore: 7.5,
        maxPrice: 10000
      },
      b: {
        minReviewScore: 8.0,
        minStarRating: 3
      },
      a: {
        minReviewScore: 8.5,
        minStarRating: 4
      }
    };

    return filters[level as keyof typeof filters] || filters.free;
  }

  /**
   * 根據關鍵字篩選飯店
   */
  private filterHotelsByKeyword(hotels: AgodaHotel[], keyword: string): AgodaHotel[] {
    const lowerKeyword = keyword.toLowerCase();
    
    return hotels.filter(hotel => {
      const hotelInfo = `${hotel.hotelName} ${hotel.address}`.toLowerCase();
      
      // 特殊關鍵字處理
      if (lowerKeyword.includes('便宜') || lowerKeyword.includes('平價')) {
        return hotel.dailyRate < 3000;
      }
      if (lowerKeyword.includes('高級') || lowerKeyword.includes('豪華')) {
        return hotel.starRating >= 4;
      }
      if (lowerKeyword.includes('車站')) {
        return hotelInfo.includes('駅') || hotelInfo.includes('station');
      }
      if (lowerKeyword.includes('推薦') || lowerKeyword.includes('住宿')) {
        // 如果只是一般推薦或住宿，返回所有飯店
        return true;
      }
      
      // 一般關鍵字匹配
      return hotelInfo.includes(lowerKeyword);
    });
  }

  /**
   * 格式化飯店資訊為聯盟連結
   */
  formatHotelAsAffiliateLink(hotel: AgodaHotel): {
    platform: string;
    url: string;
    title: string;
    category: string;
    metadata: {
      hotelId: number;
      price: number;
      rating: number;
      discount?: number;
      image: string;
    };
  } {
    return {
      platform: 'agoda',
      url: hotel.landingURL, // 已經包含 CID 的完整連結！
      title: hotel.hotelName,
      category: 'hotel',
      metadata: {
        hotelId: hotel.hotelId,
        price: hotel.dailyRate,
        rating: hotel.reviewScore,
        discount: hotel.discount,
        image: hotel.imageURL
      }
    };
  }
}

// 導出單例
export const agodaApiService = AgodaApiService.getInstance();