const APIFY_TOKEN = process.env.APIFY_TOKEN;
const usernames = ["instagram"];
const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usernames })
})
.then(r => r.text())
.then(t => {
  console.log("Status:", t.substring(0, 500));
})
.catch(e => console.error(e));
