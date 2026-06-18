# 인플루언서 검색 방법 — 전 플랫폼 통합 가이드 (2026년 기준)

> **범위**: 네이버 블로그, Instagram, Facebook, YouTube, TikTok, X(Twitter), @cosme, 小红书(Xiaohongshu), Bilibili, 抖音(Douyin), Threads  
> **구성**: 플랫폼별 공식 API + Apify 방법 + **완전 무료 대안**  
> **n8n 연동 기준** 작성

---

## ⚠️ 2026년 핵심 현실 요약

| 플랫폼 | 공식 API 유료/무료 | 인플루언서 탐색 가능 여부 | 권장 방법 |
|---|---|---|---|
| **네이버 블로그** | 무료 (Search API) | △ 제한적 | Naver Search API + 웹 스크래핑 |
| **Instagram** | 무료 (제한적) | △ Business 계정만 | Graph API + Apify |
| **Facebook** | 무료 (제한적) | △ 공개 페이지만 | Graph API + Apify |
| **YouTube** | 무료 (쿼터제) | ✅ 가장 공식적 | Data API v3 |
| **TikTok** | ❌ 상업용 불가 | △ 스크래퍼만 가능 | Apify (유일한 실용 방법) |
| **X (Twitter)** | ❌ 유료 전환 완료 | △ 비용 발생 | Apify 또는 무료 대안 |
| **@cosme** | ❌ 없음 | △ 웹 스크래핑 | Python 스크래퍼 |
| **Xiaohongshu** | ❌ 없음 | △ 쿠키 기반 | Apify / xhs 오픈소스 |
| **Bilibili** | ✅ 무료 Open API | ✅ 공식 가능 | Bilibili Open API |
| **Douyin** | ❌ 상업용 불가 | △ 스크래퍼만 | Apify / 오픈소스 |
| **Threads** | ✅ 무료 (Meta Graph) | △ 제한적 | Threads API (팔로워 100+ 계정) |

---

## 📌 플랫폼별 상세 방법

---

### 1. 🇰🇷 네이버 블로그 (Naver Blog)

#### 공식 API — Naver Search API (무료)

네이버는 블로그 전용 공개 API를 제공하지 않지만, **Naver Open API (Search)**를 통해 블로그 게시물 검색이 가능합니다.

**설정:**
```
1. https://developers.naver.com → 애플리케이션 등록
2. 사용 API: 검색 (블로그)
3. 발급: Client ID, Client Secret (무료)
4. 일일 호출 한도: 25,000건 (무료)
```

**핵심 엔드포인트:**
```bash
GET https://openapi.naver.com/v1/search/blog.json
  ?query=뷰티+스킨케어
  &display=100          ← 한 번에 최대 100개
  &start=1
  &sort=sim             ← sim(유사도) / date(최신)

Headers:
  X-Naver-Client-Id: {CLIENT_ID}
  X-Naver-Client-Secret: {CLIENT_SECRET}
```

**응답 필드:**
```json
{
  "items": [
    {
      "title": "포스트 제목",
      "link": "https://blog.naver.com/{blogId}/...",
      "description": "내용 요약",
      "bloggername": "블로거 닉네임",
      "bloggerlink": "https://blog.naver.com/{blogId}",
      "postdate": "20260601"
    }
  ]
}
```

> ⚠️ 팔로워 수, 이웃 수, 방문자 수는 Search API 응답에 포함되지 않음  
> → 블로그 개별 프로필 페이지를 별도로 파싱해야 함

**n8n 흐름:**
```
[Schedule Trigger]
      ↓
[HTTP Request: Naver Search API] → 키워드별 블로그 목록
      ↓
[Function Node: bloggerlink에서 blogId 추출]
      ↓
[HTTP Request: blog.naver.com/{blogId} 프로필 페이지]
      ↓
[HTML Extract Node: 이웃 수, 방문자 수 파싱]
      ↓
[IF Node: 이웃 수 조건 필터]
      ↓
[Postgres UPSERT]
```

**수집 가능 데이터:**
| 필드 | Search API | 프로필 파싱 |
|---|---|---|
| 블로거명 | ✅ | ✅ |
| 블로그 URL | ✅ | ✅ |
| 포스트 제목/요약 | ✅ | - |
| 이웃 수 (팔로워 대체) | ❌ | ✅ |
| 일 방문자 수 | ❌ | △ (노출 시) |
| 카테고리 | ❌ | △ |
| 이메일 | ❌ | △ (바이오 파싱) |

**⚠️ 네이버 인플루언서 탭 (Naver Influencer Search)**

네이버 검색에는 `where=influencer` 파라미터가 존재합니다 (비공식 내부 URL):
```
https://search.naver.com/search.naver?where=influencer&query=뷰티
```
→ 직접 HTTP 요청 + HTML 파싱으로 활용 가능 (비공식)

---

**🆓 완전 무료 대안 (Apify 없이)**

```python
# Python + BeautifulSoup + Naver Search API (무료 한도 내)
import requests
from bs4 import BeautifulSoup
import time

def search_naver_blogs(keyword, client_id, client_secret):
    """Naver Search API로 블로그 검색"""
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret
    }
    url = f"https://openapi.naver.com/v1/search/blog.json?query={keyword}&display=100&sort=sim"
    response = requests.get(url, headers=headers)
    return response.json()["items"]

def get_blog_profile(blog_id):
    """블로그 프로필 페이지에서 이웃 수 파싱"""
    url = f"https://blog.naver.com/{blog_id}"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    # 이웃 수 선택자 (네이버 레이아웃에 따라 조정 필요)
    neighbor_el = soup.select_one(".cnt_buddy strong")
    return int(neighbor_el.text.replace(",","")) if neighbor_el else 0
```

> n8n에서는 **Code Node (Python)** 또는 **HTTP Request + HTML Extract 노드** 조합으로 구현

---

### 2. 📸 Instagram

#### 공식 API — Meta Graph API (무료, 제한적)

> 자세한 내용은 이전 설명 참조. 핵심 요약:

- **Business Discovery API**: 타 비즈니스/크리에이터 계정의 팔로워 수, 게시물 수, 바이오 조회 가능 (인증 불필요)
- **Hashtag Search API**: 7일 기준 30개 해시태그 제한
- **개인 계정**: API 접근 불가

**무료 API 핵심 엔드포인트 요약:**
```bash
# 해시태그 ID 조회
GET /{ig-user-id}/ig_hashtags?q={hashtag}&access_token={token}

# 해시태그 게시물 조회
GET /{hashtag-id}/top_media?fields=id,owner&access_token={token}

# Business Discovery (팔로워 수 조회)
GET /{ig-user-id}?fields=business_discovery.fields(
  username,followers_count,media_count,biography,website
)&username={target}&access_token={token}
```

**🆓 완전 무료 대안 (Apify 없이)**

Instagram은 2026년 기준 `web_profile_info` 내부 REST 엔드포인트와 GraphQL 쿼리를 통해 공개 프로필 데이터를 가져올 수 있습니다. 단, doc_id 파라미터가 2~4주 간격으로 변경되고 IP 차단 위험이 있어 **개인 IP + 적절한 딜레이** 필수입니다.

```bash
# 비공식 프로필 조회 (공개 계정)
GET https://www.instagram.com/api/v1/users/web_profile_info/?username={username}
Headers:
  User-Agent: Mozilla/5.0 ...
  X-IG-App-ID: 936619743392459
```

> ⚠️ 비공식 엔드포인트이므로 언제든 변경/차단될 수 있음  
> 상업적 목적에는 Graph API 공식 방법 권장

**n8n 무료 구현:**
```
[HTTP Request: Naver Search API 방식으로 해시태그 게시물 수집]
      ↓
[HTTP Request: web_profile_info 또는 Business Discovery]
      ↓
[Wait Node: 2~3초 간격] ← IP 차단 방지
      ↓
[Postgres UPSERT]
```

---

### 3. 👥 Facebook

#### 공식 API — Meta Graph API (무료, 공개 페이지만)

- **Pages Search**: `GET /pages/search?q={keyword}` 로 공개 페이지 검색 (제한적)
- **Page Public Content Access**: 페이지 팔로워 수, 게시물, 인게이지먼트 조회 가능
- 개인 프로필 접근 불가

```bash
# 공개 페이지 검색
GET https://graph.facebook.com/v21.0/pages/search
  ?q=뷰티+스킨케어
  &fields=name,fan_count,category,about,website
  &access_token={token}

# 특정 페이지 상세 조회
GET https://graph.facebook.com/v21.0/{page-id}
  ?fields=name,fan_count,followers_count,category,about,website,link
  &access_token={token}
```

**🆓 완전 무료 대안:**  
Facebook 공개 페이지 검색 자체가 Graph API로 무료 가능. 단, 대량 자동화는 앱 리뷰 필요.

---

### 4. ▶️ YouTube

#### 공식 API — YouTube Data API v3 (무료, 쿼터 10,000유닛/일)

> 자세한 내용은 이전 설명 참조. 핵심 요약:

| 작업 | 유닛 비용 |
|---|---|
| `search.list` (채널 검색) | **100유닛** |
| `channels.list` (채널 조회, 50개 배치) | **1유닛** |
| `videos.list` (영상 통계) | **1유닛** |
| `playlistItems.list` (업로드 목록) | **1유닛** |

**절약 전략**: search.list → 채널 ID 목록 추출 → channels.list 배치(50개) → 101유닛으로 50채널 처리

**🆓 완전 무료 대안:**
- YouTube Data API v3 자체가 10,000유닛/일 무료
- 쿼터 부족 시: **Google Cloud 프로젝트 복수 생성** (프로젝트마다 10,000유닛 별도 부여)
- 또는 **yt-dlp** (오픈소스) + Python으로 공개 채널 메타데이터 직접 추출

```bash
# yt-dlp로 채널 정보 추출 (완전 무료, 설치형)
yt-dlp --dump-json --flat-playlist "https://www.youtube.com/@channelname"
```

---

### 5. 🎵 TikTok

#### 공식 API — 상업적 사용 사실상 불가 (2026년)

- Research API: 학술·기관 전용, IRB 승인 필요, 상업 불가
- 공식 Content API: 게시용만, 데이터 조회 불가

**Apify 방법:** (이전 설명 참조)  
→ `automation-lab/tiktok-profile-scraper`: 팔로워 수, 총 좋아요, 영상별 views  
→ `clockworks/tiktok-scraper`: 해시태그 기반 영상·작성자 수집

**🆓 완전 무료 대안:**

**방법 A: TikTok 내부 API 직접 호출 (Python)**
```python
# TikTok 공개 프로필 내부 API (비공식)
import httpx

async def get_tiktok_profile(username: str):
    url = f"https://www.tiktok.com/@{username}"
    # TikTok의 SIGI_STATE JSON에서 프로필 데이터 추출
    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 ..."},
        follow_redirects=True
    ) as client:
        response = await client.get(url)
        # SIGI_STATE 파싱으로 followerCount, videoCount 등 추출
```

**방법 B: GitHub 오픈소스 — Douyin_TikTok_Download_API**
```
GitHub: Evil0ctal/Douyin_TikTok_Download_API
Star: 12,400+
기능: TikTok, Douyin, Bilibili 프로필·영상 데이터 추출
설치: pip install + FastAPI 로컬 실행
n8n 연동: localhost HTTP Request 노드
```
```bash
git clone https://github.com/Evil0ctal/Douyin_TikTok_Download_API
pip install -r requirements.txt
python main.py  # FastAPI 서버 실행 (localhost:8000)
```

> 이 오픈소스 API를 Docker에 함께 띄우면 n8n에서 HTTP Request로 호출 가능

---

### 6. 🐦 X (Twitter)

#### 공식 API — 2026년 기준 완전 유료 전환

- **Free Tier**: 신규 개발자에게 더 이상 제공되지 않음 (2026년 2월 완전 종료)
- **Pay-per-use**: 기본 과금 모델. 게시물 읽기 $0.005/건, 쓰기 $0.015/건
- **Basic**: $100/월 (기존 구독자만 유지)
- **Pro**: $5,000/월

→ 인플루언서 검색(읽기) 대량 사용 시 **수십~수백 달러** 비용 발생

**Apify 방법:**  
→ `apify/twitter-scraper`: 키워드/해시태그 기반 트윗·프로필 수집

**🆓 완전 무료 대안:**

**방법 A: Nitter (X 미러 서비스) 스크래핑**
```
Nitter: X의 공개 데이터를 반환하는 오픈소스 프록시
설치형 자체 호스팅 또는 공개 인스턴스 활용
(공개 인스턴스는 불안정할 수 있음)

GET https://{nitter-instance}/search?q={keyword}&f=users
→ HTML 파싱으로 유저 목록, 팔로워 수 추출
```

**방법 B: twscrape (Python 오픈소스)**
```bash
pip install twscrape

# X 계정(무료)으로 로그인 → 공개 프로필 조회
from twscrape import API
api = API()
await api.pool.add_account(username, password, email, email_password)
await api.pool.login_all()

# 사용자 검색
async for user in api.search_users("뷰티 인플루언서", limit=50):
    print(user.username, user.followersCount)
```
> ⚠️ X 계정 필요 (무료). 과도한 사용 시 계정 제한 위험

**방법 C: Google 검색 + 프로필 파싱**
```
Google: site:twitter.com OR site:x.com {키워드} {카테고리}
→ 검색 결과에서 X 프로필 URL 추출
→ 각 프로필 직접 접근하여 팔로워 수 파싱
```

**n8n 무료 구현 (twscrape Docker화):**
```
[n8n HTTP Request → twscrape FastAPI 로컬 서버]
→ 검색 결과 프로필 목록 반환
→ Postgres UPSERT
```

---

### 7. 🇯🇵 @cosme (일본 뷰티 플랫폼)

#### 공식 API — 없음

@cosme는 공식 개발자 API를 제공하지 않습니다. 인플루언서 검색은 **웹 스크래핑**만 가능합니다.

**@cosme 인플루언서 구조:**
- `cosme.net/influencer/` — 인플루언서 목록 페이지
- `cosme.net/influencer/{id}` — 개인 프로필 (팔로워 수, 포스트 수, 카테고리)
- 카테고리: スキンケア(스킨케어), メイク(메이크업), ヘアケア(헤어케어), ボディ(바디), フレグランス(향수)

**Apify 방법:**  
→ Apify의 `apify/web-scraper` 범용 스크래퍼로 구현 (전용 Actor 없음)

**🆓 완전 무료 대안 (Python):**

```python
import requests
from bs4 import BeautifulSoup
import time

def scrape_cosme_influencers(category="skincare", page=1):
    """@cosme 인플루언서 목록 스크래핑"""
    url = f"https://www.cosme.net/influencer/?category={category}&page={page}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
        "Accept-Language": "ja-JP,ja;q=0.9"
    }
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    
    influencers = []
    for card in soup.select(".influencer-card"):  # 실제 선택자는 점검 필요
        influencer = {
            "platform": "cosme",
            "account_name": card.select_one(".username").text.strip(),
            "account_url": "https://www.cosme.net" + card.select_one("a")["href"],
            "follower_count": parse_number(card.select_one(".follower-count").text),
            "category": category,
            "country": "JP"
        }
        influencers.append(influencer)
    
    time.sleep(2)  # Rate limit 준수
    return influencers
```

**n8n 무료 구현:**
```
[Schedule Trigger: 주 1회]
      ↓
[Set Node: 카테고리 목록] 
  ["skincare", "makeup", "haircare", "body", "fragrance"]
      ↓
[Loop + HTTP Request: @cosme 인플루언서 페이지]
      ↓
[HTML Extract Node: 유저명, 팔로워 수, 프로필 URL]
      ↓
[Wait: 2초]
      ↓
[Postgres UPSERT]
```

> ⚠️ @cosme는 JavaScript 렌더링이 필요한 영역이 있을 수 있음  
> → n8n의 **Puppeteer 노드** 또는 **로컬 Playwright 서버** 연동 필요할 수 있음

---

### 8. 🇨🇳 小红书 (Xiaohongshu / RedNote)

#### 공식 API — 없음 (중국 내 기업 계약만 가능)

**플랫폼 특성:**
- MAU 3억+, 여성 비율 70%, 평균 연령 25세
- KOL(Key Opinion Leader) 인플루언서 마케팅 핵심 플랫폼
- 뷰티, 패션, 여행, 음식, 홈데코 카테고리 강세

**Apify 방법:**  
→ `zhorex/rednote-xiaohongshu-scraper`: 키워드 검색, 프로필, 게시물 수집  
→ 쿠키 기반 또는 쿠키 없이 작동 (Actor별 상이)

**🆓 완전 무료 대안 — xhs 오픈소스 라이브러리:**

```bash
# GitHub: ReaJason/xhs (Python, Star 5,000+)
pip install xhs

# 사용 예시 (로그인 쿠키 필요)
from xhs import XhsClient

# 브라우저에서 쿠키 추출 후 사용
client = XhsClient(cookie="a1=xxx; web_session=xxx; ...")

# 키워드 검색
notes = client.get_note_by_keyword("스킨케어", page=1, page_size=20)

# 사용자 프로필 조회
user_info = client.get_user_info(user_id="...")
# → follower_count, following_count, notes_count 포함
```

**수집 가능 데이터:**
```json
{
  "user_id": "xxx",
  "nickname": "닉네임",
  "desc": "바이오",
  "follower_count": 58000,
  "following_count": 230,
  "notes_count": 142,
  "gender": 1,
  "location": "上海",
  "tags": ["美妆", "护肤"]
}
```

**n8n 무료 구현:**
```
[xhs Python 라이브러리를 FastAPI로 감싸서 Docker 실행]
      ↓
[n8n HTTP Request → 로컬 FastAPI 서버]
      ↓
[키워드 검색 → 작성자 목록 추출]
      ↓
[사용자 프로필 조회 (팔로워 수)]
      ↓
[Postgres UPSERT]
```

> ⚠️ 쿠키 유효 기간이 있으므로 주기적 갱신 필요 (별도 관리 계정 사용 권장)

---

### 9. 📺 Bilibili (哔哩哔哩)

#### 공식 API — Bilibili Open API (무료, 가장 개방적인 중국 플랫폼)

Bilibili은 중국 플랫폼 중 유일하게 **공식 오픈 API**를 제공합니다.

**설정:**
```
1. bilibili.com/account/developer → 개발자 계정 등록
2. 앱 등록 → access_key 발급
3. 일부 엔드포인트는 로그인 없이 접근 가능
```

**핵심 엔드포인트:**
```bash
# 키워드로 UP主(유튜버) 검색
GET https://api.bilibili.com/x/web-interface/search/type
  ?search_type=bili_user
  &keyword=美妆+护肤
  &page=1
  &page_size=20

# 응답 필드: mid(유저ID), name, fans(팔로워), video_count, sign(바이오)

# UP主 상세 정보
GET https://api.bilibili.com/x/space/acc/info?mid={mid}

# UP主 최근 영상 목록
GET https://api.bilibili.com/x/space/arc/search
  ?mid={mid}&pn=1&ps=30&order=pubdate

# 영상 통계
GET https://api.bilibili.com/x/web-interface/view?bvid={bvid}
# → view(조회수), like, coin, favorite, share, reply
```

**🆓 완전 무료 대안 (공식 API 그대로 사용):**

```python
import requests

def search_bilibili_creators(keyword, page=1):
    """Bilibili UP主 검색 (공식 API, 무료)"""
    url = "https://api.bilibili.com/x/web-interface/search/type"
    params = {
        "search_type": "bili_user",
        "keyword": keyword,
        "page": page,
        "page_size": 20
    }
    headers = {"User-Agent": "Mozilla/5.0 ..."}
    response = requests.get(url, params=params, headers=headers)
    data = response.json()
    
    creators = []
    for item in data["data"]["result"]:
        creators.append({
            "platform": "bilibili",
            "account_name": item["uname"],
            "account_url": f"https://space.bilibili.com/{item['mid']}",
            "follower_count": item["fans"],
            "category": keyword,
            "country": "CN"
        })
    return creators
```

**n8n 무료 구현:**
```
[Schedule Trigger]
      ↓
[HTTP Request: Bilibili search/type API] ← 인증 불필요
      ↓
[Function Node: UP主 목록 추출]
      ↓
[HTTP Request: space/acc/info (팔로워 수 상세)]
      ↓
[HTTP Request: space/arc/search (최근 영상)]
      ↓
[Function Node: 평균 조회수 계산]
      ↓
[Postgres UPSERT]
```

---

### 10. 🎵 抖音 (Douyin) — 중국판 TikTok

#### 공식 API — 상업용 접근 불가

- 抖音 Open Platform (open.douyin.com): 본인 계정 관리용만 제공
- 인플루언서 탐색용 데이터 API: 공식 없음
- **星图(Xingtu)** 플랫폼: 브랜드-KOL 매칭 공식 플랫폼이지만 기업 계약 필요

**Apify 방법:**  
→ `openclawai/tiktok-douyin-bilibili-scraper`: TikTok·Douyin·Bilibili 통합  
→ `ethereal_wool/kuaishou-scraper`: Douyin 전용 포함

**🆓 완전 무료 대안 — Douyin_TikTok_Download_API (오픈소스):**

```bash
# GitHub: Evil0ctal/Douyin_TikTok_Download_API (Star 12,400+)
# Douyin + TikTok + Bilibili 통합 지원

git clone https://github.com/Evil0ctal/Douyin_TikTok_Download_API
cd Douyin_TikTok_Download_API
pip install -r requirements.txt
python main.py

# FastAPI 로컬 서버 실행 후:
GET http://localhost:8000/api/douyin/user/info?url=https://www.douyin.com/@username
# → 팔로워 수, 영상 수, 좋아요 수, 바이오
```

**수집 가능 데이터:**
```json
{
  "nickname": "닉네임",
  "unique_id": "@username",
  "follower_count": 125000,
  "following_count": 340,
  "aweme_count": 89,        ← 영상 수
  "total_favorited": 890000, ← 총 좋아요
  "signature": "바이오",
  "region": "CN"
}
```

**n8n 무료 구현:**
```
[n8n HTTP Request → Douyin_TikTok API 로컬 서버 (Docker)]
      ↓
[키워드/해시태그로 영상 검색]
      ↓
[영상 작성자 uid 추출]
      ↓
[사용자 프로필 조회]
      ↓
[Postgres UPSERT]
```

---

### 11. 🧵 Threads

#### 공식 API — Meta Threads API (무료)

Threads는 2024년 공식 API 오픈 이후 꾸준히 기능을 확장하고 있습니다. Meta는 최근 프로필 발견 팔로워 임계값을 1,000명에서 100명으로 낮춰 더 많은 계정 탐색이 가능해졌습니다.

**설정:**
```
1. Meta Developers → Threads 제품 추가 (Instagram 앱과 동일)
2. threads_basic 권한 → 공개 프로필 조회
3. threads_manage_insights → 분석 데이터 (본인 계정)
```

**핵심 엔드포인트:**
```bash
# 공개 게시물 검색 (미디어 타입, 작성자 username 기준)
GET https://graph.threads.net/v1.0/threads?q={keyword}
  &fields=id,text,username,timestamp,like_count,replies_count
  &access_token={token}

# 사용자 프로필 조회 (팔로워 수 포함)
GET https://graph.threads.net/v1.0/{threads-user-id}
  ?fields=id,username,name,threads_profile_picture_url,
          threads_biography,followers_count
  &access_token={token}

# 사용자 최근 게시물
GET https://graph.threads.net/v1.0/{user-id}/threads
  ?fields=id,text,like_count,replies_count,timestamp
  &access_token={token}
```

**수집 가능 데이터:**
| 필드 | Threads API |
|---|---|
| 팔로워 수 | ✅ |
| 바이오 | ✅ |
| 게시물 좋아요/댓글 수 | ✅ |
| 인구통계 | ✅ (본인 계정 Insights만) |
| 이메일 | ❌ (바이오 파싱 필요) |

**n8n 무료 구현:**
```
[HTTP Request: Threads 게시물 키워드 검색]
      ↓
[Function Node: 작성자 username 추출·중복 제거]
      ↓
[HTTP Request: 사용자 프로필 조회 (followers_count)]
      ↓
[IF Node: 팔로워 수 조건 필터]
      ↓
[Function Node: 평균 좋아요/댓글 계산]
      ↓
[Postgres UPSERT]
```

---

## 🆓 완전 무료 방법 — 플랫폼별 통합 정리

| 플랫폼 | 무료 방법 | 도구/라이브러리 | 데이터 완성도 |
|---|---|---|---|
| **네이버 블로그** | Naver Search API (공식) | HTTP Request | ⭐⭐⭐ |
| **Instagram** | Graph API + 비공식 REST | Meta API (무료 한도) | ⭐⭐ |
| **Facebook** | Graph API (공개 페이지) | Meta API (무료 한도) | ⭐⭐⭐ |
| **YouTube** | YouTube Data API v3 | 공식 API (10K유닛/일) | ⭐⭐⭐⭐ |
| **TikTok** | Douyin_TikTok_Download_API | GitHub 오픈소스 Docker | ⭐⭐ |
| **X (Twitter)** | twscrape | GitHub 오픈소스 Python | ⭐⭐ |
| **@cosme** | BeautifulSoup 웹 스크래핑 | Python 직접 구현 | ⭐⭐ |
| **Xiaohongshu** | xhs 라이브러리 (쿠키 필요) | GitHub 오픈소스 Python | ⭐⭐⭐ |
| **Bilibili** | 공식 Open API (무료) | HTTP Request | ⭐⭐⭐⭐ |
| **Douyin** | Douyin_TikTok_Download_API | GitHub 오픈소스 Docker | ⭐⭐ |
| **Threads** | Meta Threads API (공식 무료) | HTTP Request | ⭐⭐⭐ |

---

## 🏗️ 완전 무료 아키텍처 — Docker 통합 구성

```yaml
# docker-compose.yml (기존 n8n + Postgres에 추가)
version: "3.8"
services:
  # 기존 서비스
  n8n:
    image: n8nio/n8n
    ...
  
  postgres:
    image: postgres:15
    ...

  # 신규 추가 — 중국 플랫폼 + TikTok 무료 API 서버
  douyin-tiktok-api:
    image: python:3.11-slim
    command: >
      bash -c "pip install -r requirements.txt && python main.py"
    volumes:
      - ./Douyin_TikTok_Download_API:/app
    working_dir: /app
    ports:
      - "8001:8000"
    restart: unless-stopped

  # 신규 추가 — Xiaohongshu API 서버
  xhs-api:
    image: python:3.11-slim
    command: >
      bash -c "pip install xhs fastapi uvicorn && python xhs_server.py"
    ports:
      - "8002:8000"
    restart: unless-stopped
```

**n8n에서의 통합 호출 구조:**
```
n8n 내부 HTTP Request 설정:
  - Naver Blog:    https://openapi.naver.com/v1/search/blog.json
  - YouTube:       https://www.googleapis.com/youtube/v3/search
  - Facebook/IG:   https://graph.facebook.com/v21.0/...
  - Threads:       https://graph.threads.net/v1.0/...
  - Bilibili:      https://api.bilibili.com/x/web-interface/search/type
  - TikTok/Douyin: http://douyin-tiktok-api:8000/api/...  ← Docker 내부 통신
  - Xiaohongshu:   http://xhs-api:8000/api/...            ← Docker 내부 통신
  - X (Twitter):   http://twscrape-api:8000/api/...       ← Docker 내부 통신 (선택)
```

---

## 💡 플랫폼별 인게이지먼트율 계산 공식

```javascript
// n8n Function Node에서 공통 사용
function calculateEngagement(platform, data) {
  switch(platform) {
    case "youtube":
      return ((data.likes + data.comments) / data.views * 100).toFixed(2);
    
    case "instagram":
    case "threads":
      return ((data.likes + data.comments) / data.followers * 100).toFixed(2);
    
    case "tiktok":
    case "douyin":
      return ((data.likes + data.comments + data.shares) / data.plays * 100).toFixed(2);
    
    case "bilibili":
      return ((data.like + data.coin + data.favorite + data.reply) / data.view * 100).toFixed(2);
    
    case "xiaohongshu":
      return ((data.liked_count + data.collected_count + data.comment_count) / data.followers * 100).toFixed(2);
    
    case "naver_blog":
      // 방문자 수 기준 (팔로워 대체)
      return (data.avg_comments / data.daily_visitors * 100).toFixed(2);
    
    default:
      return 0;
  }
}
```

---

## 📊 비용 비교 — Apify vs 완전 무료

| 구분 | Apify (Starter $49/월) | 완전 무료 방법 |
|---|---|---|
| **Instagram** | ✅ 편리 | △ Graph API 한도 내 |
| **YouTube** | △ (API 충분) | ✅ Data API v3 무료 |
| **TikTok** | ✅ 안정적 | △ 오픈소스 (유지보수 필요) |
| **X (Twitter)** | ✅ | △ twscrape (계정 필요) |
| **Xiaohongshu** | ✅ | △ xhs 라이브러리 (쿠키 관리 필요) |
| **Bilibili** | ✅ | ✅ 공식 API 무료 |
| **Douyin** | ✅ | △ 오픈소스 (유지보수 필요) |
| **@cosme** | △ 범용 스크래퍼 | △ Python 직접 구현 |
| **Threads** | △ | ✅ 공식 API 무료 |
| **네이버 블로그** | ✅ | ✅ 공식 API 무료 |
| **Facebook** | ✅ | ✅ Graph API 무료 |
| **운영 안정성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **비용** | $49~149/월 | $0 |
| **유지보수** | 낮음 | 중~높음 |

---

## ✅ 권장 운영 전략

```
[비용 우선 → 완전 무료 구성]
공식 무료 API 활용:
  ✅ YouTube Data API v3
  ✅ Bilibili Open API
  ✅ Naver Search API
  ✅ Meta Graph API (Instagram/Facebook/Threads)

오픈소스 Docker 서버:
  ✅ Douyin_TikTok_Download_API (TikTok + Douyin)
  ✅ xhs 라이브러리 래핑 (Xiaohongshu)
  ✅ twscrape (X/Twitter)
  ✅ Python BeautifulSoup (@cosme)

[안정성 우선 → Apify 혼합 구성]
핵심 플랫폼 (TikTok, Xiaohongshu): Apify 사용
나머지 (YouTube, Bilibili, Naver, Threads): 무료 API 사용
→ Apify 비용 최소화 ($49/월 이하 유지 가능)
```

---

*최종 업데이트: 2026년 6월 기준*  
*문서 위치: `/mnt/user-data/outputs/influencer-search-methods-all-platforms.md`*
