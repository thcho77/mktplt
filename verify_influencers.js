import pg from 'pg';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

// Read .env
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
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Utils
function parseNumber(text) {
  if (!text) return 0;
  let numStr = text.toString().toLowerCase().replace(/,/g, '').trim();
  let multiplier = 1;
  if (numStr.endsWith('k') || numStr.endsWith('천')) {
    multiplier = 1000;
    numStr = numStr.slice(0, -1);
  } else if (numStr.endsWith('m')) {
    multiplier = 1000000;
    numStr = numStr.slice(0, -1);
  } else if (numStr.endsWith('만')) {
    multiplier = 10000;
    numStr = numStr.slice(0, -1);
  } else if (numStr.endsWith('억')) {
    multiplier = 100000000;
    numStr = numStr.slice(0, -1);
  }
  return parseInt(parseFloat(numStr) * multiplier) || 0;
}

async function verifyApify(platform, apifyAct, usernames, batchRows) {
  if (!APIFY_TOKEN) {
    console.log(`[ERR] APIFY_TOKEN 누락. ${platform} 검증 불가`);
    return 0;
  }
  let updated = 0;
  console.log(`[Apify] ${platform} 계정 ${usernames.length}개 API 요청 중...`);
  const apifyUrl = `https://api.apify.com/v2/acts/${apifyAct}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  
  try {
    const response = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(platform === 'tiktok' ? { profiles: usernames } : { usernames })
    });
    if (!response.ok) throw new Error(`Apify status: ${response.status}`);
    const data = await response.json();
    
    const processedIds = new Set();
    for (const item of data) {
      // Instagram uses username/followersCount, TikTok uses uniqueId/stats.followerCount
      const uname = platform === 'tiktok' ? item.uniqueId : item.username;
      const followers = platform === 'tiktok' ? (item.stats?.followerCount || 0) : (item.followersCount || 0);
      
      if (!uname) continue;
      
      const targetRow = batchRows.find(r => r.account_name.toLowerCase() === uname.toLowerCase());
      if (targetRow) {
        processedIds.add(targetRow.id);
        if (followers > 0) {
          await pool.query("UPDATE influencers SET follower_count = $1, verified_at = NOW(), verification_status = 'verified' WHERE id = $2", [followers, targetRow.id]);
          updated++;
        } else {
          // just mark as failed if we couldn't get followers to avoid endless loops
          await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [targetRow.id]);
        }
      }
    }
    
    // Mark missing profiles as failed
    for (const r of batchRows) {
      if (!processedIds.has(r.id)) {
        await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [r.id]);
      }
    }
  } catch (e) {
    console.log(`[ERR] Apify ${platform} 요청 실패: ${e.message}`);
    for (const r of batchRows) {
      await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [r.id]);
    }
  }
  return updated;
}

async function verifyYoutube(row) {
  if (!YOUTUBE_API_KEY) return false;
  try {
    const url = row.account_url;
    let channelId = '';
    const sourceData = row.source_data || {};
    if (sourceData.channel_id) channelId = sourceData.channel_id;
    else {
      const match = url.match(/channel\/([^/?&]+)/);
      if (match) channelId = match[1];
    }
    
    if (channelId) {
      const api = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(api);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const count = parseInt(data.items[0].statistics.subscriberCount || 0);
          if (count > 0) {
            await pool.query("UPDATE influencers SET follower_count = $1, verified_at = NOW(), verification_status = 'verified' WHERE id = $2", [count, row.id]);
            return true;
          }
        }
      }
    }
  } catch (e) {}
  await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
  return false;
}

async function verifyNaverBlog(row) {
  try {
    const blogIdMatch = row.account_url.match(/blog\.naver\.com\/([^\/?&]+)/);
    if (!blogIdMatch) {
      await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
      return false;
    }
    const blogId = blogIdMatch[1];
    const res = await fetch(`https://blog.naver.com/${blogId}`);
    const html = await res.text();
    let count = 0;
    const nb_m = html.match(/(?:neighborCount["']?\s*:\s*|이웃\s*<[^>]*>\s*)([\d,]+)/);
    if (nb_m) count = parseNumber(nb_m[1]);
    else {
      const sub_m = html.match(/구독자\s*([\d,]+)/);
      if (sub_m) count = parseNumber(sub_m[1]);
    }
    if (count > 0) {
      await pool.query("UPDATE influencers SET follower_count = $1, verified_at = NOW(), verification_status = 'verified' WHERE id = $2", [count, row.id]);
      return true;
    }
  } catch (e) {}
  await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
  return false;
}

async function verifyBilibili(row) {
  try {
    const sourceData = row.source_data || {};
    let mid = sourceData.mid;
    if (!mid) {
      const m = row.account_url.match(/space\.bilibili\.com\/(\d+)/);
      if (m) mid = m[1];
    }
    if (mid) {
      const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${mid}`);
      const data = await res.json();
      if (data.code === 0 && data.data && data.data.follower) {
        const count = data.data.follower;
        await pool.query("UPDATE influencers SET follower_count = $1, verified_at = NOW(), verification_status = 'verified' WHERE id = $2", [count, row.id]);
        return true;
      }
    }
  } catch (e) {}
  await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
  return false;
}

async function verifyUnsupported(row) {
  // Mark as failed/unsupported to prevent repeated attempts
  await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
  return false;
}

async function verifyCosme(browser, row) {
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(row.account_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    
    let count = 0;
    for (const line of text.split('\n')) {
      if (line.includes('フォロワー')) {
        const m = line.match(/フォロワー\s*([\d,]+)/);
        if (m) {
          count = parseNumber(m[1]);
          break;
        }
      }
    }
    
    if (count > 0) {
      await pool.query("UPDATE influencers SET follower_count = $1, verified_at = NOW(), verification_status = 'verified' WHERE id = $2", [count, row.id]);
      return true;
    }
  } catch (e) {
    console.error(`[Cosme] Error verifying ${row.account_url}:`, e.message);
  }
  await pool.query("UPDATE influencers SET verified_at = NOW(), verification_status = 'failed' WHERE id = $1", [row.id]);
  return false;
}

async function run() {
  const idString = process.env.IDS;
  if (!idString) {
    console.error('Error: IDS env var not set.');
    process.exit(1);
  }

  const ids = idString.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (ids.length === 0) {
    console.log('No valid IDs provided.');
    console.log('\n=== 결과 요약 ===\n' + JSON.stringify({ total_checked: 0, updated: 0, failed: 0 }));
    process.exit(0);
  }

  try {
    console.log(`Fetching ${ids.length} accounts from DB for verification...`);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`SELECT id, platform, account_name, account_url, source_data FROM influencers WHERE id IN (${placeholders})`, ids);
    const rows = result.rows;

    let totalUpdated = 0;
    
    // Group by platform
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.platform]) grouped[r.platform] = [];
      grouped[r.platform].push(r);
    }

    // Process Instagram via Apify
    if (grouped['instagram']) {
      const igs = grouped['instagram'];
      console.log(`[Processing] Instagram: ${igs.length} accounts`);
      for (let i = 0; i < igs.length; i += 30) {
        const batch = igs.slice(i, i + 30);
        totalUpdated += await verifyApify('instagram', 'apify~instagram-profile-scraper', batch.map(r => r.account_name), batch);
      }
    }

    // Process TikTok via Apify
    if (grouped['tiktok']) {
      const tts = grouped['tiktok'];
      console.log(`[Processing] TikTok: ${tts.length} accounts`);
      for (let i = 0; i < tts.length; i += 30) {
        const batch = tts.slice(i, i + 30);
        totalUpdated += await verifyApify('tiktok', 'apify~tiktok-profile-scraper', batch.map(r => r.account_name), batch);
      }
    }

    // Process YouTube
    if (grouped['youtube']) {
      const yts = grouped['youtube'];
      console.log(`[Processing] YouTube: ${yts.length} accounts`);
      for (const row of yts) {
        const success = await verifyYoutube(row);
        if (success) totalUpdated++;
      }
    }

    // Process Naver Blog
    if (grouped['naver_blog']) {
      const nbs = grouped['naver_blog'];
      console.log(`[Processing] Naver Blog: ${nbs.length} accounts`);
      for (const row of nbs) {
        const success = await verifyNaverBlog(row);
        if (success) totalUpdated++;
      }
    }

    // Process Bilibili
    if (grouped['bilibili']) {
      const bilis = grouped['bilibili'];
      console.log(`[Processing] Bilibili: ${bilis.length} accounts`);
      for (const row of bilis) {
        const success = await verifyBilibili(row);
        if (success) totalUpdated++;
      }
    }

    // Process Cosme
    if (grouped['cosme']) {
      const cosmes = grouped['cosme'];
      console.log(`[Processing] Cosme: ${cosmes.length} accounts`);
      let browser = null;
      try {
        browser = await puppeteer.launch({ 
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        for (const row of cosmes) {
          const success = await verifyCosme(browser, row);
          if (success) totalUpdated++;
        }
      } catch (e) {
        console.error("[Cosme] Browser launch error:", e);
      } finally {
        if (browser) await browser.close();
      }
    }


    // Unsupported platforms (X, Xiaohongshu, Douyin, Facebook, Threads)
    const unsupported = ['twitter', 'xiaohongshu', 'douyin', 'facebook', 'threads'];
    for (const plat of unsupported) {
      if (grouped[plat]) {
        console.log(`[Processing] ${plat} (수동 확인/기존 수치 유지): ${grouped[plat].length} accounts`);
        for (const row of grouped[plat]) {
          await verifyUnsupported(row);
          // We don't count these as 'updated' follower_count, just verified_at updated.
        }
      }
    }

    console.log(`Verification complete. Successfully updated follower counts: ${totalUpdated}`);
    
    const summary = {
      total_checked: rows.length,
      updated: totalUpdated,
      failed: rows.length - totalUpdated
    };
    console.log('\n=== 결과 요약 ===\n' + JSON.stringify(summary));

  } catch (err) {
    console.error('Failed to verify:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

run();
