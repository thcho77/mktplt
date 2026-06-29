import cron from 'node-cron';
import pg from 'pg';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'thcho77',
  password: process.env.DB_PASSWORD || 'whxogud77A!',
  database: process.env.DB_NAME || 'n8n_database'
});

export function startCron() {
  console.log('[CRON] Starting background automated verification cron job (5,15,25,35,45,55 * * * *)');
  
  // Runs at 5, 15, 25, 35, 45, 55 minutes past the hour. Skips 00.
  cron.schedule('5,15,25,35,45,55 * * * *', async () => {
    console.log(`[CRON] ${new Date().toISOString()} - Triggering automated verification for 100 accounts...`);
    try {
      // 1. Get 100 accounts. Priority: 
      //    unverified (verification_status = 'unverified' or NULL)
      //    then ordered by verified_at ASC NULLS FIRST
      //    We ignore 'failed' unless we really want to retry them later, but for now we skip them if we have others.
      //    Actually, let's just order by verified_at ASC NULLS FIRST so it cycles through everything eventually.
      //    But wait, user said "검증 불가 배지를 남겨서 반복 검증 시도가 안되게 만들어 주고".
      //    So we should exclude 'failed' completely from automated retry?
      //    Or maybe retry 'failed' after 30 days? Let's exclude 'failed' from auto verification to save API limits.
      const query = `
        SELECT id FROM influencers 
        WHERE verification_status IS NULL 
           OR (verification_status != 'verified' AND verification_status != 'failed')
        ORDER BY verified_at ASC NULLS FIRST 
        LIMIT 100
      `;
      const res = await pool.query(query);
      if (res.rows.length === 0) {
        console.log('[CRON] No unverified/verifiable accounts found.');
        return;
      }
      
      const ids = res.rows.map(r => r.id);
      console.log(`[CRON] Selected ${ids.length} accounts to verify. Executing verify_influencers.js...`);
      
      const scriptPath = path.join(__dirname, 'verify_influencers.js');
      const env = { ...process.env, IDS: ids.join(',') };
      
      const proc = spawn('node', [scriptPath], { env });
      
      proc.stdout.on('data', (data) => {
        // console.log(`[CRON-Worker] ${data.toString().trim()}`);
      });
      
      proc.stderr.on('data', (data) => {
        console.error(`[CRON-Worker-Err] ${data.toString().trim()}`);
      });
      
      proc.on('close', (code) => {
        console.log(`[CRON] Worker completed with code ${code}.`);
      });

    } catch (err) {
      console.error('[CRON] Error querying db:', err);
    }
  });
}
