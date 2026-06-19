# 전 플랫폼 인플루언서 수집 시스템 구현 계획

현재 `collect_real_data.py`는 **Bilibili, YouTube** 2개 플랫폼만 지원합니다.
`influencer-search-methods-all-platforms.md` 문서 기준으로 **11개 전 플랫폼**으로 확장합니다.

---

## User Review Required

> [!IMPORTANT]
> **API 키 / 자격증명이 필요한 플랫폼** — 아래 항목 중 보유 여부를 확인해 주세요.
>
> | 플랫폼 | 필요 자격증명 | 비용 |
> |--------|-------------|------|
> | Naver Blog | Client ID + Client Secret | 무료 |
> | YouTube | API Key (Google Cloud) | 무료 (10K유닛/일) |
> | Instagram / Facebook / Threads | Meta Graph API Access Token | 무료 (제한적) |
> | X (Twitter) | X 계정 (twscrape용) | 무료 (계정만) |
> | Xiaohongshu | 로그인 쿠키 (`a1`, `web_session`) | 무료 (쿠키 갱신 필요) |
>
> 없는 항목은 **해당 플랫폼을 비활성화**하거나 fallback 로직으로 처리됩니다.

> [!WARNING]
> **@cosme, Douyin, TikTok, Xiaohongshu**는 JavaScript 렌더링이 필요하거나 비공식 API를 사용합니다.
> 운영 환경에서 IP 차단 위험이 있으므로, 요청 간격(Rate limit) 조정이 필요합니다.

---

## Open Questions

> [!IMPORTANT]
> **결정 필요:** 아래 두 가지 구현 전략 중 선택해 주세요.
>
> **Option A (권장) — 완전 무료 통합형 (현재 아키텍처 유지)**
> - 모든 수집 로직을 `collect_real_data.py` 한 파일로 통합
> - API 키를 `.env` 파일로 관리
> - 없는 키는 자동 fallback 처리
>
> **Option B — Docker 마이크로서비스 추가**
> - TikTok/Douyin: `Evil0ctal/Douyin_TikTok_Download_API` Docker 컨테이너 별도 실행
> - Xiaohongshu: `xhs` 라이브러리 FastAPI 래퍼 Docker 컨테이너
> - 더 안정적이지만 Docker 리소스 추가 소모

---

## 플랫폼별 구현 전략

| 플랫폼 | 방법 | 자격증명 | 현재 상태 |
|--------|------|---------|---------|
| **Bilibili** | 공식 Open API | 없음 | ✅ 구현됨 |
| **YouTube** | Data API v3 / RSS fallback | API Key (선택) | ✅ 구현됨 |
| **Naver Blog** | Naver Search API + 프로필 파싱 | Client ID/Secret | ❌ 미구현 |
| **Instagram** | Meta Graph API (Business Discovery) | Access Token | ❌ 미구현 |
| **Facebook** | Meta Graph API (Pages Search) | Access Token | ❌ 미구현 |
| **Threads** | Meta Threads API | Access Token (같은 앱) | ❌ 미구현 |
| **TikTok** | SIGI_STATE 파싱 (비공식) | 없음 | ❌ 미구현 |
| **X (Twitter)** | twscrape (pip) | X 계정 | ❌ 미구현 |
| **@cosme** | BeautifulSoup 스크래핑 | 없음 | ❌ 미구현 |
| **Xiaohongshu** | xhs 라이브러리 | 쿠키 | ❌ 미구현 |
| **Douyin** | 비공식 내부 API 파싱 | 없음 | ❌ 미구현 |

---

## Proposed Changes

### 환경변수 관리

#### [NEW] .env
```
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
YOUTUBE_API_KEY=
META_ACCESS_TOKEN=          # Instagram, Facebook, Threads 공통
META_IG_USER_ID=            # Instagram Business Discovery용 본인 계정 ID
XHS_COOKIE=                 # 小红书 쿠키 (a1=xxx; web_session=xxx)
TWITTER_USERNAME=           # twscrape X 계정
TWITTER_PASSWORD=
TWITTER_EMAIL=
```

---

### collect_real_data.py 전면 재작성

#### [MODIFY] [collect_real_data.py](file:///Users/chotaehyung/Documents/development/mktplt/collect_real_data.py)

11개 플랫폼 collector 함수를 추가합니다:

```
collect_naver_blog()     — Naver Search API + 프로필 파싱
collect_instagram()      — Meta Graph API (Business Discovery)
collect_facebook()       — Meta Graph API (Pages Search)
collect_threads()        — Meta Threads API
collect_tiktok()         — httpx SIGI_STATE 파싱 (비공식)
collect_twitter()        — twscrape (pip install twscrape)
collect_cosme()          — BeautifulSoup 스크래핑
collect_xiaohongshu()    — xhs 라이브러리 (쿠키 기반)
collect_douyin()         — 비공식 내부 API
```

모든 collector는 동일한 dict 스키마 반환:
```python
{
  'platform', 'account_name', 'account_url', 'category',
  'country', 'follower_count', 'avg_view_count',
  'email', 'gender', 'age_range', 'audience_demo', 'source_data'
}
```

#### [MODIFY] [requirements.txt](file:///Users/chotaehyung/Documents/development/mktplt/requirements.txt)
```
requests
beautifulsoup4
httpx
python-dotenv
twscrape      # X(Twitter) 수집용
xhs           # 小红书 수집용 (쿠키 필요)
```

#### [NEW] .env
API 키 및 자격증명 환경변수 파일

---

## Verification Plan

### Automated Tests
```bash
# 플랫폼별 수집 테스트
SEARCH_PARAMS='{"platforms":["naver_blog"],"category":"패션"}' python3 collect_real_data.py
SEARCH_PARAMS='{"platforms":["instagram"],"category":"뷰티"}' python3 collect_real_data.py
SEARCH_PARAMS='{"platforms":["bilibili","youtube","naver_blog"],"category":"일상"}' python3 collect_real_data.py
```

### Manual Verification
- `http://localhost:3001` 대시보드에서 각 플랫폼 데이터 확인
- DB에서 `SELECT platform, COUNT(*) FROM influencers GROUP BY platform` 으로 검증
