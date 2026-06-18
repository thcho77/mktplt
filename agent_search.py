#!/usr/bin/env python3
import argparse
import json
import urllib.request
import urllib.error
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
    parser = argparse.ArgumentParser(description="인플루언서 검색 및 동기화")
    parser.add_argument('--platforms', '-p', required=True, help="플랫폼 목록 (예: instagram,youtube)")
    parser.add_argument('--followers', '-f', default="10000-100000", help="팔로워 수 범위 (예: 10000-50000)")
    parser.add_argument('--niche', '-n', default="일상", help="검색 키워드/분야")
    parser.add_argument('--country', '-c', default="KR", help="ISO 국가 코드 (예: KR)")
    parser.add_argument('--category', default=None, help="콘텐츠 카테고리 (미지정시 niche와 동일)")

    args = parser.parse_args()

    # Parse followers range
    try:
        if '-' in args.followers:
            f_min, f_max = map(int, args.followers.split('-'))
        else:
            f_min = int(args.followers)
            f_max = 100000000  # Default high limit
    except ValueError:
        print("Error: followers format must be MIN-MAX (e.g., 10000-50000)", file=sys.stderr)
        sys.exit(1)

    platforms = [p.strip().lower() for p in args.platforms.split(',')]
    category = args.category if args.category else args.niche

    payload = {
        "platforms": platforms,
        "followers_min": f_min,
        "followers_max": f_max,
        "niche": args.niche,
        "country": args.country,
        "category": category
    }

    print(f"[*] n8n 워크플로우를 호출하여 인플루언서 검색을 진행합니다...")
    print(f"    조건: 플랫폼={platforms}, 팔로워={f_min:,}~{f_max:,}, 분야={args.niche}, 국가={args.country}")

    webhook_url = "http://localhost:5678/webhook/influencer-search"
    try:
        req = urllib.request.Request(
            webhook_url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status != 200:
                print(f"Error: n8n webhook returned status code {response.status}", file=sys.stderr)
                sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: Failed to connect to n8n webhook: {e}", file=sys.stderr)
        sys.exit(1)

    print("[+] n8n 워크플로우 실행 완료! DB 데이터를 조회합니다...")

    # Query the database for the results matching these platforms and parameters
    # Retrieve top 20 updated recently in last 5 minutes
    platforms_str = ", ".join([f"'{p}'" for p in platforms])
    query = f"""
    SELECT platform, account_name, category, follower_count, email, avg_view_count
    FROM influencers
    WHERE platform IN ({platforms_str})
      AND follower_count >= {f_min}
      AND follower_count <= {f_max}
      AND last_updated >= NOW() - INTERVAL '5 minutes'
    ORDER BY follower_count DESC
    LIMIT 20;
    """
    
    db_result = run_psql(query)
    if not db_result:
        print("\n검색된 인플루언서가 없거나 DB 저장에 실패했습니다.")
        sys.exit(0)

    lines = db_result.split('\n')
    
    print("\n### 📊 인플루언서 검색 결과 요약\n")
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

    # Get stats
    stats_query = """
    SELECT 
      (SELECT COUNT(*) FROM influencers) as total,
      (SELECT result_count FROM search_logs ORDER BY executed_at DESC LIMIT 1) as search_res,
      (SELECT new_count FROM search_logs ORDER BY executed_at DESC LIMIT 1) as search_new;
    """
    stats_result = run_psql(stats_query)
    total_db = 0
    search_res = 0
    search_new = 0
    if stats_result:
        parts = stats_result.split('|')
        if len(parts) >= 3:
            total_db = int(parts[0])
            search_res = int(parts[1]) if parts[1] else 0
            search_new = int(parts[2]) if parts[2] else 0
            
    update_count = max(0, search_res - search_new)
    print(f"\n✅ 신규 추가: {search_new}건 | 🔄 업데이트: {update_count}건 | 📊 총 DB 보유: {total_db}건")

if __name__ == '__main__':
    main()
