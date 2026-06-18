import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
  const { platform, category, minFollowers, maxFollowers, bookmarkedOnly, search } = req.query;
  
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

  if (search) {
    conditions.push(`(account_name ILIKE $${paramCount} OR category ILIKE $${paramCount})`);
    params.push(`%${search}%`);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT id, platform, account_name, account_url, category, country, 
           follower_count, avg_view_count, email, gender, age_range, 
           audience_demo, source_data, is_bookmarked, memo, last_updated
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
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating memo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Run Python collector script
function runCollector(params) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'collect_real_data.py');
    const env = { ...process.env, SEARCH_PARAMS: JSON.stringify(params) };
    
    const proc = spawn('python3', [scriptPath], { env });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
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
    
    proc.on('error', reject);
    
    // 3분 타임아웃
    setTimeout(() => proc.kill(), 180000);
  });
}

// API: Collect real influencer data via Python script
app.post('/api/collect', async (req, res) => {
  const { platforms, followers_min, followers_max, niche, country, category } = req.body;
  
  const params = {
    platforms: platforms || ['bilibili'],
    category: category || niche || '패션',
    niche: niche || category || '패션',
    followers_min: parseInt(followers_min, 10) || 5000,
    followers_max: parseInt(followers_max, 10) || 10000000,
    country: country || 'ALL'
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

// API: Trigger search (try n8n first, fallback to Python direct)
app.post('/api/search', async (req, res) => {
  const { platforms, followers_min, followers_max, niche, country, category } = req.body;

  const params = {
    platforms: platforms || ['bilibili'],
    category: category || niche || '패션',
    niche: niche || category || '패션',
    followers_min: parseInt(followers_min, 10) || 5000,
    followers_max: parseInt(followers_max, 10) || 10000000,
    country: country || 'ALL'
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

// Start server
app.listen(PORT, () => {
  console.log(`[+] Influencer Dashboard Server running on http://localhost:${PORT}`);
});
