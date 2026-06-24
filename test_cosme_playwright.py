from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://www.cosme.net/user/10292789/')
    
    print("Page title:", page.title())
    
    # Let's find followers
    # The text usually is 'フォロワー 123'
    # We can get all text from body
    text = page.locator('body').inner_text()
    for line in text.split('\n'):
        if 'フォロワー' in line:
            print("Found:", line)
            
    browser.close()
