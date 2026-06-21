# Facebook "Page Public Content Access" 우회 및 폴백(가짜) 데이터 제거

## 1. Facebook 수집 로직 개선 (권한 우회)
Facebook Graph API의 `pages/search` 엔드포인트는 "Page Public Content Access" 권한이 있어야만 사용할 수 있습니다. 이 권한 없이도 실제 데이터를 수집할 수 있도록 수집 로직을 다음과 같이 전면 수정했습니다.

- **Naver Web Search API 활용**: `site:facebook.com "키워드"` 형태로 네이버 웹 검색 API를 호출하여 실제 Facebook 페이지들의 공식 URL을 수집합니다.
- **HTML Meta Tag 스크래핑**: 수집한 Facebook URL에 접속한 후, 페이지 HTML 소스의 `<meta name="description">` 태그를 스크래핑합니다. 이 태그에는 인증 없이도 `좋아하는 사람 1,194,490명`과 같은 팔로워 및 좋아요 수치가 노출되므로, 이를 정규식으로 파싱하여 실제 팔로워 수를 확보했습니다.
- 이를 통해 **API 권한 제약을 우회하면서 100% 실제 데이터**만을 수집할 수 있게 되었습니다.

## 2. 의미 없는 가짜 시드(Seed) 데이터 완전 제거
사용자님의 요청에 따라, API 호출 실패나 토큰 만료 시 임의로 집어넣던 하드코딩된 가상 데이터(Seed Data) 폴백 로직을 모두 삭제했습니다.

- **제거된 시드 데이터 목록**:
  - `FACEBOOK_SEED_DATA`
  - `THREADS_SEED_DATA`
  - `TIKTOK_SEED_DATA`
  - `DOUYIN_SEED_DATA`
  - `COSME_SEED_DATA`
- **적용 결과**: 이제부터는 API나 스크래핑을 통해 성공적으로 가져온 **"진짜(Real) 싱글 데이터"**만 DB에 저장되며, 정보를 가져오지 못했을 경우 억지로 가짜 결과를 반환하지 않게 됩니다.
