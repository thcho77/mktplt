import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false, // try non-headless for testing to bypass some blocks if needed, but 'new' is standard. Let's use 'new'
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log("Navigating...");
  try {
    await page.goto('https://www.cosme.net/user/10292789/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log("Page loaded. Waiting for follower text...");
    
    // Give it 3 seconds to render JS
    await new Promise(r => setTimeout(r, 3000));
    
    const followerCount = await page.evaluate(() => {
      // Find all divs or spans, or just match text
      const items = Array.from(document.querySelectorAll('*'));
      for (let el of items) {
        if (el.textContent && el.textContent.includes('フォロワー') && el.textContent.length < 20) {
          // might be "フォロワー 1,234"
          return el.textContent.replace(/\s+/g, ' ').trim();
        }
      }
      
      // another approach: look for a element with text "フォロワー" then get next sibling
      for (let el of items) {
        if (el.textContent.trim() === 'フォロワー') {
          return el.parentElement.textContent.replace(/\s+/g, ' ').trim();
        }
      }
      return "Not found";
    });
    
    console.log("Follower info:", followerCount);
    
    // Also print some raw text to see what rendered
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log("Body preview:", bodyText);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
