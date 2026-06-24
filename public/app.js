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
    bookmarks: ['즐겨찾기', '협업 후보로 저장한 인플루언서 목록'],
    campaign: ['캠페인 제안', '인플루언서에게 제안 메시지(DM/Email) 발송']
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
      labels: platforms.map(p => `${PLATFORM_LABELS[p.name] || p.name} (${p.count}명)`),
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
            label: (ctx) => ` ${ctx.label}`
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
  const country = $('filter-country')?.value;
  const minF = parseInt($('filter-min-followers').value) || 0;
  const maxF = parseInt($('filter-max-followers').value) || Infinity;
  const search = $('filter-search').value.toLowerCase().trim();

  state.filtered = state.influencers.filter(inf => {
    if (platform && inf.platform !== platform) return false;
    if (category && inf.category !== category) return false;
    if (country && inf.country !== country) return false;
    if (inf.follower_count < minF) return false;
    if (inf.follower_count > maxF) return false;
    if (state.bookmarkFilter && !inf.is_bookmarked) return false;
    if (search && !inf.account_name?.toLowerCase().includes(search) && !inf.category?.toLowerCase().includes(search)) return false;
    return true;
  });

  // Sort
  state.filtered.sort((a, b) => {
    // Verified items first
    const aVerified = a.verified_at ? 1 : 0;
    const bVerified = b.verified_at ? 1 : 0;
    if (aVerified !== bVerified) {
      return bVerified - aVerified;
    }
    
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
  const filterCountry = $('filter-country');
  if (filterCountry) filterCountry.value = '';
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
        ${inf.is_bookmarked ? `<span title="즐겨찾기 지정됨" style="color: #fbbf24; margin-left: 4px; font-size: 12px; filter: drop-shadow(0 0 2px rgba(251,191,36,0.5));">⭐</span>` : ''}
        ${inf.verification_status === 'failed' ? `<span class="failed-badge" title="최종 시도: ${fmtDate(inf.verified_at)}">❌ 검증 불가</span>` : (inf.verified_at && inf.verification_status !== 'failed' ? `<span class="verified-badge" title="최종 검증: ${fmtDate(inf.verified_at)}">✅ 검증완료</span>` : '')}
      </td>
      <td>${inf.category || '—'}</td>
      <td class="col-followers">${fmtNum(inf.follower_count)}</td>
      <td class="col-views">${fmtNum(inf.avg_view_count)}</td>
      <td>${inf.country || '—'}</td>
      <td>${inf.email ? `<a href="mailto:${inf.email}">${escHtml(inf.email)}</a>` : '—'}</td>
      <td>${fmtDate(inf.last_updated)}</td>
      <td style="display: flex; gap: 8px;">
        <button class="btn-detail" onclick="openModal(${inf.id})">상세</button>
        <button class="btn-detail" style="background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="deleteInfluencer(${inf.id})">삭제</button>
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
  $('modal-country').value = inf.country || '';
  $('modal-category').value = inf.category || '기타';
  $('modal-email').textContent = inf.email || '—';
  $('modal-memo').value = inf.memo || '';
  $('memo-save-status').textContent = '';

  // Handle metadata updates
  const updateMetadata = async () => {
    const newCountry = $('modal-country').value;
    const newCategory = $('modal-category').value;
    try {
      const res = await fetch(`${API}/api/influencers/${inf.id}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: newCountry, category: newCategory })
      });
      if (!res.ok) throw new Error('수정 실패');
      inf.country = newCountry;
      inf.category = newCategory;
      applyFilters(); // re-filter and re-render main table if it was updated
    } catch (err) {
      console.error(err);
      alert('데이터 수정 중 오류가 발생했습니다.');
    }
  };

  $('modal-country').onchange = updateMetadata;
  $('modal-category').onchange = updateMetadata;

  const urlEl = $('modal-url');
  if (inf.account_url) {
    urlEl.href = inf.account_url;
    urlEl.style.display = 'inline';
  } else {
    urlEl.style.display = 'none';
  }

  // Delete button logic
  const deleteBtn = $('btn-modal-delete');
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      deleteInfluencer(inf.id);
      closeModal();
    };
  }
  
  // Bookmark button logic
  const bkmkBtn = $('btn-modal-bookmark');
  if (bkmkBtn) {
    bkmkBtn.textContent = inf.is_bookmarked ? '⭐' : '☆';
    bkmkBtn.className = `btn-star ${inf.is_bookmarked ? 'bookmarked' : ''}`;
    bkmkBtn.title = inf.is_bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가';
    bkmkBtn.onclick = async (e) => {
      await toggleBookmark(e, inf.id);
      // toggleBookmark updates state, so sync modal button state
      const updatedInf = state.influencers.find(x => x.id === inf.id);
      if (updatedInf) {
        bkmkBtn.textContent = updatedInf.is_bookmarked ? '⭐' : '☆';
        bkmkBtn.className = `btn-star ${updatedInf.is_bookmarked ? 'bookmarked' : ''}`;
        bkmkBtn.title = updatedInf.is_bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가';
      }
    };
  }

  // Audience charts
  renderModalCharts(inf.audience_demo);

  $('detail-modal').classList.add('open');
}
window.openModal = openModal;

function closeModal() {
  $('detail-modal').classList.remove('open');
}
window.closeModal = closeModal;

// ---- Verification ----
async function verifyVisibleInfluencers() {
  const btn = $('btn-verify-batch');
  const loader = $('verify-progress');
  const loaderText = $('verify-progress-text');
  
  if (!state.filtered || state.filtered.length === 0) {
    alert('검증할 인플루언서가 목록에 없습니다.');
    return;
  }
  
  // 현재 페이지의 데이터만 가져옴
  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = state.filtered.slice(start, start + state.pageSize);
  const ids = pageItems.map(inf => inf.id);
  
  if (!confirm(`현재 표출된 화면의 ${ids.length}명 데이터를 재검증하시겠습니까?\n(일부 플랫폼은 유료 API 크레딧이 소모될 수 있습니다.)`)) {
    return;
  }
  
  if (btn) btn.disabled = true;
  if (loader) loader.style.display = 'flex';
  if (loaderText) loaderText.textContent = `총 ${ids.length}명 재검증 중...`;
  
  try {
    const response = await fetch(`${API}/api/verify/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.status === 'log' && loaderText) {
            // Update the small progress text
            loaderText.textContent = data.message;
          } else if (data.status === 'done' || data.status === 'error') {
            if (data.status === 'error') {
              if (loaderText) loaderText.textContent = `❌ 검증 중 오류 발생`;
              alert(`시스템 오류가 발생했습니다: ${data.message}`);
            } else {
              if (loaderText) loaderText.textContent = `✅ 검증 완료: 업데이트 ${data.updated}명, 유지/에러 ${data.failed}명`;
              alert(`검증 완료!\n- 총 검증 대상: ${data.total_checked}명\n- 수치 업데이트: ${data.updated}명\n- 수치 유지/오류: ${data.failed}명`);
            }
            loadInfluencers(); // refresh data and UI
            setTimeout(() => {
              if (loader) loader.style.display = 'none';
              if (btn) btn.disabled = false;
            }, 3000);
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('Verify error:', err);
    alert(`시스템 오류: ${err.message}`);
    if (loader) loader.style.display = 'none';
    if (btn) btn.disabled = false;
  }
}
window.verifyVisibleInfluencers = verifyVisibleInfluencers;

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

// ---- Delete Influencer ----
async function deleteInfluencer(id) {
  if (!confirm('정말로 이 인플루언서 데이터를 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`${API}/api/influencers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      state.influencers = state.influencers.filter(i => i.id !== id);
      applyFilters();
      alert('삭제되었습니다.');
    } else {
      alert('삭제에 실패했습니다.');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('삭제 오류가 발생했습니다.');
  }
}

// ---- Custom Keywords Logic ----
let customKeywords = [];
const keywordInput = $('collect-keyword-input');
const keywordsContainer = $('collect-keywords-container');

function renderKeywords() {
  if (!keywordsContainer) return;
  keywordsContainer.innerHTML = '';
  customKeywords.forEach((kw, index) => {
    const tag = document.createElement('div');
    tag.className = 'keyword-tag';
    tag.innerHTML = `
      <span>${kw}</span>
      <span class="keyword-remove" data-index="${index}">×</span>
    `;
    keywordsContainer.appendChild(tag);
  });
}

if (keywordInput) {
  keywordInput.addEventListener('keydown', (e) => {
    // 한글 등 조합 중일 때 발생하는 중복 이벤트 방지
    if (e.isComposing || e.keyCode === 229) return;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = keywordInput.value.trim();
      if (val && !customKeywords.includes(val)) {
        customKeywords.push(val);
        renderKeywords();
      }
      keywordInput.value = '';
    }
  });
}

if (keywordsContainer) {
  keywordsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('keyword-remove')) {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      customKeywords.splice(idx, 1);
      renderKeywords();
    }
  });
}

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
    country: $('collect-country').value || 'ALL',
    keywords: customKeywords
  };

  const btn = $('btn-collect');
  const stopBtn = $('btn-stop-collect');
  const loader = $('collect-loader');
  btn.disabled = true;
  if (stopBtn) {
    stopBtn.disabled = false;
    stopBtn.style.color = '#fff';
    stopBtn.style.borderColor = '#ef4444';
    stopBtn.style.background = 'rgba(239,68,68,0.2)';
  }
  loader.style.display = 'block';
  $('result-summary').style.display = 'none';

  clearLog();
  addLog(`🚀 수집 시작 — 플랫폼: ${checkedPlatforms.join(', ')}`, 'info');
  addLog(`📋 카테고리: ${params.category} | 팔로워: ${params.followers_min.toLocaleString()}~${params.followers_max.toLocaleString()}`, 'info');
  addLog(`🌏 국가: ${params.country}`, 'info');
  addLog('⏳ 데이터 수집 중... (최대 10분 소요)', 'system');

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
    addLog(`❌ 시스템 오류: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    loader.style.display = 'none';
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.style.color = '#a89bc2';
      stopBtn.style.borderColor = '#4a3f64';
      stopBtn.style.background = '#2a2438';
    }
  }
});

async function stopCollection() {
  const stopBtn = $('btn-stop-collect');
  if (stopBtn) stopBtn.disabled = true;
  try {
    const res = await fetch(`${API}/api/collect/stop`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      addLog(`⏹ 수집이 사용자에 의해 중단되었습니다.`, 'error');
    }
  } catch (err) {
    console.error('Failed to stop collection:', err);
  }
}

async function verifyInstagram() {
  const btn = $('btn-verify-instagram');
  if (btn) btn.disabled = true;
  
  clearLog();
  addLog('인스타그램 팔로워 수 정밀 검증을 시작합니다...', 'info');
  $('result-summary').style.display = 'none';
  
  try {
    const response = await fetch(`${API}/api/verify/instagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.status === 'started') {
            addLog(`Apify API와 연결 중입니다...`, 'system');
          } else if (data.status === 'log') {
            let msg = data.message;
            let type = 'info';
            if (msg.includes('Processing batch')) type = 'system';
            if (msg.includes('[ERR]')) type = 'error';
            addLog(msg, type);
          } else if (data.status === 'done' || data.status === 'error') {
            addLog(`✅ 검증 프로세스 완료`, data.status === 'done' ? 'system' : 'error');
            
            // UI에 요약 정보 표시
            if (data.total_checked !== undefined) {
              $('res-total').textContent = data.total_checked;
              $('res-new').textContent = '-'; // 신규 아님
              $('res-update').textContent = data.updated;
              
              $('res-total-label') ? $('res-total-label').textContent = '검증 대상' : '';
              $('res-update-label') ? $('res-update-label').textContent = '업데이트됨' : '';
              
              $('result-summary').style.display = 'flex';
              addLog(`결과 요약: 총 대상 ${data.total_checked}명 / 업데이트 ${data.updated}명 / 오류 ${data.failed}명`, 'success');
            }
            
            // 검증이 끝나면 목록 갱신
            loadStats();
            loadInfluencers();
          }
        } catch (e) {
          // ignore JSON parse errors for incomplete chunks
        }
      }
    }
  } catch (err) {
    addLog(`❌ 시스템 오류: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

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

// ---- Campaign Proposal Logic ----
let campaignSelectedIds = new Set();
let campaignTargetList = [];

// Load target influencers
$('btn-campaign-load')?.addEventListener('click', async () => {
  const platform = $('campaign-platform-filter').value;
  const category = $('campaign-category-filter').value;
  const country = $('campaign-country-filter')?.value;
  const keyword = $('campaign-keyword-filter').value;
  
  const countEl = $('campaign-target-count');
  if (countEl) countEl.textContent = '0';
  
  const tbody = $('campaign-target-tbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#a89bc2;">⏳ 실제 DB에서 데이터를 불러오는 중...</td></tr>`;
  
  try {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (category) params.append('category', category);
    if (country && country !== 'ALL') params.append('country', country);
    if (keyword) params.append('search', keyword);
    
    // DB에서 직접 필터링된 데이터 호출
    const res = await fetch(`${API}/api/influencers?${params.toString()}`);
    if (!res.ok) throw new Error('API 응답 오류');
    
    const dbData = await res.json();
    
    // 플랫폼 필터가 파라미터로 동작하지 않을 경우를 대비해 한 번 더 클라이언트 필터링
    campaignTargetList = dbData.filter(i => {
      let pass = true;
      if (platform) pass = pass && (i.platform === platform);
      if (country) pass = pass && (i.country === country);
      return pass;
    });
    campaignSelectedIds.clear();
    
    if (countEl) countEl.textContent = campaignTargetList.length;
    
    if (campaignTargetList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#a89bc2;">선택한 조건에 맞는 인플루언서가 DB에 없습니다.</td></tr>`;
      if ($('campaign-pagination')) $('campaign-pagination').innerHTML = '';
      return;
    }
    
    campaignCurrentPage = 1;
    renderCampaignPage(1);
    
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">❌ DB 조회 실패: ${err.message}</td></tr>`;
  }
});

let campaignCurrentPage = 1;
const CAMPAIGN_PAGE_SIZE = 50;

function renderCampaignPage(page) {
  const tbody = $('campaign-target-tbody');
  const pag = $('campaign-pagination');
  if (!tbody) return;
  
  const total = campaignTargetList.length;
  const maxPage = Math.ceil(total / CAMPAIGN_PAGE_SIZE) || 1;
  campaignCurrentPage = Math.max(1, Math.min(page, maxPage));
  
  const start = (campaignCurrentPage - 1) * CAMPAIGN_PAGE_SIZE;
  const end = start + CAMPAIGN_PAGE_SIZE;
  const pageData = campaignTargetList.slice(start, end);
  
  tbody.innerHTML = pageData.map(inf => `
    <tr>
      <td><input type="checkbox" class="campaign-checkbox" data-id="${inf.id}" ${campaignSelectedIds.has(String(inf.id)) ? 'checked' : ''}></td>
      <td><span class="platform-badge ${inf.platform}">${PLATFORM_LABELS[inf.platform] || inf.platform}</span></td>
      <td><strong class="clickable-account" onclick="openModal(${inf.id})" style="cursor: pointer; text-decoration: underline; color: #a78bfa;" title="상세 정보 보기">${escHtml(inf.account_name)}</strong></td>
      <td>${escHtml(inf.category || '')}</td>
    </tr>
  `).join('');
  
  // 상태 동기화
  const checkAll = $('campaign-check-all');
  if (checkAll) {
    const boxes = document.querySelectorAll('.campaign-checkbox');
    checkAll.checked = boxes.length > 0 && Array.from(boxes).every(b => b.checked);
  }
  
  // Render pagination controls
  if (pag) {
    if (maxPage <= 1) {
      pag.innerHTML = '';
      return;
    }
    
    let html = `<button class="btn-page" onclick="renderCampaignPage(${campaignCurrentPage - 1})" ${campaignCurrentPage === 1 ? 'disabled' : ''}>◀</button>`;
    
    // Simple windowing for 10 pages
    let startP = Math.max(1, campaignCurrentPage - 4);
    let endP = Math.min(maxPage, startP + 9);
    if (endP - startP < 9) startP = Math.max(1, endP - 9);
    
    for (let i = startP; i <= endP; i++) {
      html += `<button class="btn-page ${i === campaignCurrentPage ? 'active' : ''}" onclick="renderCampaignPage(${i})">${i}</button>`;
    }
    
    html += `<button class="btn-page" onclick="renderCampaignPage(${campaignCurrentPage + 1})" ${campaignCurrentPage === maxPage ? 'disabled' : ''}>▶</button>`;
    pag.innerHTML = html;
  }
}

// Select All toggle
$('campaign-check-all')?.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.campaign-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = parseInt(cb.getAttribute('data-id'), 10);
    if (isChecked) campaignSelectedIds.add(id);
    else campaignSelectedIds.delete(id);
  });
});

// Individual checkbox toggle
$('campaign-target-tbody')?.addEventListener('change', (e) => {
  if (e.target.classList.contains('campaign-checkbox')) {
    const id = parseInt(e.target.getAttribute('data-id'), 10);
    if (e.target.checked) campaignSelectedIds.add(id);
    else campaignSelectedIds.delete(id);
  }
});

// Submit Campaign
$('campaign-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (campaignSelectedIds.size === 0) {
    alert('대상 인플루언서를 최소 1명 이상 선택해주세요.');
    return;
  }
  
  const sendMethod = document.querySelector('input[name="send_method"]:checked').value;
  const message = $('campaign-message').value;
  const productUrl = $('campaign-product-url').value;
  const contentUrl = $('campaign-content-url').value;
  const platform = $('campaign-platform-filter').value;
  
  const payload = {
    method: sendMethod,
    platform,
    influencer_ids: Array.from(campaignSelectedIds),
    message,
    product_url: productUrl,
    content_url: contentUrl
  };
  
  const btn = $('btn-campaign-send');
  const resultDiv = $('campaign-result');
  btn.disabled = true;
  btn.textContent = '발송 중...';
  resultDiv.innerHTML = '<span style="color:#a89bc2;">발송 진행 중입니다... (시뮬레이션 모드)</span>';
  
  try {
    const res = await fetch(`${API}/api/campaign/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      resultDiv.innerHTML = `<span style="color:#10b981;">✅ 발송 성공! (총 ${data.sent_count}건 시뮬레이션 완료)</span>`;
    } else {
      resultDiv.innerHTML = `<span style="color:#ef4444;">❌ 오류: ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span style="color:#ef4444;">❌ 요청 실패: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'DM 발송';
  }
});

// ---- Translation Logic ----
$('btn-campaign-translate')?.addEventListener('click', async () => {
  const text = $('campaign-message').value.trim();
  const targetLang = $('campaign-translate-lang').value;
  
  if (!text) {
    alert('번역할 제안 문구를 입력해주세요.');
    return;
  }
  
  const btn = $('btn-campaign-translate');
  const progress = $('translate-progress');
  
  btn.disabled = true;
  if (progress) progress.style.display = 'flex';
  
  try {
    const res = await fetch(`${API}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    });
    
    const data = await res.json();
    if (res.ok && data.translatedText) {
      $('campaign-message').value = data.translatedText;
    } else {
      alert(`번역 오류: ${data.error || '알 수 없는 오류가 발생했습니다.'}`);
    }
  } catch (err) {
    console.error('Translation failed:', err);
    alert(`번역 요청 실패: ${err.message}`);
  } finally {
    btn.disabled = false;
    if (progress) progress.style.display = 'none';
  }
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadInfluencers();
});