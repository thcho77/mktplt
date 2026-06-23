from duckduckgo_search import DDGS

try:
    with DDGS() as ddgs:
        results = [r for r in ddgs.text('site:instagram.com "fashion"', max_results=10)]
        print(f"Results: {len(results)}")
        for r in results:
            print(f"URL: {r['href']}\nTitle: {r['title']}\nBody: {r['body']}\n")
except Exception as e:
    print(f"Error: {e}")
