import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import cron from 'node-cron';
import { startCron } from './auto_verify_cron.js';

// Load .env
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

// Start automated background verification
startCron();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Postgres Pool Connection (Host is localhost since Express runs on Mac)
const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'thcho77',
  password: 'whxogud77A!',
  database: 'n8n_database'
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[!] Database connection failed:', err.message);
  } else {
    console.log('[+] Database connected successfully.');
  }
});

// API: Get Influencers List with filters
app.get('/api/influencers', async (req, res) => {
  const { platform, category, country, minFollowers, maxFollowers, bookmarkedOnly, search } = req.query;
  
  let conditions = [];
  let params = [];
  let paramCount = 1;

  if (platform) {
    conditions.push(`platform = $${paramCount}`);
    params.push(platform);
    paramCount++;
  }

  if (category) {
    conditions.push(`category = $${paramCount}`);
    params.push(category);
    paramCount++;
  }

  if (minFollowers) {
    conditions.push(`follower_count >= $${paramCount}`);
    params.push(parseInt(minFollowers, 10));
    paramCount++;
  }

  if (maxFollowers) {
    conditions.push(`follower_count <= $${paramCount}`);
    params.push(parseInt(maxFollowers, 10));
    paramCount++;
  }

  if (bookmarkedOnly === 'true') {
    conditions.push(`is_bookmarked = true`);
  }

  if (country) {
    conditions.push(`country = $${paramCount}`);
    params.push(country);
    paramCount++;
  }

  if (search) {
    conditions.push(`(account_name ILIKE $${paramCount} OR category ILIKE $${paramCount} OR source_data::text ILIKE $${paramCount})`);
    params.push(`%${search}%`);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT id, platform, account_name, account_url, category, country, 
           follower_count, avg_view_count, email, gender, age_range, 
           audience_demo, source_data, is_bookmarked, memo, last_updated, verified_at, verification_status
    FROM influencers
    ${whereClause}
    ORDER BY is_bookmarked DESC, follower_count DESC;
  `;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching influencers:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Get statistics for dashboard cards
app.get('/api/stats', async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM influencers');
    const bookmarkedResult = await pool.query('SELECT COUNT(*) FROM influencers WHERE is_bookmarked = true');
    const platformStatsResult = await pool.query('SELECT platform, COUNT(*) as count FROM influencers GROUP BY platform');
    const categoryStatsResult = await pool.query('SELECT category, COUNT(*) as count FROM influencers GROUP BY category ORDER BY count DESC LIMIT 5');

    res.json({
      totalCount: parseInt(totalResult.rows[0].count, 10),
      bookmarkedCount: parseInt(bookmarkedResult.rows[0].count, 10),
      platforms: platformStatsResult.rows.map(r => ({ name: r.platform, count: parseInt(r.count, 10) })),
      categories: categoryStatsResult.rows.map(r => ({ name: r.category, count: parseInt(r.count, 10) }))
    });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Toggle Bookmark Status
app.put('/api/influencers/:id/bookmark', async (req, res) => {
  const { id } = req.params;
  const { is_bookmarked } = req.body;

  try {
    const query = 'UPDATE influencers SET is_bookmarked = $1, last_updated = NOW() WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [is_bookmarked, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating bookmark:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Update Memo Notes
app.put('/api/influencers/:id/memo', async (req, res) => {
  const { id } = req.params;
  const { memo } = req.body;

  try {
    const query = 'UPDATE influencers SET memo = $1, last_updated = NOW() WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [memo, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating memo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Update Metadata (Country, Category)
app.put('/api/influencers/:id/metadata', async (req, res) => {
  const { id } = req.params;
  const { country, category } = req.body;

  try {
    const query = 'UPDATE influencers SET country = $1, category = $2, last_updated = NOW() WHERE id = $3 RETURNING *';
    const result = await pool.query(query, [country, category, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating metadata:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Delete Influencer
app.delete('/api/influencers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM influencers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting influencer:', err.message);
    res.status(500).json({ error: err.message });
  }
});

let activeCollector = null;

// Helper: Run Python collector script
function runCollector(params) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'collect_real_data.py');
    const env = { ...process.env, SEARCH_PARAMS: JSON.stringify(params) };
    
    const proc = spawn('python3', [scriptPath], { env });
    activeCollector = proc;
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      if (activeCollector === proc) activeCollector = null;
      console.log(`[Collector] Exit code: ${code}`);
      console.log(`[Collector] Output: ${stdout}`);
      if (stderr) console.error(`[Collector] Stderr: ${stderr}`);
      
      // Parse summary from stdout
      let summary = { total: 0, new_count: 0, update_count: 0, platforms: [] };
      const match = stdout.match(/=== 결과 요약 ===\n({[\s\S]+?})/);
      if (match) {
        try { summary = JSON.parse(match[1]); } catch(e) {}
      }
      resolve({ summary, stdout, stderr, code });
    });
    
    proc.on('error', (err) => {
      if (activeCollector === proc) activeCollector = null;
      reject(err);
    });
    
    // 60분 타임아웃 (전체 플랫폼 우회 검색 시 시간이 오래 걸리므로 넉넉하게 연장)
    setTimeout(() => {
      if (activeCollector === proc) {
        proc.kill();
        activeCollector = null;
      }
    }, 3600000);
  });
}

// Helper: Run Node.js verify script
function runVerifyBatch(res, ids) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'verify_influencers.js');
    const env = { ...process.env, IDS: ids.join(',') };
    const proc = spawn('node', [scriptPath], { env });
    activeCollector = proc;
    
    let stdoutBuf = '';
    
    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuf += chunk;
      
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.includes('=== 결과 요약 ===') && !line.startsWith('{')) {
          res.write(`data: ${JSON.stringify({ status: 'log', message: line.trim() })}\n\n`);
        }
      }
    });
    
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          res.write(`data: ${JSON.stringify({ status: 'log', message: '[ERR] ' + line.trim() })}\n\n`);
        }
      }
    });
    
    proc.on('close', (code) => {
      if (activeCollector === proc) activeCollector = null;
      let summary = { total_checked: 0, updated: 0, failed: 0 };
      const match = stdoutBuf.match(/=== 결과 요약 ===\n({[\s\S]+?})/);
      if (match) {
        try { summary = JSON.parse(match[1]); } catch(e) {}
      }
      resolve({ summary, code });
    });
    
    proc.on('error', (err) => {
      if (activeCollector === proc) activeCollector = null;
      reject(err);
    });
  });
}

// API: Verify Influencers Batch
app.post('/api/verify/batch', async (req, res) => {
  if (activeCollector) {
    return res.status(400).json({ error: 'Already running a background task.' });
  }
  
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided for verification.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.write(`data: ${JSON.stringify({ status: 'started' })}\n\n`);
  
  try {
    const { summary, code } = await runVerifyBatch(res, ids);
    
    res.write(`data: ${JSON.stringify({ 
      status: code === 0 ? 'done' : 'error',
      message: code === 0 ? '재검증 완료' : '프로세스 강제 종료 또는 오류',
      total_checked: summary.total_checked,
      updated: summary.updated,
      failed: summary.failed
    })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// API: Stop Collection
app.post('/api/collect/stop', (req, res) => {
  if (activeCollector) {
    activeCollector.kill();
    activeCollector = null;
    res.json({ success: true, message: '수집이 중단되었습니다.' });
  } else {
    res.json({ success: false, message: '현재 진행 중인 수집이 없습니다.' });
  }
});



// Helper function to save and merge custom keywords
function mergeKeywords(newKeywords) {
  if (!newKeywords || !Array.isArray(newKeywords) || newKeywords.length === 0) return [];
  const keywordFile = 'custom_keywords.json';
  let existing = [];
  if (fs.existsSync(keywordFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(keywordFile, 'utf8'));
    } catch (e) {
      console.error('Failed to read custom_keywords.json:', e);
    }
  }
  const merged = [...new Set([...existing, ...newKeywords])];
  fs.writeFileSync(keywordFile, JSON.stringify(merged, null, 2));
  return merged;
}

// Helper function to read saved keywords
function getSavedKeywords() {
  const keywordFile = 'custom_keywords.json';
  if (fs.existsSync(keywordFile)) {
    try {
      return JSON.parse(fs.readFileSync(keywordFile, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

// API: Collect real influencer data via Python script
app.post('/api/collect', async (req, res) => {
  const { platforms, followers_min, followers_max, niche, country, category, keywords } = req.body;
  
  if (keywords && keywords.length > 0) {
    mergeKeywords(keywords);
  }

  const params = {
    platforms: platforms || ['bilibili'],
    category: category || niche || '패션',
    niche: niche || category || '패션',
    followers_min: parseInt(followers_min, 10) || 5000,
    followers_max: parseInt(followers_max, 10) || 10000000,
    country: country || 'ALL',
    keywords: keywords || []
  };
  
  console.log('[Collect] Starting collection with params:', params);
  
  // 즉시 응답 후 백그라운드 수집 (SSE 방식)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.write(`data: ${JSON.stringify({ status: 'started', params })}\n\n`);
  
  try {
    const { summary, code } = await runCollector(params);
    
    res.write(`data: ${JSON.stringify({ 
      status: code === 0 ? 'done' : 'error',
      total: summary.total,
      new_count: summary.new_count,
      update_count: summary.update_count,
      platforms: summary.platforms
    })}\n\n`);
  } catch (err) {
    console.error('[Collect] Error:', err.message);
    res.write(`data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`);
  }
  res.end();
});

// API: Translate text using Gemini API
app.post('/api/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) {
    return res.status(400).json({ error: 'Text and targetLang are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set.' });
  }

  const langNames = {
    'ko': 'Korean (한국어)',
    'en': 'English (영어)',
    'ja': 'Japanese (일본어)',
    'zh-CN': 'Chinese Simplified (중국어 간체)',
    'zh-TW': 'Chinese Traditional (중국어 번체)',
    'zh-HK': 'Chinese Traditional Hong Kong (중국어 번체 홍콩)',
    'vi': 'Vietnamese (베트남어)',
    'th': 'Thai (태국어)',
    'id': 'Indonesian (인도네시아어)'
  };

  const targetLangName = langNames[targetLang] || targetLang;
  const prompt = `Translate the following campaign proposal text into ${targetLangName}. 
Preserve any URLs, placeholders, or HTML tags exactly as they are. 
Output ONLY the final translated text without any conversational filler, quotes, introductory or outro text.

Text to translate:
${text}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ]
  };

  const tryModel = async (modelName) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${modelName}): ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text;
    }
    throw new Error(`Invalid response format from Gemini API (${modelName})`);
  };

  try {
    // Try Gemini 3.5 Flash first
    const translatedText = await tryModel('gemini-3.5-flash');
    res.json({ translatedText });
  } catch (err35) {
    console.warn('[Gemini 3.5 Flash failed, trying fallback 2.5 Flash]:', err35.message);
    try {
      // Fallback to Gemini 2.5 Flash
      const translatedText = await tryModel('gemini-2.5-flash');
      res.json({ translatedText });
    } catch (err25) {
      console.error('[Gemini translation failed]:', err25.message);
      res.status(500).json({ error: err25.message });
    }
  }
});

// API: Send Campaign DM (Simulation)
app.post('/api/campaign/send', async (req, res) => {
  const { method, platform, influencer_ids, message, product_url, content_url } = req.body;
  
  if (!influencer_ids || influencer_ids.length === 0) {
    return res.status(400).json({ success: false, error: '대상 인플루언서가 없습니다.' });
  }

  console.log(`[Campaign] 발송 요청 시작. 플랫폼: ${platform}, 대상: ${influencer_ids.length}명, 방식: ${method}`);
  console.log(`[Campaign] 메시지: ${message.slice(0, 50)}...`);
  console.log(`[Campaign] 상품URL: ${product_url}, 콘텐츠URL: ${content_url}`);

  // 시뮬레이션: 약간의 딜레이 후 성공 응답 반환
  setTimeout(() => {
    console.log(`[Campaign] 시뮬레이션 모드 - 발송 완료 처리`);
    res.json({
      success: true,
      sent_count: influencer_ids.length,
      mode: 'simulation'
    });
  }, 1500);
});

// API: Trigger search (try n8n first, fallback to Python direct)
app.post('/api/search', async (req, res) => {
  const { platforms, followers_min, followers_max, niche, country, category, keywords } = req.body;

  if (keywords && keywords.length > 0) {
    mergeKeywords(keywords);
  }

  const params = {
    platforms: platforms || ['bilibili'],
    category: category || niche || '패션',
    niche: niche || category || '패션',
    followers_min: parseInt(followers_min, 10) || 5000,
    followers_max: parseInt(followers_max, 10) || 10000000,
    country: country || 'ALL',
    keywords: keywords || []
  };

  // Python 스크립트로 직접 수집
  console.log('[Search] Triggering Python collector:', params);
  
  try {
    const { summary, code } = await runCollector(params);
    
    if (code === 0) {
      // DB에서 최신 통계 조회
      const statsResult = await pool.query(
        'SELECT COUNT(*) FROM influencers WHERE platform = ANY($1)',
        [params.platforms]
      );
      
      res.json({
        success: true,
        data: {
          total_collected: summary.total,
          new_count: summary.new_count,
          update_count: summary.update_count,
          platforms: summary.platforms,
          db_total: parseInt(statsResult.rows[0].count, 10)
        }
      });
    } else {
      res.status(500).json({ error: 'Collection script failed', code });
    }
  } catch (err) {
    console.error('[Search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start 1-hour interval automated collection batch job for all platforms except YouTube
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Starting automated batch collection (Every 1 hour) - excluding YouTube');
  const categories = ['패션', '뷰티', '먹방', '여행', '게임', '테크', '음악', '엔터', '일반', '교육', '동물'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const autoKeywords = getSavedKeywords();
  
  const params = {
    platforms: ['naver_blog', 'instagram', 'facebook', 'threads', 'tiktok', 'twitter', 'cosme', 'douyin', 'xiaohongshu', 'bilibili'],
    category: randomCategory,
    niche: randomCategory,
    followers_min: 1000,
    followers_max: 10000000,
    country: 'ALL',
    keywords: autoKeywords
  };
  
  try {
    const { summary, code } = await runCollector(params);
    console.log(`[Cron] Batch collection finished. Exit Code: ${code}`);
    console.log(`[Cron] Result: Total ${summary.total}, New ${summary.new_count}, Update ${summary.update_count}`);
  } catch (err) {
    console.error('[Cron] Batch collection failed:', err.message);
  }
});

// Start 3-hour interval automated collection specifically for YouTube
cron.schedule('0 */3 * * *', async () => {
  console.log('[Cron] Starting automated batch collection specifically for YouTube (Every 3 hours)');
  const categories = ['패션', '뷰티', '먹방', '여행', '게임', '테크', '음악', '엔터', '일반', '교육', '동물'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const autoKeywords = getSavedKeywords();
  
  const params = {
    platforms: ['youtube'],
    category: randomCategory,
    niche: randomCategory,
    followers_min: 1000,
    followers_max: 10000000,
    country: 'ALL',
    keywords: autoKeywords
  };
  
  try {
    const { summary, code } = await runCollector(params);
    console.log(`[Cron] YouTube Batch collection finished. Exit Code: ${code}`);
    console.log(`[Cron] YouTube Result: Total ${summary.total}, New ${summary.new_count}, Update ${summary.update_count}`);
  } catch (err) {
    console.error('[Cron] YouTube Batch collection failed:', err.message);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[+] Influencer Dashboard Server running on http://localhost:${PORT}`);
});
