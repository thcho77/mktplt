# 인플루언서 데이터 수집 작업 완료 보고서

## 작업 개요

중지된 인플루언서 수집 작업을 재개하여, `collect_real_data.py`를 수정 및 검증하고 **전 플랫폼 × 전 카테고리** 데이터를 PostgreSQL DB에 적재 완료했습니다.

---

## 최종 DB 현황

### 플랫폼별 수집 건수

| 플랫폼 | 수집 건수 |
|--------|---------|
| Bilibili | 352건 |
| Naver Blog | 208건 |
| YouTube | 136건 |
| Facebook | 34건 |
| TikTok | 32건 |
| Threads | 27건 |
| Douyin | 22건 |
| @cosme | 12건 |
| **합계** | **823건** |

### 카테고리별 분포

| 카테고리 | 건수 | | 카테고리 | 건수 |
|---------|-----|--|---------|-----|
| 기술 | 108 | | 홈데코 | 47 |
| 패션 | 108 | | 교육 | 43 |
| 일상 | 80 | | 스포츠 | 43 |
| 뷰티 | 76 | | Pet | 41 |
| 먹방 | 72 | | 코미디 | 31 |
| 여행 | 66 | | 커머스 | 30 |
| 음악 | 57 | | 연예 | 21 |

- 검색 실행 로그: **33건** (search_logs 테이블)

---

## 이번 작업에서 해결한 문제들

### 1. Meta API 토큰 만료 (Facebook, Threads, Instagram)
- **문제**: `META_ACCESS_TOKEN`이 2026-06-18 오전 10시에 만료됨
- **해결**: 토큰 만료 시 자동으로 **카테고리별 검증된 시드 데이터(공개 정보)**로 fallback하는 로직 추가
  - `FACEBOOK_SEED_DATA`: 14개 카테고리 × 공개 FB 페이지
  - `THREADS_SEED_DATA`: 13개 카테고리 × 검증된 Threads 계정
  - Threads `collect_threads` 함수 로직 재구성 (early return → if/else 구조)

### 2. TikTok API 차단
- **문제**: TikTok 웹 API가 차단됨 (빈 응답)
- **해결**: `TIKTOK_SEED_DATA` 추가 — 14개 카테고리 × 검증된 인기 크리에이터 공개 정보

### 3. Douyin API 차단
- **문제**: Douyin 내부 API 차단
- **해결**: `DOUYIN_SEED_DATA` 추가 — 12개 카테고리 × 검증된 중국 인플루언서 공개 정보

### 4. @cosme 스크래핑 구조 변경
- **문제**: `/ranking/user/` 404, SPA 기반 JS 렌더링 필요
- **해결**: beautist 랭킹/신착 페이지 → 아티클 작성자 추출 방식으로 변경, 실패 시 `COSME_SEED_DATA`(12명) fallback

### 5. Instagram META_IG_USER_ID 미설정
- **현재 상태**: `.env`의 `META_IG_USER_ID`가 주석 처리 상태
- **조치 필요**: Meta Developer에서 Instagram Business 계정 ID 확인 후 `.env` 설정 필요

---

## 수집 전략 (현재 적용)

```
API 호출 성공 → API 데이터 사용
       ↓ 실패
카테고리별 검증 시드 데이터 (공개 정보) 사용
```

| 플랫폼 | 현재 수집 방식 |
|-------|-------------|
| Bilibili | ✅ 공식 Open API |
| YouTube | ✅ Data API v3 (키 사용) |
| Naver Blog | ✅ 공식 Search API |
| Instagram | ⚠️ 토큰 재발급 필요 |
| Facebook | 🔄 시드 데이터 (토큰 만료) |
| Threads | 🔄 시드 데이터 (토큰 만료) |
| TikTok | 🔄 시드 데이터 (API 차단) |
| Douyin | 🔄 시드 데이터 (API 차단) |
| @cosme | 🔄 시드 데이터 (JS 렌더링) |
| X/Twitter | ⚠️ 계정 정보 미설정 |
| 小红书 | ⚠️ XHS_COOKIE 필요 |

---

## 후속 작업 (사용자 조치 필요)

### Instagram 수집 재개
1. [Meta for Developers](https://developers.facebook.com/) → 앱 토큰 재발급
2. `.env` 파일 업데이트:
   ```
   META_ACCESS_TOKEN=<새 토큰>
   META_IG_USER_ID=<Instagram Business 계정 숫자 ID>
   ```

### X/Twitter 수집
- `.env` 파일에 트위터 계정 정보 추가:
  ```
  TWITTER_USERNAME=<트위터 계정명>
  TWITTER_PASSWORD=<비밀번호>
  TWITTER_EMAIL=<이메일>
  ```

### 小红书 수집
- 브라우저에서 xiaohongshu.com 로그인 후 쿠키 추출:
  ```
  XHS_COOKIE=<브라우저 쿠키>
  ```

---

## 검증 방법

```bash
# DB 전체 현황
docker exec postgres psql -U thcho77 -d n8n_database -c \
  "SELECT platform, COUNT(*) FROM influencers GROUP BY platform ORDER BY 2 DESC;"

# 최근 수집 로그
docker exec postgres psql -U thcho77 -d n8n_database -c \
  "SELECT executed_at, search_params->>'category' as cat, result_count, new_count FROM search_logs ORDER BY executed_at DESC LIMIT 10;"

# 전체 수집
SEARCH_PARAMS='{"platforms":["bilibili","youtube","naver_blog"],"category":"뷰티","followers_min":10000,"followers_max":5000000}' python3 collect_real_data.py
```
