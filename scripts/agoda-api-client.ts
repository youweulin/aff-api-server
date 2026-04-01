/**
 * Agoda API Client - Browser-safe version
 * This file only uses fetch and doesn't import axios
 */

// API 配置
const AGODA_API_CONFIG = {
  siteId: '1913061',
  apiKey: '67077ce3-c505-4f2b-815a-a2b84306c2a7'
};

// 城市 ID 對照表
const CITY_IDS: Record<string, number> = {
  '東京': 5085,   // 已確認有效
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
    checkInDate: string;
    checkOutDate: string;
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
  landingURL: string;
}

export class AgodaApiClient {
  private static instance: AgodaApiClient;
  
  private constructor() {}
  
  static getInstance(): AgodaApiClient {
    if (!AgodaApiClient.instance) {
      AgodaApiClient.instance = new AgodaApiClient();
    }
    return AgodaApiClient.instance;
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
   * 智能搜尋
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
      hotels = await this.searchByCity(cityName, checkIn, checkOut, 2, filters);
      
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
  }

  /**
   * 執行 API 請求 - 只使用 fetch，適用於瀏覽器
   */
  private async executeSearch(request: AgodaSearchRequest): Promise<AgodaHotel[]> {
    try {
      console.log('🔍 Agoda API Client 請求開始');
      console.log('📦 請求內容:', JSON.stringify(request, null, 2));
      
      // 總是使用後端代理
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
        
        // 如果是 401 錯誤，記錄更詳細的資訊
        if (response.status === 401) {
          console.error('🔐 Agoda API 認證失敗 - 請檢查：');
          console.error('1. API Key 是否正確');
          console.error('2. Site ID 是否正確');
          console.error('3. API 配額是否超過限制');
        }
        
        return [];
      }

      const data = await response.json();
      if (data && data.results) {
        console.log(`✅ Agoda API 成功回傳 ${data.results.length} 個結果`);
        return data.results;
      }
      console.warn('⚠️ 後端 API 回傳空結果');
      return [];
    } catch (error) {
      console.error('❌ Agoda API 錯誤:', error);
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
      url: hotel.landingURL,
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
export const agodaApiClient = AgodaApiClient.getInstance();