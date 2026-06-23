from duckduckgo_search import DDGS
with DDGS() as ddgs:
    res = list(ddgs.text('site:tiktok.com "메이크업"', max_results=50))
    print("Found", len(res), "items")
    if res:
        print(res[0])
