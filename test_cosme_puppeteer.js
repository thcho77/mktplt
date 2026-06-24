import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  console.log("Navigating...");
  await page.goto('https://www.cosme.net/user/10292789/', { waitUntil: 'networkidle2' });
  
  console.log("Evaluating...");
  const followersText = await page.evaluate(() => {
    // Look for text containing 'フォロワー'
    const elements = document.querySelectorAll('*');
    for (let el of elements) {
      if (el.textContent && el.textContent.includes('フォロワー')) {
        return el.textContent.replace(/\n/g, ' ').trim();
      }
    }
    return "Not found";
  });
  
  console.log('Result:', followersText);
  await browser.close();
})();
