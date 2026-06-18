-- influencers 테이블 생성
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

-- search_logs 테이블 생성
CREATE TABLE IF NOT EXISTS search_logs (
    id              SERIAL PRIMARY KEY,
    search_params   JSONB         NOT NULL,          -- 사용된 검색 조건
    result_count    INT,                             -- 검색된 결과 수
    new_count       INT,                             -- 신규 추가된 건수
    executed_at     TIMESTAMP DEFAULT NOW()          -- 실행 시각
);
