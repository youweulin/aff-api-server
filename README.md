# GoSavor Affiliate API Server

GoSavor 聯盟行銷廣告推薦 API。根據用戶的掃描情境（地點、類型）動態推薦 Klook/KKDay 商品。

## 架構

```
GoSavor App → GET /api/ads?city=osaka&type=food&lang=zh-TW
                ↓
            API Server（Cloudflare Workers）
                ↓
            回傳 2-3 個推薦商品（含追蹤連結）
                ↓
            用戶點擊 → POST /api/ads/click → 跳轉商品頁
```

## 架構原則

**Server = 純資料供應商，不做判斷。App = 所有智慧邏輯在本地。**

```
App 本地判斷：                      API Server：
├── GPS 定位 → 哪個城市              ├── 儲存商品資料
├── 時間 → 早/中/晚                  ├── 定期爬蟲更新
├── 掃描類型 → 要什麼分類            ├── 查詢 API
├── 用戶行為 → 推薦優先級            ├── 記錄點擊
└── 組合參數 → 呼叫 API              └── 管理後台
```

## API 規格

### GET /api/products
查詢商品（純資料，不做推薦判斷）

**Query Parameters:**
| 參數 | 說明 | 範例 |
|------|------|------|
| region | 地區 | Tokyo, Kansai, Kyushu |
| category | 分類 | ticket, tour, food, transport, shopping |
| platform | 平台 | klook, kkday, agoda |
| lang | 語言 | zh-TW, en, ko |
| limit | 數量 | 10 (預設) |

**Response:**
```json
{
  "products": [
    {
      "id": "klook_601",
      "platform": "klook",
      "title": "富士山及箱根一日遊",
      "imageUrl": "https://...",
      "affiliateUrl": "https://www.klook.com/zh-TW/activity/601/?aid=30600",
      "category": "tour",
      "region": "Tokyo",
      "price": 8900,
      "currency": "TWD",
      "active": true,
      "updatedAt": "2026-04-01"
    }
  ]
}
```

### POST /api/clicks
記錄點擊（分析用）

**Body:**
```json
{
  "productId": "klook_601",
  "region": "Tokyo",
  "category": "tour",
  "timestamp": 1711900000000
}
```

## Server 定期任務（Cron）

| 頻率 | 任務 |
|------|------|
| 每天 | 檢查商品連結是否有效 |
| 每週 | 爬蟲更新 Klook/KKDay 最新商品 |
| 每月 | 更新 Agoda 飯店資料 |
| 即時 | 管理後台手動新增/停用 |

## 聯盟行銷帳號

| 平台 | Affiliate ID | 連結格式 |
|------|-------------|---------|
| **Klook** | `30600` | `klook.com/zh-TW/activity/{id}/?aid=30600` |
| **KKDay** | `14336` | `kkday.com/zh-tw/product/{id}?cid=14336` |
| **Agoda** | `1913061` | `agoda.com/...?cid=1913061` |
| **Expedia/Hotels.com** | `1100l5zpRT` | CJ affiliate network, `camref=1100l5zpRT` |

## 現有資料

### 商品資料庫
| 檔案 | 說明 | 數量 |
|------|------|------|
| `data/klook_products.json` | Klook 日本旅遊商品 | 700 個 |
| `data/kkday_tokyo.json` | KKDay 東京商品（需更新連結） | ~20 個 |
| `data/kkday_osaka.json` | KKDay 大阪商品（需更新連結） | ~20 個 |
| `data/japan_hotels_optimized.csv` | Agoda 日本飯店（含 affiliate link） | **43,000 間** |
| `data/agodaCityIds.js` | Agoda 城市 ID 對照表 | 全日本 |

### 爬蟲 & 工具
| 檔案 | 說明 |
|------|------|
| `scripts/kkday_scraper.py` | KKDay 商品爬蟲（Python） |
| `scripts/kkday-scraper.ts` | KKDay 爬蟲（TypeScript） |
| `scripts/klookService.ts` | Klook 搜尋服務（Fuse.js 模糊搜尋） |
| `scripts/affiliate-url-builder.ts` | 聯盟連結產生器（Klook + KKDay） |
| `scripts/agoda-api-client.ts` | Agoda API 客戶端 |
| `scripts/agoda-api-service.ts` | Agoda 搜尋服務 |
| `scripts/agodaService.ts` | Agoda 住宿服務 |

### 參考元件（來自 GoSavor / jptg2026）
| 檔案 | 說明 |
|------|------|
| `scripts/HotelSearchModal.tsx` | 飯店搜尋 UI（Agoda/Expedia/Hotels.com/Klook 四合一） |
| `scripts/FlightCard.tsx` | 機票搜尋（Expedia/Skyscanner affiliate） |

## 部署方案

| 方案 | 費用 | 額度 |
|------|------|------|
| Cloudflare Workers | 免費 | 10萬次/天 |
| Firebase Functions | 免費 | 200萬次/月 |
| Vercel Edge | 免費 | 100萬次/月 |

## TODO

- [ ] 建立 Cloudflare Worker
- [ ] 匯入商品資料到 D1 Database
- [ ] 實作 GET /api/ads 端點
- [ ] 實作 POST /api/ads/click 追蹤
- [ ] 更新 KKDay 商品連結（舊的已失效）
- [ ] 建立管理後台（新增/停用商品）
- [ ] GoSavor App 改用 API 取代內建 JSON
- [ ] 加入季節性推薦（櫻花季、楓葉季等）
