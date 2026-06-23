import pg from 'pg';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in Node 18+
import fs from 'fs';
import path from 'path';

// Read .env manually to avoid dotenv dependency if not installed
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^#\s=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').trim();
    }
  });
}

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'thcho77',
  password: process.env.DB_PASSWORD || 'whxogud77A!',
  database: process.env.DB_NAME || 'n8n_database'
});

const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function run() {
  if (!APIFY_TOKEN) {
    console.error('Error: APIFY_TOKEN is not set in .env');
    process.exit(1);
  }

  try {
    console.log('Fetching Instagram accounts from the database...');
    const result = await pool.query("SELECT id, account_name FROM influencers WHERE platform = 'instagram'");
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('No Instagram accounts found to verify.');
      console.log('\n=== 결과 요약 ===\n' + JSON.stringify({ total_checked: 0, updated: 0, failed: 0 }));
      process.exit(0);
    }

    console.log(`Found ${rows.length} Instagram accounts. Starting Apify verification...`);

    const BATCH_SIZE = 30; // Max usernames per Apify call to avoid timeout
    let totalUpdated = 0;
    let totalFailed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const usernames = batch.map(r => r.account_name);
      
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(rows.length/BATCH_SIZE)} (${usernames.length} accounts)...`);

      const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      
      try {
        const response = await fetch(apifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames })
        });

        if (!response.ok) {
          throw new Error(`Apify request failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Data is an array of profile objects
        for (const item of data) {
          const username = item.username;
          if (!username) continue;
          
          const fCount = parseInt(item.followersCount || 0);
          
          if (fCount > 0) {
            // Find the ID for this username
            const targetRow = batch.find(r => r.account_name.toLowerCase() === username.toLowerCase());
            if (targetRow) {
              await pool.query('UPDATE influencers SET follower_count = $1, last_updated = NOW() WHERE id = $2', [fCount, targetRow.id]);
              totalUpdated++;
            }
          } else {
            totalFailed++;
            console.log(`Failed to get followers for: ${username}`);
          }
        }
      } catch (err) {
        console.error(`Batch failed: ${err.message}`);
        totalFailed += batch.length;
      }
    }

    console.log(`Verification complete. Updated: ${totalUpdated}, Failed/Not Found: ${totalFailed}`);
    
    // Output summary JSON so server.js can parse it easily
    const summary = {
      total_checked: rows.length,
      updated: totalUpdated,
      failed: totalFailed
    };
    console.log('\n=== 결과 요약 ===\n' + JSON.stringify(summary));

  } catch (err) {
    console.error('Database query failed:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

run();
