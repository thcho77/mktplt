# 1차 수정 요청 반영 구현 계획

사용자의 1차 수정 요청 사항을 바탕으로 시스템의 실데이터 크롤링 비중 확대, n8n 배치 스케줄러(매일 12시 01분) 탑재, 11개 플랫폼 전체 적용, 전세계 국가 지원 및 14개 카테고리 드롭다운 변환을 수행하기 위한 계획입니다.

## User Review Required

> [!IMPORTANT]
> **실데이터 크롤링 구현 범위**
> 로그인 세션 및 IP 차단이 엄격한 플랫폼(Instagram, Facebook, Threads, TikTok, X) 대신, 로그인 없이 퍼블릭 검색이 허용되는 플랫폼(**네이버 블로그, YouTube, Bilibili, Douyin**)에 대해서는 실제 공개 검색 API 및 RSS 스크래핑을 활용하여 **실시간 실제 인플루언서 정보**를 조회 및 적재하도록 구현합니다.
> 그 외 크롤링 제한 플랫폼은 실제 공개 웹 검색 결과에서 매칭된 실제 사용자 핸들을 파싱하여 실데이터화하는 방식으로 가짜(Mock) 데이터를 배제하고 실제 데이터를 수집합니다.

## Open Questions

> [!WARNING]
> **배치 스케줄링의 검색 키워드**:
> 매일 오전 12시 01분에 기동되는 스케줄러 배치 수집의 경우, 사용자 입력 키워드가 없으므로 기본 대표 카테고리 키워드 리스트(예: 패션, 뷰티, 먹방, 여행 등)를 번갈아가며 혹은 대량으로 동기화하도록 기본 검색 풀을 자동 순회하도록 설계할 예정입니다. 특별히 원하시는 스케줄러용 수집 키워드가 있으신가요?

## Proposed Changes

---

### [Database Component]

#### [MODIFY] [create_tables.sql](file:///Users/chotaehyung/Documents/development/mktplt/create_tables.sql)
- 데이터베이스 초기화 및 가짜 샘플데이터 삭제를 위해 `TRUNCATE influencers, search_logs RESTART IDENTITY;` 명령을 수행합니다.

---

### [n8n Workflow Component]

#### [MODIFY] [build_workflow.js](file:///Users/chotaehyung/Documents/development/mktplt/build_workflow.js)
- **Schedule Trigger 추가**:
  - type: `n8n-nodes-base.scheduleTrigger` (version: 1.3)
  - 매일 오전 12시 01분 배치 동작 설정 (Cron: `1 0 * * *`)
- **Fan-in 패턴 구현**: Webhook 트리거와 Schedule Trigger의 아웃풋이 공통 `Generate Influencers` 노드로 수렴하도록 설계합니다.
- **실제 데이터 크롤링 엔진 장착**:
  - `Generate Influencers` 내의 Javascript 코드를 네이버 블로그 검색 RSS 및 Bilibili/YouTube 공개 검색 데이터를 fetch하는 퍼블릭 스크래퍼 로직으로 교체합니다.
  - 수집 결과는 완전히 실제 활동하는 인플루언서 정보로 구성되며, 카테고리 매핑도 자동 수행됩니다.

---

### [Frontend Client Component]

#### [MODIFY] [public/index.html](file:///Users/chotaehyung/Documents/development/mktplt/public/index.html)
- **11개 플랫폼 체크박스 확장**: 네이버블로그, Instagram, Facebook, Youtube, Thread, TikTok, X(Twitter), @cosme, douyin, xiaohongsu, bilibili.
- **14개 표준카테고리 드롭다운 변환**: 기존 텍스트인풋에서 `커머스`, `음악`, `영화` 등 14가지 분류 드롭다운 메뉴로 개편.
- **전세계 국가 드롭다운 확장**: 대량의 ISO 국가 코드와 한글 국가명을 가진 대형 드롭다운 메뉴로 개편.

#### [MODIFY] [public/app.js](file:///Users/chotaehyung/Documents/development/mktplt/public/app.js)
- 변경된 폼 양식(카테고리 드롭다운 및 다중 플랫폼 체크박스)의 파라미터를 정확히 수집하여 백엔드 및 n8n에 전달하도록 제어 로직을 수정합니다.

---

## Verification Plan

### Automated Tests
- DB Truncate 실행 후 테이블이 비어 있는지 확인: `SELECT COUNT(*) FROM influencers;` -> 0건.
- n8n 워크플로우에 Schedule Trigger 및 Webhook Trigger가 이중으로 기동되는지 확인.
- `build_workflow.js` 빌드 검증 및 n8n 배포.
- API 호출 및 배치 트리거 모사 테스트.

### Manual Verification
- `http://localhost:3001` 대시보드에서 14개 카테고리 선택 및 네이버 블로그/유튜브/Bilibili 등을 체크하고 동기화를 돌려 실제로 존재하는 실데이터 계정들(예: 네이버 블로그 주소 및 실제 유튜브 핸들)이 수집되어 통계에 잡히는지 확인.
