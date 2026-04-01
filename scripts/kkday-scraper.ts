/**
 * KKday 一日遊行程爬蟲
 */

import * as cheerio from 'cheerio';

export interface KKdayTourData {
  title: string;
  productId: string;
  url: string;
  price: {
    currency: string;
    amount: number;
    originalAmount?: number;
  };
  rating?: {
    score: number;
    count: number;
  };
  duration?: string;
  languages?: string[];
  highlights?: string[];
  itinerary?: Array<{
    time?: string;
    title: string;
    description?: string;
  }>;
  included?: string[];
  excluded?: string[];
  meetingPoint?: string;
  importantInfo?: string[];
  images?: string[];
}

export class KKdayScraper {
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  };

  async scrapeTour(url: string): Promise<KKdayTourData | null> {
    try {
      console.log(`🕷️ 開始爬取 KKday: ${url}`);
      
      // 提取產品 ID
      const productIdMatch = url.match(/\/product\/(\d+)/);
      const productId = productIdMatch ? productIdMatch[1] : '';
      
      // 抓取頁面
      const response = await fetch(url, {
        headers: this.headers,
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // 解析資料
      const tourData: KKdayTourData = {
        title: '',
        productId,
        url,
        price: {
          currency: 'TWD',
          amount: 0
        }
      };

      // 1. 提取標題
      tourData.title = $('h1').first().text().trim() || 
                      $('[class*="product-title"]').first().text().trim() ||
                      $('title').text().split(' - ')[0].trim();

      // 2. 提取價格 - 嘗試多種選擇器
      const priceText = $('[class*="price"]').first().text() ||
                       $('.product-price').text() ||
                       $('[data-price]').attr('data-price') || '';
      
      const priceMatch = priceText.match(/NT\$?\s?([\d,]+)/);
      if (priceMatch) {
        tourData.price.amount = parseInt(priceMatch[1].replace(/,/g, ''));
      }

      // 3. 提取評分
      const ratingText = $('[class*="rating"]').text() || $('.review-score').text();
      const ratingMatch = ratingText.match(/([\d.]+)/);
      if (ratingMatch) {
        const reviewCountMatch = ratingText.match(/\((\d+)/);
        tourData.rating = {
          score: parseFloat(ratingMatch[1]),
          count: reviewCountMatch ? parseInt(reviewCountMatch[1]) : 0
        };
      }

      // 4. 提取行程內容 - 查找行程表區塊
      const itinerary: any[] = [];
      
      // 嘗試多種可能的選擇器
      const itinerarySelectors = [
        '.itinerary-item',
        '[class*="itinerary"]',
        '.schedule-item',
        '.timeline-item'
      ];
      
      for (const selector of itinerarySelectors) {
        if ($(selector).length > 0) {
          $(selector).each((_, elem) => {
            const $item = $(elem);
            const time = $item.find('[class*="time"]').text().trim();
            const title = $item.find('[class*="title"]').text().trim() ||
                         $item.find('h3, h4').first().text().trim();
            const description = $item.find('[class*="description"]').text().trim() ||
                              $item.find('p').first().text().trim();
            
            if (title) {
              itinerary.push({
                time: time || undefined,
                title,
                description: description || undefined
              });
            }
          });
          break;
        }
      }
      
      if (itinerary.length > 0) {
        tourData.itinerary = itinerary;
      }

      // 5. 提取包含/不包含項目
      const findListItems = (keywords: string[]) => {
        const items: string[] = [];
        keywords.forEach(keyword => {
          const $section = $(`h2:contains("${keyword}"), h3:contains("${keyword}")`).first();
          if ($section.length) {
            $section.nextAll('ul').first().find('li').each((_, elem) => {
              items.push($(elem).text().trim());
            });
          }
        });
        return items;
      };

      tourData.included = findListItems(['費用包含', '包含項目', '費用包括']);
      tourData.excluded = findListItems(['費用不包含', '不包含項目', '費用不包括']);

      // 6. 提取集合地點
      const meetingPointKeywords = ['集合地點', '集合地', '出發地點', '上車地點'];
      meetingPointKeywords.forEach(keyword => {
        if (!tourData.meetingPoint) {
          const $meetingSection = $(`*:contains("${keyword}")`).filter((_, elem) => {
            return $(elem).text().includes(keyword) && $(elem).children().length < 3;
          }).first();
          
          if ($meetingSection.length) {
            tourData.meetingPoint = $meetingSection.next().text().trim() ||
                                   $meetingSection.parent().text().replace(keyword, '').trim();
          }
        }
      });

      // 7. 嘗試提取 JSON-LD 結構化資料
      const jsonLdScript = $('script[type="application/ld+json"]').html();
      if (jsonLdScript) {
        try {
          const jsonData = JSON.parse(jsonLdScript);
          console.log('✅ 找到 JSON-LD 資料');
          
          // 從 JSON-LD 補充資訊
          if (jsonData.name && !tourData.title) {
            tourData.title = jsonData.name;
          }
          if (jsonData.offers?.price && !tourData.price.amount) {
            tourData.price.amount = parseFloat(jsonData.offers.price);
          }
          if (jsonData.aggregateRating) {
            tourData.rating = {
              score: parseFloat(jsonData.aggregateRating.ratingValue),
              count: parseInt(jsonData.aggregateRating.reviewCount)
            };
          }
        } catch (e) {
          console.log('❌ JSON-LD 解析失敗');
        }
      }

      // 8. 提取圖片
      const images: string[] = [];
      $('img[src*="kkday"]').each((_, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.includes('icon') && !src.includes('logo')) {
          images.push(src);
        }
      });
      if (images.length > 0) {
        tourData.images = images.slice(0, 5); // 最多保存5張圖
      }

      console.log('✅ 爬取完成:', {
        title: tourData.title,
        price: tourData.price.amount,
        hasItinerary: !!tourData.itinerary?.length
      });

      return tourData;
    } catch (error) {
      console.error('❌ 爬取失敗:', error);
      return null;
    }
  }

  /**
   * 搜尋一日遊行程
   */
  async searchTours(keyword: string, page = 1): Promise<string[]> {
    const searchUrl = `https://www.kkday.com/zh-tw/product/productlist/${encodeURIComponent(keyword)}?page=${page}`;
    
    try {
      const response = await fetch(searchUrl, {
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const productUrls: string[] = [];
      
      // 提取產品連結
      $('a[href*="/product/"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && href.match(/\/product\/\d+/)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.kkday.com${href}`;
          if (!productUrls.includes(fullUrl)) {
            productUrls.push(fullUrl);
          }
        }
      });
      
      console.log(`✅ 找到 ${productUrls.length} 個產品`);
      return productUrls;
    } catch (error) {
      console.error('❌ 搜尋失敗:', error);
      return [];
    }
  }
}

// 測試函數
export async function testKKdayScraper() {
  const scraper = new KKdayScraper();
  
  // 測試單一產品
  const testUrl = 'https://www.kkday.com/zh-tw/product/155289';
  const result = await scraper.scrapeTour(testUrl);
  
  if (result) {
    console.log('\n📊 爬取結果:');
    console.log('標題:', result.title);
    console.log('價格:', result.price);
    console.log('評分:', result.rating);
    console.log('行程數量:', result.itinerary?.length || 0);
    console.log('包含項目:', result.included?.length || 0);
    console.log('不包含項目:', result.excluded?.length || 0);
  }
  
  // 測試搜尋
  console.log('\n🔍 測試搜尋功能...');
  const searchResults = await scraper.searchTours('大阪一日遊');
  console.log('搜尋結果數量:', searchResults.length);
  
  return result;
}