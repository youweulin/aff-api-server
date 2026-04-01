#!/usr/bin/env python3
"""
KKday 日本旅遊商品爬蟲系統
從 KKday 網站抓取日本旅遊商品資訊

使用方法:
python kkday_scraper.py

需求套件:
pip install selenium beautifulsoup4 requests pandas
"""

import json
import time
import random
import requests
import pandas as pd
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('kkday_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class KKdayScraper:
    def __init__(self):
        self.base_url = "https://www.kkday.com"
        self.japan_url = "https://www.kkday.com/zh-tw/destination/jp-japan"
        self.affiliate_cid = "14336"
        self.scraped_products = []
        self.session = requests.Session()
        
        # 設定 Chrome 選項
        self.chrome_options = Options()
        self.chrome_options.add_argument('--headless')
        self.chrome_options.add_argument('--no-sandbox')
        self.chrome_options.add_argument('--disable-dev-shm-usage')
        self.chrome_options.add_argument('--window-size=1920,1080')
        self.chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # 日本主要城市/地區對應
        self.japan_regions = {
            'jp-tokyo': '東京',
            'jp-osaka': '大阪',
            'jp-kyoto': '京都',
            'jp-hokkaido': '北海道',
            'jp-nagoya': '名古屋',
            'jp-fukuoka': '福岡',
            'jp-sapporo': '札幌',
            'jp-hiroshima': '廣島',
            'jp-nara': '奈良',
            'jp-kanazawa': '金澤',
            'jp-yokohama': '橫濱',
            'jp-okinawa': '沖繩'
        }
        
        # 分類關鍵詞
        self.category_keywords = {
            '交通': ['JR', '地鐵', '巴士', '電車', 'Pass', 'Suica', '車票', '乘車券', '交通票'],
            '門票': ['門票', '入場券', '迪士尼', 'Disney', 'USJ', '環球影城', '水族館', '展望台'],
            '體驗': ['體驗', '和服', '浴衣', '茶道', '溫泉', '滑雪', '旅拍', '料理', '手作'],
            '導覽': ['一日遊', '半日遊', '導覽', '包車', '遊覽團', '觀光', '旅遊團'],
            '上網卡': ['SIM', 'WiFi', 'eSIM', '上網卡', '網路', '漫遊', '行動網路']
        }
    
    def init_driver(self):
        """初始化 Chrome WebDriver"""
        try:
            driver = webdriver.Chrome(options=self.chrome_options)
            driver.implicitly_wait(10)
            return driver
        except Exception as e:
            logger.error(f"無法初始化 Chrome WebDriver: {e}")
            raise
    
    def get_affiliate_url(self, original_url):
        """生成聯盟連結"""
        separator = '&' if '?' in original_url else '?'
        return f"{original_url}{separator}cid={self.affiliate_cid}"
    
    def classify_region(self, title, description=""):
        """根據標題和描述分類地區"""
        text = f"{title} {description}".lower()
        
        region_keywords = {
            '東京': ['東京', 'tokyo', '新宿', '渋谷', '原宿', '銀座', '淺草', '上野', '池袋', '秋葉原'],
            '大阪': ['大阪', 'osaka', '梅田', '難波', '心齋橋', '天王寺', '道頓堀', '通天閣', '大阪城'],
            '京都': ['京都', 'kyoto', '嵐山', '祇園', '清水寺', '金閣寺', '銀閣寺', '伏見', '二條城'],
            '北海道': ['北海道', 'hokkaido', '札幌', '函館', '旭川', '釧路', '帶廣', '富良野', '美瑛'],
            '沖繩': ['沖繩', 'okinawa', '那覇', '石垣', '宮古島', '美ら海', '首里城', '國際通'],
            '名古屋': ['名古屋', 'nagoya', '愛知', '名古屋城', '熱田神宮', '覺王山'],
            '福岡': ['福岡', 'fukuoka', '博多', '天神', '太宰府', '柳川', '久留米'],
            '廣島': ['廣島', 'hiroshima', '宮島', '厳島神社', '原爆', '平和公園', '尾道'],
            '奈良': ['奈良', 'nara', '東大寺', '春日大社', '奈良公園', '法隆寺', '吉野山'],
            '金澤': ['金澤', 'kanazawa', '兼六園', '東茶屋街', '金沢城', '近江町市場'],
            '橫濱': ['橫濱', 'yokohama', 'みなとみらい', '中華街', '山下公園', '赤レンガ倉庫'],
            '箱根': ['箱根', 'hakone', '芦ノ湖', '大涌谷', '強羅', '温泉', '富士山'],
            '日光': ['日光', 'nikko', '東照宮', '華厳の滝', '中禅寺湖', '鬼怒川']
        }
        
        for region, keywords in region_keywords.items():
            if any(keyword in text for keyword in keywords):
                return region
        
        return '其他'
    
    def classify_category(self, title, description=""):
        """根據標題和描述分類類別"""
        text = f"{title} {description}".lower()
        
        for category, keywords in self.category_keywords.items():
            if any(keyword.lower() in text for keyword in keywords):
                return category
        
        return '其他'
    
    def extract_product_info(self, driver, product_element):
        """從商品元素中提取資訊"""
        try:
            # 商品標題
            title_element = product_element.find_element(By.CSS_SELECTOR, 'h3, .product-title, [data-testid="product-title"]')
            title = title_element.text.strip() if title_element else ""
            
            # 商品URL
            link_element = product_element.find_element(By.CSS_SELECTOR, 'a')
            relative_url = link_element.get_attribute('href') if link_element else ""
            url = urljoin(self.base_url, relative_url) if relative_url else ""
            
            # 商品圖片
            img_element = product_element.find_element(By.CSS_SELECTOR, 'img')
            image_url = img_element.get_attribute('src') if img_element else ""
            
            # 價格
            price_element = product_element.find_element(By.CSS_SELECTOR, '.price, [data-testid="price"]')
            price = price_element.text.strip() if price_element else ""
            
            # 描述 (可能需要進入商品頁面獲取)
            description = ""
            
            # 評分
            rating = None
            review_count = None
            
            try:
                rating_element = product_element.find_element(By.CSS_SELECTOR, '.rating, .star-rating')
                rating_text = rating_element.text if rating_element else ""
                if rating_text:
                    rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                    if rating_match:
                        rating = float(rating_match.group(1))
            except:
                pass
            
            try:
                review_element = product_element.find_element(By.CSS_SELECTOR, '.review-count, .reviews')
                review_text = review_element.text if review_element else ""
                if review_text:
                    review_match = re.search(r'(\d+)', review_text)
                    if review_match:
                        review_count = int(review_match.group(1))
            except:
                pass
            
            if title and url:
                return {
                    'title': title,
                    'url': url,
                    'image_url': image_url,
                    'price': price,
                    'description': description,
                    'rating': rating,
                    'review_count': review_count
                }
            
        except Exception as e:
            logger.debug(f"提取商品資訊失敗: {e}")
            
        return None
    
    def scrape_product_list(self, driver, url, max_pages=5):
        """爬取商品列表"""
        products = []
        
        try:
            logger.info(f"開始爬取: {url}")
            driver.get(url)
            
            # 等待頁面載入
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="product-card"], .product-item, .product-card'))
            )
            
            page = 1
            while page <= max_pages:
                logger.info(f"正在處理第 {page} 頁...")
                
                # 滾動到底部以載入更多商品
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                
                # 查找商品元素
                product_elements = driver.find_elements(By.CSS_SELECTOR, '[data-testid="product-card"], .product-item, .product-card')
                
                logger.info(f"找到 {len(product_elements)} 個商品元素")
                
                for element in product_elements:
                    try:
                        product_info = self.extract_product_info(driver, element)
                        if product_info:
                            products.append(product_info)
                            logger.debug(f"成功提取商品: {product_info['title']}")
                    except Exception as e:
                        logger.debug(f"處理商品元素失敗: {e}")
                        continue
                
                # 嘗試點擊下一頁或載入更多
                try:
                    # 查找"載入更多"按鈕
                    load_more_btn = driver.find_element(By.CSS_SELECTOR, '.load-more, [data-testid="load-more"], .btn-load-more')
                    if load_more_btn.is_displayed() and load_more_btn.is_enabled():
                        driver.execute_script("arguments[0].click();", load_more_btn)
                        time.sleep(3)
                        page += 1
                        continue
                except:
                    pass
                
                try:
                    # 查找下一頁按鈕
                    next_btn = driver.find_element(By.CSS_SELECTOR, '.next-page, [data-testid="next-page"], .pagination-next')
                    if next_btn.is_displayed() and next_btn.is_enabled():
                        driver.execute_script("arguments[0].click();", next_btn)
                        time.sleep(3)
                        page += 1
                        continue
                except:
                    pass
                
                # 如果沒有找到下一頁或載入更多按鈕，結束循環
                break
                
        except TimeoutException:
            logger.error(f"頁面載入超時: {url}")
        except Exception as e:
            logger.error(f"爬取過程中發生錯誤: {e}")
        
        logger.info(f"完成爬取，共獲得 {len(products)} 個商品")
        return products
    
    def scrape_all_regions(self, max_pages_per_region=3):
        """爬取所有地區的商品"""
        driver = self.init_driver()
        
        try:
            # 首先爬取主頁面
            logger.info("開始爬取 KKday 日本主頁面...")
            main_products = self.scrape_product_list(driver, self.japan_url, max_pages_per_region)
            
            for product in main_products:
                # 分類處理
                region = self.classify_region(product['title'], product['description'])
                category = self.classify_category(product['title'], product['description'])
                
                # 生成聯盟連結
                affiliate_url = self.get_affiliate_url(product['url'])
                
                # 生成關鍵詞
                keywords = self.generate_keywords(product['title'], product['description'])
                
                processed_product = {
                    'title': product['title'],
                    'url': product['url'],
                    'platform': 'KKday',
                    'region': region,
                    'category': category,
                    'price': product['price'],
                    'image_url': product['image_url'],
                    'description': product['description'],
                    'affiliate_url': affiliate_url,
                    'rating': product['rating'],
                    'review_count': product['review_count'],
                    'keywords': keywords,
                    'scraped_at': datetime.now().isoformat()
                }
                
                self.scraped_products.append(processed_product)
            
            # 嘗試爬取特定地區頁面
            region_urls = [
                "https://www.kkday.com/zh-tw/city/tokyo",
                "https://www.kkday.com/zh-tw/city/osaka",
                "https://www.kkday.com/zh-tw/city/kyoto",
                "https://www.kkday.com/zh-tw/city/sapporo",
                "https://www.kkday.com/zh-tw/city/fukuoka"
            ]
            
            for region_url in region_urls:
                try:
                    logger.info(f"爬取地區頁面: {region_url}")
                    region_products = self.scrape_product_list(driver, region_url, max_pages_per_region)
                    
                    for product in region_products:
                        # 避免重複
                        if not any(p['url'] == product['url'] for p in self.scraped_products):
                            region = self.classify_region(product['title'], product['description'])
                            category = self.classify_category(product['title'], product['description'])
                            affiliate_url = self.get_affiliate_url(product['url'])
                            keywords = self.generate_keywords(product['title'], product['description'])
                            
                            processed_product = {
                                'title': product['title'],
                                'url': product['url'],
                                'platform': 'KKday',
                                'region': region,
                                'category': category,
                                'price': product['price'],
                                'image_url': product['image_url'],
                                'description': product['description'],
                                'affiliate_url': affiliate_url,
                                'rating': product['rating'],
                                'review_count': product['review_count'],
                                'keywords': keywords,
                                'scraped_at': datetime.now().isoformat()
                            }
                            
                            self.scraped_products.append(processed_product)
                    
                    # 延遲避免被封
                    time.sleep(random.uniform(3, 6))
                    
                except Exception as e:
                    logger.error(f"爬取地區頁面失敗 {region_url}: {e}")
                    continue
            
        finally:
            driver.quit()
        
        logger.info(f"爬取完成，共獲得 {len(self.scraped_products)} 個商品")
        return self.scraped_products
    
    def generate_keywords(self, title, description=""):
        """生成搜尋關鍵詞"""
        import re
        
        text = f"{title} {description}"
        # 提取中文、英文、數字
        words = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+|\d+', text)
        
        keywords = []
        for word in words:
            if len(word) > 1:
                keywords.append(word.lower())
        
        return list(set(keywords))
    
    def save_to_files(self, output_dir="./data"):
        """保存結果到檔案"""
        import os
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存為 CSV
        csv_filename = f"{output_dir}/kkday_products_{timestamp}.csv"
        df = pd.DataFrame(self.scraped_products)
        df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
        logger.info(f"CSV 檔案已保存: {csv_filename}")
        
        # 保存為 JSON
        json_filename = f"{output_dir}/kkday_products_{timestamp}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_products, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON 檔案已保存: {json_filename}")
        
        # 生成統計報告
        self.generate_report(output_dir, timestamp)
        
        return csv_filename, json_filename
    
    def generate_report(self, output_dir, timestamp):
        """生成爬取報告"""
        if not self.scraped_products:
            return
        
        df = pd.DataFrame(self.scraped_products)
        
        report = {
            'scraping_time': datetime.now().isoformat(),
            'total_products': len(self.scraped_products),
            'platform': 'KKday',
            'statistics': {
                'by_region': df['region'].value_counts().to_dict(),
                'by_category': df['category'].value_counts().to_dict(),
                'price_range': {
                    'min': df['price'].min() if 'price' in df.columns else None,
                    'max': df['price'].max() if 'price' in df.columns else None
                },
                'with_rating': df['rating'].notna().sum() if 'rating' in df.columns else 0,
                'with_reviews': df['review_count'].notna().sum() if 'review_count' in df.columns else 0
            }
        }
        
        report_filename = f"{output_dir}/kkday_scraping_report_{timestamp}.json"
        with open(report_filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"爬取報告已保存: {report_filename}")
        
        # 打印統計資訊
        logger.info("=== 爬取統計 ===")
        logger.info(f"總商品數: {report['total_products']}")
        logger.info(f"地區分佈: {report['statistics']['by_region']}")
        logger.info(f"類別分佈: {report['statistics']['by_category']}")

def main():
    """主程式"""
    logger.info("開始 KKday 爬蟲...")
    
    scraper = KKdayScraper()
    
    try:
        # 爬取所有商品
        products = scraper.scrape_all_regions(max_pages_per_region=3)
        
        if products:
            # 保存結果
            csv_file, json_file = scraper.save_to_files()
            logger.info(f"爬取完成，結果已保存至 {csv_file} 和 {json_file}")
        else:
            logger.warning("未爬取到任何商品")
        
    except Exception as e:
        logger.error(f"爬取過程中發生錯誤: {e}")
        raise
    
    logger.info("KKday 爬蟲結束")

if __name__ == "__main__":
    main()