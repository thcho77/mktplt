// ============================================================
//  INFLUHUB — Frontend Application Logic
//  Multi-platform Influencer Discovery & Management System
// ============================================================

'use strict';

// ---- State ----
const state = {
  influencers: [],
  filtered: [],
  bookmarkFilter: false,
  currentSort: { field: 'follower_count', dir: 'desc' },
  currentPage: 1,
  pageSize: 20,
  selectedInfluencer: null,
  genderChart: null,
  ageChart: null,
  platformChart: null,
  categoryChart: null
};

const API = '';

// ---- Utilities ----
const $ = (id) => document.getElementById(id);
const fmtNum = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '만';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const PLATFORM_LABELS = {
  naver_blog: '네이버 블로그', instagram: 'Instagram', facebook: 'Facebook',
  youtube: 'YouTube', threads: 'Threads', tiktok: 'TikTok',
  twitter: 'X (Twitter)', cosme: '@cosme', douyin: 'Douyin',
  xiaohongshu: '小红书', bilibili: 'Bilibili'
};

// ---- Navigation ----
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $(`view-${name}`).classList.add('active');
  $(`nav-${name}`)?.classList.add('active');

  const titles = {
    dashboard: ['대시보드', '인플루언서 현황 및 통계 요약'],
    influencers: ['인플루언서 목록', '전체 수집된 인플루언서 데이터 조회'],
    collect: ['데이터 수집', '플랫폼별 인플루언서 검색 및 수집'],
    bookmarks: ['즐겨찾기', '협업 후보로 저장한 인플루언서 목록']
  };
  $('page-title').textContent = titles[name][0];
  $('page-subtitle').textContent = titles[name][1];

  if (name === 'bookmarks') renderBookmarks();
  if (name === 'influencers') renderTable();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(item.dataset.view);
  });
});

// ---- Global Refresh ----
$('btn-global-refresh').addEventListener('click', () => {
  loadStats();
  loadInfluencers();
});

// ---- Load Stats & Dashboard ----
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();

    // Update stat cards
    $('stat-total').textContent = (data.totalCount || 0).toLocaleString() + '명';
    $('stat-bookmarked').textContent = (data.bookmarkedCount || 0).toLocaleString() + '명';

    const getPlatformCount = (name) => {
      const p = (data.platforms || []).find(x => x.name === name);
      return (p ? parseInt(p.count) : 0).toLocaleString() + '명';
    };

    $('stat-instagram').textContent = getPlatformCount('instagram');
    $('stat-youtube').textContent = getPlatformCount('youtube');
    $('stat-bilibili').textContent = getPlatformCount('bilibili');
    $('stat-naver').textContent = getPlatformCount('naver_blog');

    // DB status
    $('db-status').querySelector('.status-text').textContent = 'DB 연결됨';
    $('db-status').querySelector('.status-dot').classList.remove('error');

    // Render charts
    renderPlatformChart(data.platforms || []);
    renderCategoryChart(data.categories || []);

  } catch (err) {
    console.error('Stats load error:', err);
    $('db-status').querySelector('.status-text').textContent = 'DB 연결 오류';
    $('db-status').querySelector('.status-dot').classList.add('error');
  }
}

function renderPlatformChart(platforms) {
  const ctx = $('chart-platform');
  if (!ctx) return;
  if (state.platformChart) state.platformChart.destroy();

  const colors = [
    '#8b5cf6','#22d3ee','#f472b6','#f87171','#60a5fa',
    '#34d399','#fbbf24','#a78bfa','#67e8f9','#fca5a5','#93c5fd'
  ];

  state.platformChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: platforms.map(p => PLATFORM_LABELS[p.name] || p.name),
      datasets: [{
        data: platforms.map(p => p.count),
        backgroundColor: platforms.map((_, i) => colors[i % colors.length] + 'CC'),
        borderColor: platforms.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#a89bc2', font: { size: 11 }, padding: 10, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}명`
          }
        }
      }
    }
  });
}

function renderCategoryChart(categories) {
  const ctx = $('chart-category');
  if (!ctx) return;
  if (state.categoryChart) state.categoryChart.destroy();

  state.categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map(c => c.name || '기타'),
      datasets: [{
        data: categories.map(c => c.count),
        backgroundColor: 'rgba(139,92,246,0.5)',
        borderColor: 'rgba(139,92,246,0.9)',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(139,92,246,0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#6b5f84', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#a89bc2', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

// ---- Load Influencers ----
async function loadInfluencers() {
  try {
    const res = await fetch(`${API}/api/influencers`);
    state.influencers = await res.json();
    applyFilters();
    renderRecent();
    $('table-count').textContent = state.filtered.length;
  } catch (err) {
    console.error('Load influencers error:', err);
    $('influencer-tbody').innerHTML = `<tr><td colspan="10" class="loading-row">⚠ 데이터 로드 실패: ${err.message}</td></tr>`;
  }
}

function renderRecent() {
  const el = $('recent-list');
  const recent = [...state.influencers]
    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
    .slice(0, 6);

  if (!recent.length) {
    el.innerHTML = '<div class="empty-state">수집된 인플루언서가 없습니다.</div>';
    return;
  }

  el.innerHTML = recent.map(inf => `
    <div class="recent-item" onclick="openModal(${inf.id})">
      <span class="recent-platform-badge platform-badge badge-${inf.platform}">
        ${PLATFORM_LABELS[inf.platform] || inf.platform}
      </span>
      <span class="recent-name">${escHtml(inf.account_name)}</span>
      <span class="recent-followers">${fmtNum(inf.follower_count)}</span>
      <span class="recent-category">${inf.category || '—'}</span>
    </div>
  `).join('');
}

// ---- Filters ----
function applyFilters() {
  const platform = $('filter-platform').value;
  const category = $('filter-category').value;
  const minF = parseInt($('filter-min-followers').value) || 0;
  const maxF = parseInt($('filter-max-followers').value) || Infinity;
  const search = $('filter-search').value.toLowerCase().trim();

  state.filtered = state.influencers.filter(inf => {
    if (platform && inf.platform !== platform) return false;
    if (category && inf.category !== category) return false;
    if (inf.follower_count < minF) return false;
    if (inf.follower_count > maxF) return false;
    if (state.bookmarkFilter && !inf.is_bookmarked) return false;
    if (search && !inf.account_name?.toLowerCase().includes(search) && !inf.category?.toLowerCase().includes(search)) return false;
    return true;
  });

  // Sort
  state.filtered.sort((a, b) => {
    const av = a[state.currentSort.field] || 0;
    const bv = b[state.currentSort.field] || 0;
    return state.currentSort.dir === 'desc' ? bv - av : av - bv;
  });

  state.currentPage = 1;
  $('table-count').textContent = state.filtered.length;
  renderTable();
}

$('btn-apply-filter').addEventListener('click', applyFilters);
$('btn-reset-filter').addEventListener('click', () => {
  $('filter-platform').value = '';
  $('filter-category').value = '';
  $('filter-min-followers').value = '';
  $('filter-max-followers').value = '';
  $('filter-search').value = '';
  state.bookmarkFilter = false;
  $('btn-filter-bookmark').classList.remove('active');
  applyFilters();
});

$('filter-search').addEventListener('input', debounce(applyFilters, 300));

$('btn-filter-bookmark').addEventListener('click', () => {
  state.bookmarkFilter = !state.bookmarkFilter;
  $('btn-filter-bookmark').classList.toggle('active', state.bookmarkFilter);
  applyFilters();
});

// Sortable columns
document.querySelectorAll('.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    if (state.currentSort.field === field) {
      state.currentSort.dir = state.currentSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      state.currentSort.field = field;
      state.currentSort.dir = 'desc';
    }
    applyFilters();
  });
});

// ---- Render Table ----
function renderTable() {
  const tbody = $('influencer-tbody');
  const start = (state.currentPage - 1) * state.pageSize;
  const page = state.filtered.slice(start, start + state.pageSize);

  if (!page.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading-row">검색 조건에 맞는 인플루언서가 없습니다.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map(inf => `
    <tr>
      <td class="col-bookmark">
        <button class="btn-star ${inf.is_bookmarked ? 'bookmarked' : ''}"
                onclick="toggleBookmark(event, ${inf.id})"
                title="${inf.is_bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
          ${inf.is_bookmarked ? '⭐' : '☆'}
        </button>
      </td>
      <td class="col-platform">
        <span class="platform-badge badge-${inf.platform}">
          ${PLATFORM_LABELS[inf.platform] || inf.platform}
        </span>
      </td>
      <td class="col-name">
        <span class="account-name">${escHtml(inf.account_name)}</span>
      </td>
      <td>${inf.category || '—'}</td>
      <td class="col-followers">${fmtNum(inf.follower_count)}</td>
      <td class="col-views">${fmtNum(inf.avg_view_count)}</td>
      <td>${inf.country || '—'}</td>
      <td>${inf.email ? `<a href="mailto:${inf.email}">${escHtml(inf.email)}</a>` : '—'}</td>
      <td>${fmtDate(inf.last_updated)}</td>
      <td>
        <button class="btn-detail" onclick="openModal(${inf.id})">상세 보기</button>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(state.filtered.length / state.pageSize);
  const el = $('table-pagination');
  if (total <= 1) { el.innerHTML = ''; return; }

  const pages = [];
  for (let i = 1; i <= Math.min(total, 10); i++) {
    pages.push(`<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`);
  }
  if (total > 10) pages.push(`<span style="color:var(--text-muted);padding:0 8px">... ${total}</span>`);

  el.innerHTML = `
    <button class="page-btn" onclick="goPage(${Math.max(1, state.currentPage - 1)})">‹</button>
    ${pages.join('')}
    <button class="page-btn" onclick="goPage(${Math.min(total, state.currentPage + 1)})">›</button>
  `;
}

function goPage(n) {
  state.currentPage = n;
  renderTable();
}
window.goPage = goPage;

// ---- Bookmark Toggle ----
async function toggleBookmark(e, id) {
  e.stopPropagation();
  const inf = state.influencers.find(x => x.id === id);
  if (!inf) return;

  const newVal = !inf.is_bookmarked;
  try {
    await fetch(`${API}/api/influencers/${id}/bookmark`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_bookmarked: newVal })
    });
    inf.is_bookmarked = newVal;
    applyFilters();
    loadStats();
  } catch (err) {
    console.error('Bookmark error:', err);
  }
}
window.toggleBookmark = toggleBookmark;

// ---- CSV Export ----
$('btn-export').addEventListener('click', () => {
  const rows = [
    ['플랫폼', '계정명', '카테고리', '팔로워', '평균조회수', '국가', '이메일', '링크'],
    ...state.filtered.map(i => [
      i.platform, i.account_name, i.category,
      i.follower_count, i.avg_view_count, i.country, i.email, i.account_url
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `influencers_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

// ---- Bookmarks View ----
function renderBookmarks() {
  const grid = $('bookmark-grid');
  const bookmarked = state.influencers.filter(i => i.is_bookmarked);

  if (!bookmarked.length) {
    grid.innerHTML = '<div class="empty-state">⭐ 즐겨찾기한 인플루언서가 없습니다.<br><small>목록에서 ☆을 클릭해 추가하세요.</small></div>';
    return;
  }

  grid.innerHTML = bookmarked.map(inf => `
    <div class="bookmark-card" onclick="openModal(${inf.id})">
      <div class="bookmark-card-header">
        <span class="bookmark-name">${escHtml(inf.account_name)}</span>
        <span class="platform-badge badge-${inf.platform}">${PLATFORM_LABELS[inf.platform] || inf.platform}</span>
      </div>
      <div class="bookmark-card-meta">
        <span>👥 ${fmtNum(inf.follower_count)}</span>
        <span>📂 ${inf.category || '—'}</span>
        <span>🌏 ${inf.country || '—'}</span>
        ${inf.email ? `<span>✉ ${escHtml(inf.email)}</span>` : ''}
      </div>
      ${inf.memo ? `<div class="bookmark-memo">${escHtml(inf.memo)}</div>` : ''}
    </div>
  `).join('');
}

// ---- Modal ----
function openModal(id) {
  const inf = state.influencers.find(x => x.id === id);
  if (!inf) return;
  state.selectedInfluencer = inf;

  $('modal-title').textContent = inf.account_name;
  $('modal-handle').textContent = `@${inf.account_name}`;
  $('modal-badge-platform').textContent = PLATFORM_LABELS[inf.platform] || inf.platform;
  $('modal-followers').textContent = fmtNum(inf.follower_count);
  $('modal-views').textContent = fmtNum(inf.avg_view_count);
  $('modal-country').textContent = inf.country || '—';
  $('modal-category').textContent = inf.category || '—';
  $('modal-email').textContent = inf.email || '—';
  $('modal-memo').value = inf.memo || '';
  $('memo-save-status').textContent = '';

  const urlEl = $('modal-url');
  if (inf.account_url) {
    urlEl.href = inf.account_url;
    urlEl.textContent = '프로필 보기 →';
  } else {
    urlEl.href = '#';
    urlEl.textContent = '—';
  }

  // Audience charts
  renderModalCharts(inf.audience_demo);

  $('detail-modal').classList.add('open');
}
window.openModal = openModal;

function renderModalCharts(demo) {
  // Destroy existing
  if (state.genderChart) { state.genderChart.destroy(); state.genderChart = null; }
  if (state.ageChart) { state.ageChart.destroy(); state.ageChart = null; }

  const genderCtx = $('modal-chart-gender');
  const ageCtx = $('modal-chart-age');

  // Gender data from audience_demo or defaults
  const genderData = demo?.gender || { female: 60, male: 40 };
  state.genderChart = new Chart(genderCtx, {
    type: 'doughnut',
    data: {
      labels: ['여성', '남성'],
      datasets: [{
        data: [genderData.female || 60, genderData.male || 40],
        backgroundColor: ['rgba(244,114,182,0.7)', 'rgba(96,165,250,0.7)'],
        borderColor: ['#f472b6', '#60a5fa'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#a89bc2', font: { size: 11 }, boxWidth: 12 } }
      }
    }
  });

  // Age data
  const ageData = demo?.age || { '18-24': 35, '25-34': 40, '35-44': 18, '45+': 7 };
  state.ageChart = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(ageData),
      datasets: [{
        data: Object.values(ageData),
        backgroundColor: 'rgba(139,92,246,0.6)',
        borderColor: 'rgba(167,139,250,0.9)',
        borderWidth: 2,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b5f84', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#6b5f84', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

$('btn-close-modal').addEventListener('click', closeModal);
$('detail-modal').addEventListener('click', (e) => {
  if (e.target === $('detail-modal')) closeModal();
});

function closeModal() {
  $('detail-modal').classList.remove('open');
  state.selectedInfluencer = null;
}

// Save Memo
$('btn-save-memo').addEventListener('click', async () => {
  const inf = state.selectedInfluencer;
  if (!inf) return;
  const memo = $('modal-memo').value;

  try {
    await fetch(`${API}/api/influencers/${inf.id}/memo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo })
    });
    inf.memo = memo;
    $('memo-save-status').textContent = '✓ 저장됨';
    setTimeout(() => { $('memo-save-status').textContent = ''; }, 2500);
  } catch (err) {
    $('memo-save-status').textContent = '⚠ 저장 실패';
    $('memo-save-status').style.color = 'var(--accent-red)';
  }
});

// ---- Collect Form ----
$('collect-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const checkedPlatforms = [...document.querySelectorAll('input[name="platforms"]:checked')].map(i => i.value);
  if (!checkedPlatforms.length) {
    addLog('⚠ 최소 하나 이상의 플랫폼을 선택해 주세요.', 'warn');
    return;
  }

  const params = {
    platforms: checkedPlatforms,
    category: $('collect-category').value || '패션',
    followers_min: parseInt($('collect-min').value) || 5000,
    followers_max: parseInt($('collect-max').value) || 10000000,
    country: $('collect-country').value || 'ALL'
  };

  const btn = $('btn-collect');
  const loader = $('collect-loader');
  btn.disabled = true;
  loader.style.display = 'block';
  $('btn-collect-text')?.setAttribute;
  $('result-summary').style.display = 'none';

  clearLog();
  addLog(`🚀 수집 시작 — 플랫폼: ${checkedPlatforms.join(', ')}`, 'info');
  addLog(`📋 카테고리: ${params.category} | 팔로워: ${params.followers_min.toLocaleString()}~${params.followers_max.toLocaleString()}`, 'info');
  addLog(`🌏 국가: ${params.country}`, 'info');
  addLog('⏳ 데이터 수집 중... (최대 3분 소요)', 'system');

  try {
    const res = await fetch(`${API}/api/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    // SSE streaming
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.slice(5).trim());

          if (data.status === 'started') {
            addLog('✅ 서버 연결 성공, 수집 시작됨', 'success');
          } else if (data.status === 'done') {
            addLog(`✅ 수집 완료!`, 'success');
            addLog(`📊 총 수집: ${data.total}건 | 신규: ${data.new_count}건 | 업데이트: ${data.update_count}건`, 'success');

            $('res-total').textContent = data.total || 0;
            $('res-new').textContent = data.new_count || 0;
            $('res-update').textContent = data.update_count || 0;
            $('result-summary').style.display = 'grid';

            // Refresh data
            loadStats();
            loadInfluencers();
          } else if (data.status === 'error') {
            addLog(`❌ 오류 발생: ${data.message || '알 수 없는 오류'}`, 'error');
          }
        } catch (pe) {
          // skip parse errors
        }
      }
    }
  } catch (err) {
    addLog(`❌ 연결 오류: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    loader.style.display = 'none';
  }
});

function addLog(msg, type = 'info') {
  const terminal = $('collect-log');
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const now = new Date().toTimeString().slice(0, 8);
  line.textContent = `[${now}] ${msg}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearLog() {
  $('collect-log').innerHTML = '';
}

// ---- HTML Escape ----
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadInfluencers();
});