from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    try:
        page.goto('https://my.cosme.net/open_top/show/user_id/4610124', timeout=15000)
        print("Page title:", page.title())
        
        # We can extract text directly
        text = page.locator('body').inner_text()
        found = False
        for line in text.split('\n'):
            if 'フォロワー' in line:
                print("Found:", line)
                found = True
                
        # Alternative: try looking for CSS selectors
        # cosme my page usually has .usr-follower-cnt or something
        if not found:
            print("Did not find 'フォロワー' in text. Entire text:")
            print(text[:500])
    except Exception as e:
        print("Error:", e)
    finally:
        browser.close()
