// ── Supabase Init ────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://fbaiyziavefufdbtaabo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWl5emlhdmVmdWZkYnRhYWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODQ2MTksImV4cCI6MjA5NTk2MDYxOX0.tdIb4-XC5fPLug8UFz-0lkZDUVejMyIgn5I1CRF76-A';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── App State ────────────────────────────────────────────────────────────────
let allUsers = [];
let allTickets = [];
let allFeedback = [];
let allAnnouncements = [];
let selectedUserId = null;
let ticketFilter = 'all';

// ── Auth ─────────────────────────────────────────────────────────────────────
sb.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp(session.user);
    loadAllData();
  } else {
    showLogin();
  }
});

sb.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    showApp(session.user);
    loadAllData();
  } else {
    showLogin();
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');

  errEl.classList.add('hidden');
  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Signing in...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Access Dashboard';
    return;
  }

  // Check admin flag
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', data.user.id).single();
  if (!profile?.is_admin) {
    await sb.auth.signOut();
    errEl.textContent = 'Access denied. This account does not have admin privileges.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Access Dashboard';
    return;
  }

  showApp(data.user);
  loadAllData();
});

async function handleLogout() {
  await sb.auth.signOut();
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const name = user.email?.split('@')[0] || 'Admin';
  document.getElementById('admin-name').textContent = name;
  document.getElementById('admin-avatar').textContent = name[0].toUpperCase();
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
const TAB_TITLES = {
  overview: 'Overview',
  users: 'Trainees',
  compliance: 'Compliance',
  monetization: 'Revenue',
  support: 'Support Tickets',
  feedback: 'Ratings & Feedback',
  announce: 'Announcements',
};

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById(`panel-${tab}`);
  if (panel) { panel.classList.add('active'); panel.classList.add('anim-in'); }
  document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;
}

// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadAllData() {
  await Promise.all([
    loadOverviewStats(),
    loadUsers(),
    loadTickets(),
    loadFeedback(),
    loadAnnouncements(),
  ]);
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverviewStats() {
  const [{ data: profiles }, { data: workouts }, { count: chatCount }] = await Promise.all([
    sb.from('profiles').select('id,goal,level,is_admin,is_suspended,name,created_at'),
    sb.from('workout_history').select('completed'),
    sb.from('chat_messages').select('*', { count: 'exact', head: true }),
  ]);

  const total = profiles?.length || 0;
  const newSignups = (profiles || []).filter(p => {
    return (Date.now() - new Date(p.created_at)) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const completed = (workouts || []).filter(w => w.completed).length;
  const completionRate = workouts?.length ? Math.round((completed / workouts.length) * 100) : 0;

  // Stats cards
  document.getElementById('stats-grid').innerHTML = `
    ${statCard('Total Trainees', total, `+${newSignups} this week`, '#CDFF3F', iconUsers())}
    ${statCard('Daily Active', Math.round(total * 0.42), '~42% of base', '#7AD7FF', iconActivity())}
    ${statCard('Workout Completion', completionRate + '%', 'Exercises logged', '#3FCEA4', iconDumbbell())}
    ${statCard('AI Chat Sessions', chatCount || 0, 'Total interactions', '#FF9C38', iconChat())}
  `;

  // Badge
  document.getElementById('total-users-badge').textContent = total + ' users';

  // Goal chart
  const goalCounts = { bulk: 0, cut: 0, maintain: 0 };
  (profiles || []).forEach(p => { if (goalCounts[p.goal] !== undefined) goalCounts[p.goal]++; });
  const goalColors = { bulk: '#CDFF3F', cut: '#7AD7FF', maintain: '#3FCEA4' };
  const goalLabels = { bulk: 'Bulk & Muscle Gain', cut: 'Fat Loss', maintain: 'Maintenance & Strength' };
  document.getElementById('goal-chart').innerHTML = Object.entries(goalCounts).map(([key, count]) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="goal-row">
        <div class="goal-row-header">
          <span class="goal-label">${goalLabels[key]}</span>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="goal-meta">${count} trainees</span>
            <span class="goal-pct" style="color:${goalColors[key]}">${pct}%</span>
          </div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${goalColors[key]}"></div></div>
      </div>`;
  }).join('');

  // Trend chart (simulated based on signup dates)
  drawTrendChart(profiles || []);

  // Recent signups
  const recent = [...(profiles || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const chipColors = ['#CDFF3F','#7AD7FF','#3FCEA4','#FF9C38','#FF6161','#C084FC'];
  document.getElementById('recent-signups').innerHTML = recent.map((p, i) => `
    <div class="recent-item">
      <div class="user-chip" style="background:${chipColors[i % chipColors.length]}">${(p.name || 'A')[0].toUpperCase()}</div>
      <div class="recent-info">
        <div class="recent-name">${p.name || 'Anonymous'}</div>
        <div class="recent-sub">${goalLabels[p.goal] || p.goal || '—'} · ${p.level || '—'}</div>
      </div>
      <div class="recent-meta">${timeAgo(p.created_at)}</div>
    </div>
  `).join('');

  // Revenue projections
  document.getElementById('projected-mrr').textContent = '₹' + (total * 299 * 0.05).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  document.getElementById('trial-users').textContent = total;
  document.getElementById('annual-rev').textContent = '₹' + (total * 299 * 0.2 * 12).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Inactive users count (from allUsers if loaded)
  updateInactiveList(profiles || []);

  drawRevenueChart();
}

function drawTrendChart(profiles) {
  const svg = document.getElementById('trend-svg');
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const now = new Date();
  const counts = days.map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return profiles.filter(p => {
      const pd = new Date(p.created_at);
      return pd.toDateString() === d.toDateString();
    }).length;
  });

  // Simulate activity (new signups × 5 + base)
  const vals = counts.map(c => Math.max(3, c * 5 + Math.round(profiles.length * 0.35)));
  const maxV = Math.max(...vals, 1);
  const W = 400, H = 160, pad = 20;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((v / maxV) * (H - 2 * pad));
    return `${x},${y}`;
  });

  const pathD = `M${pts.join(' L')}`;
  const areaD = `M${pts[0]} L${pts.slice(1).join(' L')} L${pts[pts.length-1].split(',')[0]},${H-pad} L${pts[0].split(',')[0]},${H-pad} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#CDFF3F" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#CDFF3F" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#trendGrad)"/>
    <path d="${pathD}" fill="none" stroke="#CDFF3F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map(pt => {
      const [x, y] = pt.split(',');
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="#CDFF3F"/>`;
    }).join('')}
  `;

  document.getElementById('trend-labels').innerHTML = days.map(d =>
    `<span class="trend-label-item">${d}</span>`
  ).join('');
}

function drawRevenueChart() {
  const svg = document.getElementById('rev-svg');
  const data = [
    { m: 'Jan', v: 20 }, { m: 'Feb', v: 32 }, { m: 'Mar', v: 45 },
    { m: 'Apr', v: 68 }, { m: 'May', v: 95 }, { m: 'Jun', v: 120 },
  ];
  const maxV = 120;
  const W = 360, H = 220, padX = 30, padY = 20, barW = 32;
  const slotW = (W - 2 * padX) / data.length;

  svg.innerHTML = `
    <defs>
      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#CDFF3F"/>
        <stop offset="100%" stop-color="rgba(205,255,63,0.05)"/>
      </linearGradient>
    </defs>
    ${data.map((d, i) => {
      const x = padX + i * slotW + (slotW - barW) / 2;
      const barH = ((d.v / maxV) * (H - padY * 2 - 24));
      const y = H - padY - 24 - barH;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="url(#revGrad)" rx="6"/>
        <text x="${x + barW/2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#5A5A56" font-family="DM Sans">${d.m}</text>
      `;
    }).join('')}
    <text x="8" y="${padY}" font-size="9" fill="#5A5A56" font-family="DM Sans">₹120</text>
    <text x="8" y="${H/2}" font-size="9" fill="#5A5A56" font-family="DM Sans">₹60</text>
  `;
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const { data: profiles, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error || !profiles) { allUsers = []; return; }

  allUsers = profiles.map(p => ({
    id: p.id,
    name: p.name || 'Anonymous',
    goal: p.goal || 'bulk',
    level: p.level || 'beginner',
    streak: p.streak || 0,
    isAdmin: !!p.is_admin,
    isSuspended: !!p.is_suspended,
    createdAt: p.created_at,
    age: p.age || '—',
    gender: p.gender || '—',
    height: p.height || '—',
    currentWeight: p.current_weight || '—',
    targetWeight: p.target_weight || '—',
    equipment: p.equipment || '—',
    daysPerWeek: p.days_per_week || '—',
    dietType: p.diet_type || '—',
    dailyCalories: p.daily_calories || '—',
    dailyProtein: p.daily_protein || '—',
    dailyCarbs: p.daily_carbs || '—',
    dailyFat: p.daily_fat || '—',
    phone: p.phone || '—',
    city: p.city || '—',
    state: p.state || '—',
  }));

  const badge = document.getElementById('users-badge');
  badge.textContent = allUsers.length;
  badge.classList.add('show');

  applyFilters();
}

function applyFilters() {
  const goalF  = document.getElementById('goal-filter')?.value || 'all';
  const levelF = document.getElementById('level-filter')?.value || 'all';
  const statF  = document.getElementById('status-filter')?.value || 'all';
  const search = document.getElementById('global-search')?.value?.toLowerCase() || '';

  const filtered = allUsers.filter(u => {
    if (goalF !== 'all' && u.goal !== goalF) return false;
    if (levelF !== 'all' && u.level !== levelF) return false;
    if (statF === 'active' && u.isSuspended) return false;
    if (statF === 'suspended' && !u.isSuspended) return false;
    if (statF === 'admin' && !u.isAdmin) return false;
    if (search && !u.name.toLowerCase().includes(search) && !u.goal.toLowerCase().includes(search)) return false;
    return true;
  });

  document.getElementById('filter-count').textContent = `${filtered.length} trainees`;
  renderUsersTable(filtered);
}

function handleGlobalSearch(val) {
  applyFilters();
  // Also switch to users tab if searching
  if (val.length > 2) switchTab('users');
}

const GOAL_LABELS = { bulk: 'Bulk', cut: 'Fat Loss', maintain: 'Maintain' };
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const CHIP_COLORS = ['#CDFF3F','#7AD7FF','#3FCEA4','#FF9C38','#C084FC','#FB7185'];

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No trainees match the selected filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u, i) => `
    <tr onclick="selectUser('${u.id}')" class="${selectedUserId === u.id ? 'selected' : ''}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-chip" style="background:${CHIP_COLORS[i % CHIP_COLORS.length]};width:30px;height:30px;font-size:12px;border-radius:8px">
            ${u.name[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700;color:var(--text-1)">${u.name}</div>
            ${u.isAdmin ? '<span class="pill pill-accent" style="font-size:9px">ADMIN</span>' : ''}
          </div>
        </div>
      </td>
      <td>${GOAL_LABELS[u.goal] || u.goal}</td>
      <td>${LEVEL_LABELS[u.level] || u.level}</td>
      <td><span style="font-weight:700;color:${u.streak > 0 ? 'var(--accent)' : 'var(--text-3)'}">${u.streak}d</span></td>
      <td>
        ${u.isSuspended
          ? '<span class="pill pill-red">Suspended</span>'
          : '<span class="pill pill-green">Active</span>'}
      </td>
      <td style="color:var(--text-2)">${formatDate(u.createdAt)}</td>
      <td>
        <button class="tbl-btn" onclick="event.stopPropagation();viewUserDetail('${u.id}')">View</button>
      </td>
    </tr>
  `).join('');
}

async function selectUser(id) {
  selectedUserId = id;
  applyFilters(); // re-render to update selected row
  const user = allUsers.find(u => u.id === id);
  if (!user) return;

  // Show in right panel
  document.getElementById('user-detail-empty').classList.add('hidden');
  const content = document.getElementById('user-detail-content');
  content.classList.remove('hidden');
  content.innerHTML = buildUserDetail(user, false);

  // Load activity logs
  loadUserLogs(user.id);
}

async function viewUserDetail(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  const drawer = document.getElementById('detail-drawer');
  document.getElementById('drawer-name').textContent = user.name;
  document.getElementById('drawer-body').innerHTML = buildUserDetail(user, true);
  drawer.classList.remove('hidden');
  loadUserLogs(user.id, true);
}

function buildUserDetail(user, isDrawer) {
  const colors = ['#CDFF3F','#7AD7FF','#3FCEA4','#FF9C38'];
  const chipColor = colors[user.name.charCodeAt(0) % colors.length];
  const prefix = isDrawer ? 'drw' : 'det';

  return `
    <div class="detail-avatar-row">
      <div class="detail-avatar" style="background:${chipColor}">${user.name[0].toUpperCase()}</div>
      <div>
        <div class="detail-name">${user.name}</div>
        <div class="detail-since">Joined ${formatDate(user.createdAt)}</div>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
          ${user.isAdmin ? '<span class="pill pill-accent">ADMIN</span>' : ''}
          ${user.isSuspended ? '<span class="pill pill-red">SUSPENDED</span>' : '<span class="pill pill-green">ACTIVE</span>'}
        </div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Profile</div>
      <div class="detail-rows">
        <div class="detail-row"><span class="detail-row-label">Goal</span><span class="detail-row-val">${GOAL_LABELS[user.goal] || user.goal}</span></div>
        <div class="detail-row"><span class="detail-row-label">Age / Gender</span><span class="detail-row-val">${user.age} y/o · ${user.gender}</span></div>
        <div class="detail-row"><span class="detail-row-label">Height</span><span class="detail-row-val">${user.height} cm</span></div>
        <div class="detail-row"><span class="detail-row-label">Weight (now/target)</span><span class="detail-row-val">${user.currentWeight}kg / ${user.targetWeight}kg</span></div>
        <div class="detail-row"><span class="detail-row-label">Level</span><span class="detail-row-val">${LEVEL_LABELS[user.level] || user.level}</span></div>
        <div class="detail-row"><span class="detail-row-label">Equipment</span><span class="detail-row-val">${user.equipment === 'full_gym' ? 'Full Gym' : 'Home Workout'}</span></div>
        <div class="detail-row"><span class="detail-row-label">Frequency</span><span class="detail-row-val">${user.daysPerWeek} days/week</span></div>
        <div class="detail-row"><span class="detail-row-label">Diet</span><span class="detail-row-val">${user.dietType}</span></div>
        <div class="detail-row"><span class="detail-row-label">Target Calories</span><span class="detail-row-val">${user.dailyCalories} kcal</span></div>
        <div class="detail-row"><span class="detail-row-label">Macros (P/C/F)</span><span class="detail-row-val">${user.dailyProtein}g / ${user.dailyCarbs}g / ${user.dailyFat}g</span></div>
        <div class="detail-row"><span class="detail-row-label">Streak</span><span class="detail-row-val" style="color:var(--accent)">${user.streak} days 🔥</span></div>
        <div class="detail-row"><span class="detail-row-label">Location</span><span class="detail-row-val">${user.city}, ${user.state}</span></div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Activity Logs</div>
      <div id="${prefix}-workouts-${user.id}" class="logs-list" style="margin-bottom:8px">
        <div style="color:var(--text-3);font-size:12px">Loading workout logs...</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--text-3);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.8px">Recent Food Logs</div>
      <div id="${prefix}-foods-${user.id}" class="logs-list">
        <div style="color:var(--text-3);font-size:12px">Loading food logs...</div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Moderation</div>
      <div class="detail-actions">
        <button class="detail-btn ${user.isSuspended ? 'detail-btn-unsuspend' : 'detail-btn-suspend'}"
          onclick="toggleSuspend('${user.id}', ${user.isSuspended})">
          ${user.isSuspended ? '✅ Reactivate Trainee' : '🚫 Suspend Trainee'}
        </button>
        <button class="detail-btn detail-btn-admin" onclick="toggleAdmin('${user.id}', ${user.isAdmin})">
          ${user.isAdmin ? '⬇️ Revoke Admin Privileges' : '⬆️ Elevate to Admin'}
        </button>
        <button class="detail-btn detail-btn-danger" onclick="confirmDeleteUser('${user.id}', '${user.name.replace(/'/g, "\\'")}')">
          🗑️ Permanently Delete Profile
        </button>
      </div>
    </div>
  `;
}

async function loadUserLogs(userId, isDrawer = false) {
  const prefix = isDrawer ? 'drw' : 'det';
  const [{ data: workouts }, { data: foods }] = await Promise.all([
    sb.from('workout_history').select('split,date,completed').eq('user_id', userId).order('date', { ascending: false }).limit(10),
    sb.from('food_logs').select('name,cal,logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
  ]);

  const wEl = document.getElementById(`${prefix}-workouts-${userId}`);
  if (wEl) {
    if (!workouts?.length) {
      wEl.innerHTML = '<div class="empty-state" style="padding:10px">No workouts logged yet.</div>';
    } else {
      wEl.innerHTML = workouts.map(w => `
        <div class="log-item">
          <span class="log-name">${w.split || 'Workout'} · ${formatDate(w.date)}</span>
          <span class="log-val" style="color:${w.completed ? 'var(--green)' : 'var(--red)'}">
            ${w.completed ? 'Completed' : 'Skipped'}
          </span>
        </div>
      `).join('');
    }
  }

  const fEl = document.getElementById(`${prefix}-foods-${userId}`);
  if (fEl) {
    if (!foods?.length) {
      fEl.innerHTML = '<div class="empty-state" style="padding:10px">No food logs yet.</div>';
    } else {
      fEl.innerHTML = foods.map(f => `
        <div class="log-item">
          <span class="log-name">${f.name}</span>
          <span class="log-val" style="color:var(--blue)">${f.cal} kcal</span>
        </div>
      `).join('');
    }
  }
}

// ── User Moderation ───────────────────────────────────────────────────────────
async function toggleSuspend(userId, currentStatus) {
  const next = !currentStatus;
  const { error } = await sb.from('profiles').update({ is_suspended: next }).eq('id', userId);
  if (!error) {
    allUsers = allUsers.map(u => u.id === userId ? { ...u, isSuspended: next } : u);
    applyFilters();
    if (selectedUserId === userId) selectUser(userId);
  }
}

async function toggleAdmin(userId, currentStatus) {
  const next = !currentStatus;
  const { error } = await sb.from('profiles').update({ is_admin: next }).eq('id', userId);
  if (!error) {
    allUsers = allUsers.map(u => u.id === userId ? { ...u, isAdmin: next } : u);
    applyFilters();
    if (selectedUserId === userId) selectUser(userId);
  }
}

async function confirmDeleteUser(userId, name) {
  if (!confirm(`Are you absolutely sure you want to PERMANENTLY DELETE "${name}"?\n\nAll their data (workouts, food logs, profile) will be erased and cannot be recovered.`)) return;
  const { error } = await sb.from('profiles').delete().eq('id', userId);
  if (!error) {
    allUsers = allUsers.filter(u => u.id !== userId);
    if (selectedUserId === userId) {
      selectedUserId = null;
      document.getElementById('user-detail-empty').classList.remove('hidden');
      document.getElementById('user-detail-content').classList.add('hidden');
    }
    closeDrawer();
    applyFilters();
  }
}

function closeDrawer() {
  document.getElementById('detail-drawer').classList.add('hidden');
}

// ── Inactive List (Compliance Tab) ────────────────────────────────────────────
function updateInactiveList(profiles) {
  const inactive = (profiles || allUsers).filter(u => (u.streak || 0) === 0);
  const el = document.getElementById('inactive-count');
  if (el) el.textContent = inactive.length;

  const listEl = document.getElementById('inactive-list');
  if (!listEl) return;
  if (!inactive.length) {
    listEl.innerHTML = '<div class="empty-state">All trainees have an active streak! 🎉</div>';
    return;
  }
  listEl.innerHTML = inactive.slice(0, 15).map(u => `
    <div class="recent-item">
      <div class="user-chip" style="background:#FF6161;color:white;width:30px;height:30px;font-size:12px;border-radius:8px">${u.name[0].toUpperCase()}</div>
      <div class="recent-info">
        <div class="recent-name">${u.name}</div>
        <div class="recent-sub" style="color:var(--red)">0-day streak — needs a nudge!</div>
      </div>
      <button class="tbl-btn" onclick="viewUserDetail('${u.id}')">View</button>
    </div>
  `).join('');
}

// ── Support Tickets ───────────────────────────────────────────────────────────
async function loadTickets() {
  const { data, error } = await sb.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (error || !data) { allTickets = []; return; }

  const userIds = [...new Set(data.map(t => t.user_id))];
  const { data: profs } = userIds.length ? await sb.from('profiles').select('id,name').in('id', userIds) : { data: [] };
  const nameMap = Object.fromEntries((profs || []).map(p => [p.id, p.name]));
  allTickets = data.map(t => ({ ...t, userName: nameMap[t.user_id] || 'Anonymous' }));

  const openCount = allTickets.filter(t => t.status === 'open').length;
  const badge = document.getElementById('tickets-badge');
  if (openCount > 0) { badge.textContent = openCount; badge.classList.add('show'); }
  else { badge.classList.remove('show'); }

  renderTickets();
}

function filterTickets(status, el) {
  document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ticketFilter = status;
  renderTickets();
}

function renderTickets() {
  const list = document.getElementById('tickets-list');
  const filtered = ticketFilter === 'all' ? allTickets : allTickets.filter(t => t.status === ticketFilter);

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No tickets found.</div>';
    return;
  }

  list.innerHTML = filtered.map(t => `
    <div class="ticket-card ${t.status}" id="ticket-${t.id}">
      <div class="ticket-top">
        <div>
          <div class="ticket-subject">${t.subject || '(No subject)'}</div>
          <div class="ticket-meta">From: ${t.userName} · ${formatDate(t.created_at)}</div>
        </div>
        <select class="ticket-status-select" onchange="updateTicket('${t.id}', this.value, this)">
          <option value="open" ${t.status === 'open' ? 'selected' : ''}>🔴 Open</option>
          <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>🟡 In Progress</option>
          <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>🟢 Resolved</option>
        </select>
      </div>
      ${t.message ? `<div class="ticket-msg">${t.message}</div>` : ''}
    </div>
  `).join('');
}

async function updateTicket(ticketId, status, selectEl) {
  const { error } = await sb.from('support_tickets').update({ status }).eq('id', ticketId);
  if (!error) {
    allTickets = allTickets.map(t => t.id === ticketId ? { ...t, status } : t);
    const card = document.getElementById(`ticket-${ticketId}`);
    if (card) { card.className = `ticket-card ${status}`; }
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────
async function loadFeedback() {
  const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
  if (error || !data) { allFeedback = []; return; }

  const userIds = [...new Set(data.map(f => f.user_id))];
  const { data: profs } = userIds.length ? await sb.from('profiles').select('id,name').in('id', userIds) : { data: [] };
  const nameMap = Object.fromEntries((profs || []).map(p => [p.id, p.name]));
  allFeedback = data.map(f => ({ ...f, userName: nameMap[f.user_id] || 'Anonymous' }));

  renderFeedback();
}

function renderFeedback() {
  if (!allFeedback.length) {
    document.getElementById('big-rating').textContent = '—';
    document.getElementById('rating-count').textContent = '0 reviews';
    document.getElementById('feedback-list').innerHTML = '<div class="empty-state">No feedback submitted yet.</div>';
    return;
  }

  const avg = allFeedback.reduce((s, f) => s + (f.rating || 0), 0) / allFeedback.length;
  document.getElementById('big-rating').textContent = avg.toFixed(1);
  document.getElementById('rating-count').textContent = `${allFeedback.length} reviews`;
  document.getElementById('rating-stars').innerHTML = [1,2,3,4,5].map(i =>
    `<span style="color:${i <= Math.round(avg) ? '#FF9C38' : '#2A2A2A'}">★</span>`
  ).join('');

  // Distribution
  const dist = [5,4,3,2,1].map(star => ({
    star, count: allFeedback.filter(f => f.rating === star).length
  }));
  const maxCount = Math.max(...dist.map(d => d.count), 1);
  document.getElementById('rating-dist').innerHTML = dist.map(d => `
    <div class="rating-dist-row">
      <span class="rating-dist-label">${d.star}★</span>
      <div class="rating-dist-bar"><div class="rating-dist-fill" style="width:${(d.count/maxCount*100)}%"></div></div>
      <span class="rating-dist-count">${d.count}</span>
    </div>
  `).join('');

  // Reviews list
  document.getElementById('feedback-list').innerHTML = allFeedback.map(f => `
    <div class="feedback-card">
      <div class="feedback-top">
        <span class="feedback-user">${f.userName}</span>
        <div class="feedback-stars">
          ${[1,2,3,4,5].map(i => `<span style="color:${i <= f.rating ? '#FF9C38' : '#2A2A2A'}">★</span>`).join('')}
        </div>
      </div>
      ${f.comments ? `<div class="feedback-comment">"${f.comments}"</div>` : ''}
      <div class="feedback-date">${formatDate(f.created_at)}</div>
    </div>
  `).join('');
}

// ── Announcements ─────────────────────────────────────────────────────────────
async function loadAnnouncements() {
  const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(10);
  allAnnouncements = data || [];
  renderAnnouncements();
}

function renderAnnouncements() {
  const el = document.getElementById('announce-history');
  if (!allAnnouncements.length) {
    el.innerHTML = '<div class="empty-state">No announcements dispatched yet.</div>';
    return;
  }
  el.innerHTML = allAnnouncements.map(a => `
    <div class="announce-item">
      <div class="announce-item-title">${a.title}</div>
      <div class="announce-item-body">${a.content}</div>
      <div class="announce-item-meta">
        <span>Target: ${a.target_group === 'all' ? 'All Trainees' : a.target_group}</span>
        <span>${formatDate(a.created_at)}</span>
      </div>
    </div>
  `).join('');
}

async function handleAnnouncement(e) {
  e.preventDefault();
  const title   = document.getElementById('ann-title').value.trim();
  const content = document.getElementById('ann-body').value.trim();
  const target  = document.getElementById('ann-target').value;
  const btn     = document.getElementById('ann-btn');
  const spinner = document.getElementById('ann-spinner');
  const btnText = document.getElementById('ann-btn-text');
  const success = document.getElementById('ann-success');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Broadcasting...';

  const { error } = await sb.from('announcements').insert({ title, content, target_group: target });

  btn.disabled = false;
  spinner.classList.add('hidden');
  btnText.textContent = 'Dispatch Announcement';

  if (!error) {
    success.classList.remove('hidden');
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-body').value = '';
    setTimeout(() => success.classList.add('hidden'), 4000);
    loadAnnouncements();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function iconUsers() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; }
function iconActivity() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`; }
function iconDumbbell() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M6 5v14M18 5v14"/><path d="M2 9h4M18 9h4M2 15h4M18 15h4"/><path d="M6 9h12v6H6z"/></svg>`; }
function iconChat() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`; }

function statCard(label, value, sub, color, iconSvg) {
  return `
    <div class="stat-card">
      <div class="stat-icon" style="background:${color}18;color:${color}">${iconSvg}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value" style="color:${color}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>
  `;
}
