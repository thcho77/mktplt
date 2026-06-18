#!/usr/bin/env python3
import argparse
import subprocess
import sys

def run_psql(query):
    try:
        # Run psql inside the docker container
        cmd = [
            'docker', 'exec', 'postgres', 
            'psql', '-U', 'thcho77', '-d', 'n8n_database', 
            '-t', '-A', '-c', query
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Database error: {e.stderr}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(description="저장된 인플루언서 목록 조회")
    parser.add_argument('--platform', '-p', help="필터링할 플랫폼 목록 (예: instagram,tiktok)")
    parser.add_argument('--category', '-c', help="필터링할 카테고리 목록 (예: 패션,뷰티)")
    parser.add_argument('--followers', '-f', help="팔로워 수 범위 (예: 10000-50000)")
    parser.add_argument('--limit', '-l', type=int, default=20, help="최대 출력 개수 (기본값: 20)")

    args = parser.parse_args()

    conditions = []
    
    # Platform filter
    if args.platform:
        platforms = [p.strip().lower() for p in args.platform.split(',')]
        p_str = ", ".join([f"'{p}'" for p in platforms])
        conditions.append(f"platform IN ({p_str})")
        
    # Category filter
    if args.category:
        categories = [c.strip() for c in args.category.split(',')]
        c_str = ", ".join([f"'{c}'" for c in categories])
        conditions.append(f"category IN ({c_str})")
        
    # Followers filter
    if args.followers:
        try:
            if '-' in args.followers:
                f_min, f_max = map(int, args.followers.split('-'))
                conditions.append(f"follower_count >= {f_min} AND follower_count <= {f_max}")
            else:
                f_min = int(args.followers)
                conditions.append(f"follower_count >= {f_min}")
        except ValueError:
            print("Error: followers format must be MIN-MAX (e.g., 10000-50000)", file=sys.stderr)
            sys.exit(1)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
    SELECT platform, account_name, category, follower_count, email, avg_view_count
    FROM influencers
    {where_clause}
    ORDER BY follower_count DESC
    LIMIT {args.limit};
    """

    db_result = run_psql(query)
    
    # Get total count for statistics
    total_query = "SELECT COUNT(*) FROM influencers;"
    total_db = run_psql(total_query)
    total_db = int(total_db) if total_db else 0
    
    # Get filtered count
    filtered_query = f"SELECT COUNT(*) FROM influencers {where_clause};"
    filtered_db = run_psql(filtered_query)
    filtered_db = int(filtered_db) if filtered_db else 0

    if not db_result:
        print("\n[!] 조건에 부합하는 인플루언서가 존재하지 않습니다.")
        print(f"📊 총 DB 보유: {total_db}건")
        sys.exit(0)

    lines = db_result.split('\n')
    
    print(f"\n### 📊 인플루언서 목록 조회 결과 (필터 조건에 부합하는 {filtered_db}건 중 상위 {len(lines)}건)\n")
    print("| 플랫폼명 | 계정명 | 카테고리 | 팔로워수 | 이메일 | 평균도달수 |")
    print("|---------|--------|---------|---------|--------|-----------|")
    
    for line in lines:
        if not line:
            continue
        parts = line.split('|')
        if len(parts) >= 6:
            platform = parts[0]
            account_name = parts[1]
            category = parts[2]
            followers = int(parts[3])
            email = parts[4]
            avg_views = int(parts[5])
            print(f"| {platform.capitalize()} | {account_name} | {category} | {followers:,}명 | {email if email else '-'} | {avg_views:,} |")

    print(f"\n📊 필터된 결과: {filtered_db}건 | 📊 총 DB 보유: {total_db}건")

if __name__ == '__main__':
    main()
