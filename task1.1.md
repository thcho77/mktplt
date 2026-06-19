# 전 플랫폼 인플루언서 수집 시스템 — Task

## 구현 진행 상황

- [x] 기존 Bilibili, YouTube 수집 코드 분석
- [x] influencer-search-methods-all-platforms.md 검토
- [x] 구현 계획 수립

### 1. 환경 설정
- [x] `.env` 템플릿 파일 생성
- [x] `requirements.txt` 업데이트

### 2. collect_real_data.py 전면 재작성
- [x] 공통 유틸 (http_get, db_upsert, 카테고리 매핑)
- [x] Bilibili (기존 유지)
- [x] YouTube (기존 유지)
- [x] Naver Blog (Naver Search API + 프로필 파싱)
- [x] Instagram (Meta Graph API)
- [x] Facebook (Meta Graph API - Pages)
- [x] Threads (Meta Threads API)
- [x] TikTok (SIGI_STATE 비공식 파싱)
- [x] Douyin (내부 API 파싱)
- [x] X/Twitter (twscrape)
- [x] @cosme (BeautifulSoup 스크래핑)
- [x] Xiaohongshu (xhs 라이브러리)

### 3. 패키지 설치 및 검증
- [/] pip install requirements
- [ ] 플랫폼별 개별 테스트 (Bilibili, YouTube, Naver Blog 우선)
- [ ] DB 저장 검증

### 4. UI 연동 확인
- [ ] 프론트엔드 수집 폼에서 실행 테스트
- [ ] 대시보드 데이터 확인
