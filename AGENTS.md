# AGENTS.md — 인플루언서 검색 및 목록화 시스템

## 프로젝트 개요

이 프로젝트는 다수의 SNS 플랫폼에서 인플루언서를 자동으로 검색·수집·목록화하는 에이전트 시스템입니다.  
n8n 워크플로우 엔진과 PostgreSQL 데이터베이스를 기반으로 동작하며, MCP를 통해 이 에이전트와 연동되어 있습니다.

---

## 인프라 구성

| 구성 요소 | 설명 |
|---|---|
| **n8n** | Docker 컨테이너로 실행 중인 워크플로우 자동화 엔진 |
| **PostgreSQL** | Docker 컨테이너로 실행 중인 인플루언서 데이터 저장 DB |
| **MCP (Model Context Protocol)** | 에이전트 ↔ n8n 간 인터페이스 (n8n-MCP 서버 연결됨) |

> n8n과 Postgres는 동일한 Docker 네트워크 내에서 운영됩니다.  
> MCP를 통해 에이전트는 n8n 워크플로우를 직접 생성·실행·관리할 수 있습니다.

---

## 에이전트 역할 및 책임

이 에이전트는 다음을 수행합니다:

1. **인플루언서 검색 워크플로우 설계 및 n8n 배포**  
   - MCP를 통해 n8n에 워크플로우를 생성하거나 기존 워크플로우를 수정합니다.
   - 각 SNS 플랫폼의 API 또는 스크래핑 방식에 맞는 노드 구성을 설계합니다.

2. **검색 조건에 따른 인플루언서 필터링**  
   - 팔로워 수, 평균 콘텐츠 조회수, 카테고리, 국가, 성별·연령대, 팔로워 인구통계 기준으로 필터링합니다.

3. **PostgreSQL에 데이터 저장 (중복 제거 포함)**  
   - 신규 검색 결과를 기존 DB 데이터와 비교하여 중복 없이 UPSERT 처리합니다.

4. **검색 결과 테이블 조회 및 리포트 생성**  
   - 에이전트 채팅 내에서 결과 요약 또는 필터링된 목록을 반환합니다.

---

## 대상 플랫폼

에이전트가 지원하는 SNS 플랫폼 목록입니다. 각 플랫폼별 검색 가능 여부와 제약사항이 다를 수 있습니다.

| 플랫폼 | 지역 특성 | API 가용성 |
|---|---|---|
| 네이버 블로그 | 한국 | 제한적 (웹 스크래핑 또는 공식 API) |
| Instagram | 글로벌 | Meta Graph API |
| Facebook | 글로벌 | Meta Graph API |
| YouTube | 글로벌 | YouTube Data API v3 |
| Threads | 글로벌 | Threads API (제한적) |
| TikTok | 글로벌 | TikTok Research API |
| X (Twitter) | 글로벌 | X API v2 |
| @cosme | 일본 | 웹 스크래핑 |
| Douyin | 중국 | 제한적 (내부 API) |
| 小红书 (Xiaohongshu) | 중국 | 제한적 (웹 스크래핑) |
| Bilibili | 중국 | Bilibili Open API |

---

## 검색 조건 파라미터

사용자가 채팅에서 검색 조건을 지정하면, 에이전트는 아래 파라미터를 수집하여 n8n 워크플로우에 전달합니다.

```
플랫폼 선택      : 복수 선택 가능 (예: Instagram, YouTube, TikTok)
팔로워 수 범위   : 최소 ~ 최대 (단위: 명, 미지정 시 전체)
평균 조회수      : 최소 기준 (예: 30,000 이상)
콘텐츠 카테고리  : 복수 선택 (커머스, 음악, 영화, 기술, 일상, 코미디, 먹방, 여행, Pet, 패션, 연예, 홈데코 등)
대상 국가        : 드롭다운 선택 (ISO 국가 코드 사용)
성별             : 전체 / 남성 / 여성
연령대           : 선택 (예: 18~24, 25~34, 35~44, 45+)
팔로워 특성      : 전체 팔로워의 25% 이상 공통 인구통계 특성 기준 (가능한 경우)
```

---

## PostgreSQL 데이터베이스 스키마

```sql
-- 인플루언서 기본 정보 테이블
CREATE TABLE IF NOT EXISTS influencers (
    id              SERIAL PRIMARY KEY,
    platform        VARCHAR(50)   NOT NULL,          -- 플랫폼명
    account_name    VARCHAR(255)  NOT NULL,          -- 계정명 (핸들 또는 채널명)
    account_url     TEXT,                            -- 계정 URL
    category        VARCHAR(100),                    -- 콘텐츠 카테고리
    country         VARCHAR(10),                     -- ISO 국가 코드
    follower_count  BIGINT,                          -- 팔로워 수
    avg_view_count  BIGINT,                          -- 평균 콘텐츠 조회수
    email           VARCHAR(255),                    -- 이메일 (공개된 경우)
    gender          VARCHAR(20),                     -- 성별 (추정 또는 공개 정보)
    age_range       VARCHAR(20),                     -- 연령대
    audience_demo   JSONB,                           -- 팔로워 인구통계 (JSON)
    last_updated    TIMESTAMP DEFAULT NOW(),         -- 최종 업데이트 일시
    source_data     JSONB,                           -- 원본 API 응답 데이터
    UNIQUE (platform, account_name)                  -- 중복 방지 제약
);

-- 검색 실행 이력 테이블
CREATE TABLE IF NOT EXISTS search_logs (
    id              SERIAL PRIMARY KEY,
    search_params   JSONB         NOT NULL,          -- 사용된 검색 조건
    result_count    INT,                             -- 검색된 결과 수
    new_count       INT,                             -- 신규 추가된 건수
    executed_at     TIMESTAMP DEFAULT NOW()          -- 실행 시각
);
```

> 중복 처리: `platform + account_name` 조합을 UNIQUE 키로 설정하여,  
> 재검색 시 `ON CONFLICT DO UPDATE` 방식으로 UPSERT 처리합니다.

---

## n8n 워크플로우 구조 (참고)

에이전트가 MCP를 통해 n8n에 생성하거나 참조할 워크플로우의 기본 흐름입니다.

```
[Webhook / Schedule Trigger]
        ↓
[검색 조건 파싱 노드]
        ↓
[플랫폼별 API 호출 노드] (병렬 실행)
   ├── Instagram Graph API
   ├── YouTube Data API
   ├── TikTok Research API
   └── ...
        ↓
[데이터 정규화 노드] (공통 스키마로 변환)
        ↓
[PostgreSQL UPSERT 노드] (중복 제거 포함)
        ↓
[검색 로그 저장 노드]
        ↓
[결과 응답 노드] (에이전트 채팅으로 반환)
```

---

## 에이전트 스킬

이 프로젝트의 `.agents/skills/` 폴더에는 다음 스킬이 등록되어 있습니다:

| 스킬명 | 설명 | 자동 활성화 조건 |
|---|---|---|
| `influencer-search` | 인플루언서 검색 조건 수집 → n8n 워크플로우 실행 | "인플루언서 찾아줘", "검색해줘" 등 |
| `influencer-list` | DB에서 목록 조회 및 필터링된 결과 반환 | "목록 보여줘", "조회해줘" 등 |
| `workflow-builder` | n8n 워크플로우 설계 및 MCP로 배포 | "워크플로우 만들어줘", "n8n 설정" 등 |
| `db-schema-manager` | PostgreSQL 테이블 생성/수정/조회 | "DB 스키마", "테이블 만들어줘" 등 |

> 스킬은 사용자의 요청 컨텍스트에 따라 에이전트가 자동으로 로드합니다.  
> 특정 스킬을 명시적으로 사용하려면 "influencer-search 스킬을 써서 ..." 형식으로 요청하세요.

---

## 에이전트 행동 지침

### 기본 원칙
- 사용자의 검색 요청을 받으면, **빠진 필수 파라미터**(플랫폼 선택)를 먼저 확인하고 채팅에서 물어봅니다.
- 모든 검색 실행 전에 `search_logs` 테이블에 조건을 기록합니다.
- n8n 워크플로우 실행 결과는 반드시 표 형식(아래 참조)으로 요약하여 반환합니다.

### 결과 반환 형식
```
| 플랫폼명 | 계정명 | 카테고리 | 팔로워수 | 이메일 | 평균도달수 |
|---------|--------|---------|---------|--------|-----------|
| ...     | ...    | ...     | ...     | ...    | ...       |

✅ 신규 추가: N건 | 🔄 업데이트: N건 | 📊 총 DB 보유: N건
```

### 제약 및 주의사항
- 각 플랫폼 API의 Rate Limit을 준수합니다 (n8n Wait 노드 활용).
- 이메일 등 개인정보는 공개된 프로필 정보만 수집합니다.
- 중국 플랫폼(Douyin, Xiaohongshu, Bilibili)은 접근 제한이 있을 수 있으므로, 가용성을 먼저 확인 후 진행합니다.
- 검색 결과가 없을 경우, 조건 완화 옵션을 사용자에게 제안합니다.

---

## 자주 쓰는 요청 예시

```
# 검색 실행
"Instagram과 YouTube에서 팔로워 5만~10만, 뷰티 카테고리, 한국 인플루언서 찾아줘"

# 결과 조회
"현재 DB에 저장된 TikTok 인플루언서 목록 보여줘"

# 워크플로우 관리
"인플루언서 검색 n8n 워크플로우 상태 확인해줘"

# 스킬 명시 사용
"influencer-search 스킬로 팔로워 10만 이상 일본 유튜버 찾아줘"
```

---

*이 AGENTS.md는 Antigravity 에이전트가 대화 시작 시 자동으로 로드하는 프로젝트 지침 파일입니다.*  
*파일 위치: 프로젝트 루트 `/AGENTS.md`*
