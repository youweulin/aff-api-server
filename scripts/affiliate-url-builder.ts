/**
 * 智能聯盟連結建構器
 * 根據平台和查詢內容動態生成正確的聯盟連結
 */

interface AffiliateLinkParams {
  platform: 'kkday' | 'klook' | 'agoda';
  query: string;
  category?: string;
  region?: string;
  membershipLevel?: string;
}

export class AffiliateUrlBuilder {
  /**
   * 從查詢中提取地點資訊
   */
  private static extractLocation(query: string): string {
    const locations = {
      '東京': 'tokyo',
      '大阪': 'osaka', 
      '京都': 'kyoto',
      '北海道': 'hokkaido',
      '沖繩': 'okinawa',
      '福岡': 'fukuoka',
      '名古屋': 'nagoya',
      '橫濱': 'yokohama',
      '神戶': 'kobe',
      '奈良': 'nara',
      '淺草': 'tokyo', // 淺草屬於東京
      '新宿': 'tokyo',
      '澀谷': 'tokyo',
      '銀座': 'tokyo',
      '上野': 'tokyo',
      '原宿': 'tokyo',
      '心齋橋': 'osaka',
      '道頓堀': 'osaka',
      '清水寺': 'kyoto',
      '金閣寺': 'kyoto',
      '函館': 'hokkaido',
      '札幌': 'hokkaido'
    };

    // 檢查查詢中是否包含地點
    for (const [chinese, english] of Object.entries(locations)) {
      if (query.includes(chinese)) {
        return english;
      }
    }

    return 'japan'; // 預設日本
  }

  /**
   * 建構 KKday 連結
   */
  private static buildKKdayUrl(params: AffiliateLinkParams): string {
    const baseUrl = 'https://www.kkday.com/zh-tw';
    const cid = '14336';
    
    // 判斷是否為一日遊查詢
    const isDayTour = params.query.includes('一日遊') || params.query.includes('day tour');
    const location = this.extractLocation(params.query);
    
    let encodedQuery;
    
    if (isDayTour && location !== 'japan') {
      // 一日遊使用更精確的搜尋詞
      const locationMap: Record<string, string> = {
        'osaka': '大阪',
        'tokyo': '東京',
        'kyoto': '京都',
        'okinawa': '沖繩',
        'hokkaido': '北海道'
      };
      const locationName = locationMap[location] || location;
      encodedQuery = encodeURIComponent(locationName + '一日遊');
    } else if (params.query.includes('門票') || params.query.includes('票券')) {
      // 門票類保留完整查詢
      encodedQuery = encodeURIComponent(params.query);
    } else {
      // 其他情況使用簡化查詢
      const simplifiedQuery = this.simplifyQueryForKKday(params.query);
      encodedQuery = encodeURIComponent(simplifiedQuery);
    }
    
    // 使用正確的 KKday URL 格式：productlist + 編碼的關鍵字
    const url = `${baseUrl}/product/productlist/${encodedQuery}`;
    const urlObj = new URL(url);
    
    // 添加聯盟 ID
    urlObj.searchParams.set('cid', cid);
    
    // 添加會員標籤
    if (params.membershipLevel && params.membershipLevel !== 'free') {
      urlObj.searchParams.set('tag', params.membershipLevel);
    }

    return urlObj.toString();
  }

  /**
   * 為 KKday 簡化查詢關鍵字
   */
  private static simplifyQueryForKKday(query: string): string {
    // 特殊處理一日遊
    if (query.includes('一日遊')) {
      return query; // 保持原樣，不簡化
    }
    
    // KKday 搜尋關鍵字映射表
    const keywordMappings: Record<string, string> = {
      // 和服相關
      '想在淺草體驗和服': '淺草和服',
      '淺草和服體驗': '淺草和服',
      '東京和服': '和服',
      '京都和服': '京都和服',
      
      // WiFi相關
      '日本旅遊需要wifi機嗎': 'wifi',
      '日本wifi機': 'wifi',
      '日本上網': 'wifi',
      
      // 住宿相關
      '東京住宿推薦': '東京',
      '大阪住宿': '大阪',
      '京都住宿': '京都',
      
      // 交通相關
      'jr pass': 'JR PASS',
      '日本交通': '交通',
      
      // 一般簡化規則
      '推薦': '',
      '建議': '',
      '需要': '',
      '怎麼': '',
      '如何': '',
      '什麼': '',
      '哪裡': ''
    };
    
    // 先檢查完全匹配
    if (keywordMappings[query]) {
      return keywordMappings[query];
    }
    
    // 應用簡化規則
    let simplified = query;
    for (const [pattern, replacement] of Object.entries(keywordMappings)) {
      if (pattern.length <= 3) { // 短詞直接替換
        simplified = simplified.replace(new RegExp(pattern, 'g'), replacement);
      }
    }
    
    // 提取核心關鍵字
    const coreKeywords = simplified.match(/[和服|wifi|東京|大阪|京都|沖繩|福岡|名古屋|JR|交通|門票|體驗|一日遊]+/g);
    if (coreKeywords && coreKeywords.length > 0) {
      return coreKeywords[0];
    }
    
    // 如果沒有匹配，返回去除無用詞的版本
    return simplified
      .replace(/[想要|需要|推薦|建議|怎麼|如何|什麼|哪裡|請問|可以|比較好|最好的]/g, '')
      .trim() || query;
  }

  /**
   * 建構 Klook 連結
   */
  private static buildKlookUrl(params: AffiliateLinkParams): string {
    const baseUrl = 'https://www.klook.com/zh-TW';
    const aid = '30600';
    
    // Klook 使用 search/result 頁面格式，保持完整查詢（長句查得到）
    let url = `${baseUrl}/search/result/`;
    
    const urlObj = new URL(url);
    urlObj.searchParams.set('query', params.query); // 保持原始查詢不簡化
    urlObj.searchParams.set('aid', aid);
    
    // 添加地點篩選（如果能識別出地點）
    const location = this.extractLocation(params.query);
    if (location !== 'japan' && location) {
      // Klook 使用地點名稱作為篩選
      urlObj.searchParams.set('location', location);
    }
    
    return urlObj.toString();
  }
  
  /**
   * 獲取 Klook 城市 ID
   */
  private static getKlookCityId(location: string): string {
    const cityIds: Record<string, string> = {
      'tokyo': '28',
      'osaka': '29',
      'kyoto': '30',
      'hokkaido': '332',
      'okinawa': '333',
      'fukuoka': '347'
    };
    
    return cityIds[location] || '';
  }

  /**
   * 建構 Agoda 連結
   */
  private static buildAgodaUrl(params: AffiliateLinkParams): string {
    const baseUrl = 'https://www.agoda.com/zh-tw';
    const cid = '1913061';
    
    // Agoda 搜尋頁面
    const url = `${baseUrl}/search`;
    
    const urlObj = new URL(url);
    urlObj.searchParams.set('q', params.query); // 使用 q 參數而不是 city
    urlObj.searchParams.set('cid', cid);
    urlObj.searchParams.set('locale', 'zh-tw');
    urlObj.searchParams.set('languageId', '9');
    
    // 添加日本相關參數
    urlObj.searchParams.set('countryId', '106'); // 日本的國家代碼
    
    // 如果能提取出城市，添加城市 ID
    const cityId = this.getCityId(params.query);
    if (cityId) {
      urlObj.searchParams.set('city', cityId);
    }
    
    return urlObj.toString();
  }
  
  /**
   * 獲取 Agoda 城市 ID
   */
  private static getCityId(query: string): string {
    const cityIds: Record<string, string> = {
      '東京': '4665',
      '大阪': '4831',
      '京都': '4834',
      '福岡': '4871',
      '札幌': '4885',
      '沖繩': '4912',
      '名古屋': '4839',
      '橫濱': '4730',
      '神戶': '4827',
      '奈良': '4836'
    };
    
    for (const [city, id] of Object.entries(cityIds)) {
      if (query.includes(city)) {
        return id;
      }
    }
    
    return '';
  }

  /**
   * 生成聯盟連結
   */
  static generateLink(params: AffiliateLinkParams): string {
    switch (params.platform) {
      case 'kkday':
        return this.buildKKdayUrl(params);
      case 'klook':
        return this.buildKlookUrl(params);
      case 'agoda':
        return this.buildAgodaUrl(params);
      default:
        throw new Error(`不支援的平台: ${params.platform}`);
    }
  }

  /**
   * 批量生成多個平台的連結
   */
  static generateMultiPlatformLinks(
    query: string,
    category: string,
    membershipLevel: string = 'free'
  ): Record<string, string> {
    const links: Record<string, string> = {};
    
    // 根據類別決定要生成哪些平台的連結
    if (category === 'hotel') {
      links.agoda = this.generateLink({
        platform: 'agoda',
        query,
        category,
        membershipLevel
      });
    } else if (category === 'activity' || category === 'transportation') {
      links.kkday = this.generateLink({
        platform: 'kkday',
        query,
        category,
        membershipLevel
      });
      links.klook = this.generateLink({
        platform: 'klook',
        query,
        category,
        membershipLevel
      });
    } else {
      // 其他類別，生成所有平台連結
      links.kkday = this.generateLink({
        platform: 'kkday',
        query,
        category,
        membershipLevel
      });
      links.klook = this.generateLink({
        platform: 'klook',
        query,
        category,
        membershipLevel
      });
      links.agoda = this.generateLink({
        platform: 'agoda',
        query,
        category,
        membershipLevel
      });
    }
    
    return links;
  }

  /**
   * 驗證並修正連結
   */
  static validateAndFixUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // 確保使用 HTTPS
      if (urlObj.protocol !== 'https:') {
        urlObj.protocol = 'https:';
      }
      
      // 修正常見問題
      if (url.includes('kkday.com')) {
        // 確保有 CID
        if (!urlObj.searchParams.has('cid')) {
          urlObj.searchParams.set('cid', '14336');
        }
      } else if (url.includes('klook.com')) {
        // 確保有 AID
        if (!urlObj.searchParams.has('aid')) {
          urlObj.searchParams.set('aid', '30600');
        }
      } else if (url.includes('agoda.com')) {
        // 確保有 CID
        if (!urlObj.searchParams.has('cid')) {
          urlObj.searchParams.set('cid', '1913061');
        }
      }
      
      return urlObj.toString();
    } catch (error) {
      console.error('無效的 URL:', url, error);
      return url; // 返回原始 URL
    }
  }
}

// 使用範例
export function generateAffiliateLinks(
  query: string,
  category: string,
  membershipLevel: string = 'free'
): Array<{ platform: string; url: string; title: string }> {
  const links = AffiliateUrlBuilder.generateMultiPlatformLinks(
    query,
    category,
    membershipLevel
  );

  return Object.entries(links).map(([platform, url]) => {
    // 清理查詢字串中的括號內容
    const cleanQuery = query
      .replace(/[（(][^)）]*[)）]/g, '') // 移除括號及其內容
      .replace(/\s+/g, ' ') // 清理多餘空格
      .trim();
    
    return {
      platform,
      url: AffiliateUrlBuilder.validateAndFixUrl(url),
      title: `${cleanQuery} - ${platform.toUpperCase()}`,
      category
    };
  });
}