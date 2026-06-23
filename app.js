// ── Supabase Init ────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://fbaiyziavefufdbtaabo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWl5emlhdmVmdWZkYnRhYWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODQ2MTksImV4cCI6MjA5NTk2MDYxOX0.tdIb4-XC5fPLug8UFz-0lkZDUVejMyIgn5I1CRF76-A';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
const ADMIN_API_ORIGIN = document.querySelector('meta[name="faujii-api-origin"]')?.content?.replace(/\/$/, '') || 'https://faujii.vercel.app';

// ── App State ────────────────────────────────────────────────────────────────
let allUsers = [];
let allTickets = [];
let allFeedback = [];
let allAnnouncements = [];
let allPlans = [];        // dynamic subscription plans
let allFeatures = [];     // feature catalogue
let editingPlanId = null; // plan currently being edited (null = creating new)
let selectedUserId = null;
let ticketFilter = 'all';
let activeAdminId = null;
let loginScreenMode = 'signin'; // 'signin', 'forgot', 'recovery'
let isRecoverySession = false;

// ── Custom Modal Helpers ──────────────────────────────────────────────────────
function showCustomModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isAlert = false, isWarning = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('custom-modal-title');
    const messageEl = document.getElementById('custom-modal-message');
    const cancelBtn = document.getElementById('custom-modal-cancel-btn');
    const confirmBtn = document.getElementById('custom-modal-confirm-btn');

    if (!modal || !titleEl || !messageEl || !cancelBtn || !confirmBtn) {
      if (isAlert) {
        alert(message);
        resolve(true);
      } else {
        resolve(confirm(message));
      }
      return;
    }

    titleEl.textContent = title;
    messageEl.innerHTML = message.replace(/\n/g, '<br>');
    confirmBtn.textContent = confirmText;
    
    if (isAlert) {
      cancelBtn.classList.add('hidden');
    } else {
      cancelBtn.classList.remove('hidden');
      cancelBtn.textContent = cancelText;
    }

    confirmBtn.className = isWarning ? 'custom-modal-btn-danger' : 'custom-modal-btn-confirm';

    modal.classList.remove('hidden');

    function cleanup(value) {
      modal.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeyDown);
      resolve(value);
    }

    function onConfirm() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && !isAlert) {
        cleanup(false);
      } else if (e.key === 'Enter') {
        cleanup(true);
      }
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeyDown);
  });
}

function showCustomAlert(title, message) {
  return showCustomModal({ title, message, confirmText: 'OK', isAlert: true });
}

function showCustomConfirm(title, message, isWarning = false, confirmText = 'Confirm') {
  return showCustomModal({ title, message, isWarning, confirmText, isAlert: false });
}

// ── Auth Helpers ─────────────────────────────────────────────────────────────
function showLoginMessage(text, isSuccess = false) {
  const errEl = document.getElementById('login-error');
  if (!errEl) return;
  errEl.textContent = text;
  errEl.classList.remove('hidden');
  if (isSuccess) {
    errEl.style.background = 'rgba(63,206,164,0.1)';
    errEl.style.borderColor = 'rgba(63,206,164,0.25)';
    errEl.style.color = 'var(--green)';
  } else {
    errEl.style.background = '';
    errEl.style.borderColor = '';
    errEl.style.color = '';
  }
}

function setLoginScreenMode(mode) {
  loginScreenMode = mode;
  
  const titleEl = document.querySelector('.login-title');
  const descEl = document.querySelector('.login-desc');
  const emailGroup = document.getElementById('login-email-group');
  const passwordGroup = document.getElementById('login-password-group');
  const recoveryGroup1 = document.getElementById('recovery-password-1-group');
  const recoveryGroup2 = document.getElementById('recovery-password-2-group');
  const btnText = document.getElementById('login-btn-text');
  const backToLoginWrap = document.getElementById('back-to-login-wrap');
  const forgotPasswordWrap = document.getElementById('forgot-password-wrap');
  
  // Reset message box
  const errEl = document.getElementById('login-error');
  if (errEl) {
    errEl.classList.add('hidden');
    errEl.style.background = '';
    errEl.style.borderColor = '';
    errEl.style.color = '';
  }

  // Get inputs to manage validation attributes dynamically
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const recoveryInput1 = document.getElementById('recovery-password-1');
  const recoveryInput2 = document.getElementById('recovery-password-2');

  if (mode === 'signin') {
    if (titleEl) titleEl.textContent = 'Sign In to Admin';
    if (descEl) descEl.textContent = 'Access restricted to authorized personnel only.';
    if (emailGroup) emailGroup.classList.remove('hidden');
    if (passwordGroup) passwordGroup.classList.remove('hidden');
    if (recoveryGroup1) recoveryGroup1.classList.add('hidden');
    if (recoveryGroup2) recoveryGroup2.classList.add('hidden');
    if (btnText) btnText.textContent = 'Access Dashboard';
    if (backToLoginWrap) backToLoginWrap.classList.add('hidden');
    if (forgotPasswordWrap) forgotPasswordWrap.classList.remove('hidden');
    
    if (emailInput) emailInput.required = true;
    if (passwordInput) passwordInput.required = true;
    if (recoveryInput1) { recoveryInput1.required = false; recoveryInput1.value = ''; }
    if (recoveryInput2) { recoveryInput2.required = false; recoveryInput2.value = ''; }
  } else if (mode === 'forgot') {
    if (titleEl) titleEl.textContent = 'Reset Admin Password';
    if (descEl) descEl.textContent = 'Enter your email address to receive a password reset link.';
    if (emailGroup) emailGroup.classList.remove('hidden');
    if (passwordGroup) passwordGroup.classList.add('hidden');
    if (recoveryGroup1) recoveryGroup1.classList.add('hidden');
    if (recoveryGroup2) recoveryGroup2.classList.add('hidden');
    if (btnText) btnText.textContent = 'Send Reset Link';
    if (backToLoginWrap) backToLoginWrap.classList.remove('hidden');
    if (forgotPasswordWrap) forgotPasswordWrap.classList.add('hidden');
    
    if (emailInput) emailInput.required = true;
    if (passwordInput) passwordInput.required = false;
    if (recoveryInput1) { recoveryInput1.required = false; recoveryInput1.value = ''; }
    if (recoveryInput2) { recoveryInput2.required = false; recoveryInput2.value = ''; }
  } else if (mode === 'recovery') {
    if (titleEl) titleEl.textContent = 'Create New Password';
    if (descEl) descEl.textContent = 'Please enter your new administrator password below.';
    if (emailGroup) emailGroup.classList.add('hidden');
    if (passwordGroup) passwordGroup.classList.add('hidden');
    if (recoveryGroup1) recoveryGroup1.classList.remove('hidden');
    if (recoveryGroup2) recoveryGroup2.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Update Password';
    if (backToLoginWrap) backToLoginWrap.classList.add('hidden');
    if (forgotPasswordWrap) forgotPasswordWrap.classList.add('hidden');
    
    if (emailInput) emailInput.required = false;
    if (passwordInput) passwordInput.required = false;
    if (recoveryInput1) { recoveryInput1.required = true; recoveryInput1.value = ''; }
    if (recoveryInput2) { recoveryInput2.required = true; recoveryInput2.value = ''; }
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function startAdminSession(session) {
  if (isRecoverySession) return;
  if (!session) { activeAdminId = null; showLogin(); return; }
  if (activeAdminId === session.user.id) return;
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (!profile?.is_admin) {
    await sb.auth.signOut();
    showLoginMessage('Access denied. This account does not have admin privileges.', false);
    return;
  }
  activeAdminId = session.user.id;
  showApp(session.user);
  loadAllData();
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    isRecoverySession = true;
    showLogin();
    setLoginScreenMode('recovery');
  } else if (!isRecoverySession) {
    startAdminSession(session);
  }
});

sb.auth.getSession().then(({ data: { session } }) => {
  const hash = window.location.hash || '';
  if (hash.includes('type=recovery') || hash.includes('recovery')) {
    isRecoverySession = true;
    showLogin();
    setLoginScreenMode('recovery');
  } else {
    startAdminSession(session);
  }
});

document.getElementById('forgot-password-link').addEventListener('click', (e) => {
  e.preventDefault();
  setLoginScreenMode('forgot');
});

document.getElementById('back-to-login-link').addEventListener('click', (e) => {
  e.preventDefault();
  setLoginScreenMode('signin');
});

async function handleSignInSubmit() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const btn   = document.getElementById('login-btn');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Signing in...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    showLoginMessage(error.message, false);
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Access Dashboard';
    return;
  }

  // Check admin flag
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', data.user.id).single();
  if (!profile?.is_admin) {
    await sb.auth.signOut();
    showLoginMessage('Access denied. This account does not have admin privileges.', false);
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Access Dashboard';
    return;
  }

  btn.disabled = false;
  spinner.classList.add('hidden');
  btnText.textContent = 'Access Dashboard';
  startAdminSession(data.session);
}

async function handleForgotPasswordSubmit() {
  const email = document.getElementById('login-email').value.trim();
  const btn = document.getElementById('login-btn');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Sending...';

  const redirectUrl = window.location.origin + window.location.pathname;
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });

  btn.disabled = false;
  spinner.classList.add('hidden');
  btnText.textContent = 'Send Reset Link';

  if (error) {
    showLoginMessage(error.message, false);
    return;
  }

  showLoginMessage('Password reset link sent! Check your email.', true);
}

async function handlePasswordRecoverySubmit() {
  const p1 = document.getElementById('recovery-password-1').value;
  const p2 = document.getElementById('recovery-password-2').value;
  const btn = document.getElementById('login-btn');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');

  if (p1.length < 8) {
    showLoginMessage('Password must be at least 8 characters.', false);
    return;
  }
  if (p1 !== p2) {
    showLoginMessage('Passwords do not match.', false);
    return;
  }

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Updating...';

  const { error } = await sb.auth.updateUser({ password: p1 });

  btn.disabled = false;
  spinner.classList.add('hidden');
  btnText.textContent = 'Update Password';

  if (error) {
    showLoginMessage(error.message, false);
    return;
  }

  showLoginMessage('Password updated successfully! Redirecting to dashboard...', true);
  
  isRecoverySession = false;
  
  // Wait 1.5s to let the user see the success message, then transition to dashboard
  setTimeout(async () => {
    if (window.history.replaceState) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
    const { data: { session } } = await sb.auth.getSession();
    setLoginScreenMode('signin');
    startAdminSession(session);
  }, 1500);
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (loginScreenMode === 'signin') {
    await handleSignInSubmit();
  } else if (loginScreenMode === 'forgot') {
    await handleForgotPasswordSubmit();
  } else if (loginScreenMode === 'recovery') {
    await handlePasswordRecoverySubmit();
  }
});

async function handleLogout() {
  activeAdminId = null;
  isRecoverySession = false;
  setLoginScreenMode('signin');
  await sb.auth.signOut();
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

let currentUser = null; // the logged-in admin's auth user (for Settings)

function showApp(user) {
  currentUser = user;
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
  analytics: 'Feature Analytics',
  plans: 'Subscription Plans',
  compliance: 'Compliance',
  monetization: 'Revenue & Subscriptions',
  support: 'Support Tickets',
  feedback: 'Ratings & Feedback',
  announce: 'Announcements',
  settings: 'Admin Settings',
};

// Friendly labels for the raw event keys recorded by the app
const FEATURE_LABELS = {
  food_scan: 'AI Food Scan (camera)',
  food_log: 'Food Logging',
  food_camera_open: 'Food Camera Opened',
  food_gallery_open: 'Food Gallery Opened',
  food_search_open: 'Food Search Opened',
  food_manual_open: 'Manual Food Entry Opened',
  workout_complete: 'Workout Completed',
  workout_start: 'Workout Started',
  workout_continue: 'Workout Continued',
  workout_restart: 'Workout Restarted',
  workout_select: 'Workout Selected',
  workout_custom_start: 'Custom Workout Started',
  ai_chat_message: 'AI Coach Chat',
  diet_plan_generate: 'Diet Plan Generated',
  diet_meal_complete: 'Diet Meal Completed',
  diet_meal_remove: 'Diet Meal Removed',
  run_start: 'Run Tracker Started',
  run_pause: 'Run Paused',
  run_resume: 'Run Resumed',
  run_finish: 'Run Finished',
  run_save: 'Run Saved',
  run_discard: 'Run Discarded',
  run_share: 'Run Shared',
  run_share_community: 'Run Shared to Community',
  run_controls_lock: 'Run Controls Locked',
  run_controls_unlock: 'Run Controls Unlocked',
  run_audio_toggle: 'Run Audio Setting Changed',
  run_auto_pause_toggle: 'Run Auto-Pause Changed',
  profile_save: 'Profile Updated',
  community_create: 'Community Created',
  community_join: 'Community Joined',
  community_post: 'Community Post Created',
  community_like: 'Community Post Liked',
  community_unlike: 'Community Post Unliked',
  community_share_invite: 'Community Invite Shared',
};
const SCREEN_LABELS = {
  dashboard: 'Dashboard / Home',
  coach: 'AI Coach',
  'workout-today': 'Today\'s Workout',
  'workout-active': 'Active Workout',
  'workout-picker': 'Workout Picker',
  'workout-editor': 'Workout Editor',
  'workout-summary': 'Workout Summary',
  'diet-plan': 'Diet Plan',
  'food-camera': 'Food Camera',
  'food-result': 'Food Result',
  progress: 'Progress',
  profile: 'Profile',
  run: 'Run Tracker',
  community: 'Community',
};

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById(`panel-${tab}`);
  if (panel) { panel.classList.add('active'); panel.classList.add('anim-in'); }
  document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;
  if (tab === 'settings') loadSettings();
}

// ── Admin Settings ──────────────────────────────────────────────────────────────
async function loadSettings() {
  if (!currentUser) return;
  setVal('set-email', currentUser.email || '');
  setText('set-sec-email', currentUser.email || '');
  setText('set-sec-last', currentUser.last_sign_in_at ? formatDate(currentUser.last_sign_in_at) : '—');
  const { data } = await sb.from('profiles').select('name').eq('id', currentUser.id).single();
  setVal('set-name', data?.name || '');
}

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function settingsMsg(id, text, ok) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = text;
  el.style.color = ok ? '#3FCEA4' : '#FF6161';
  el.style.display = 'block';
}

async function saveAdminProfile() {
  if (!currentUser) return;
  const name = document.getElementById('set-name').value.trim();
  if (!name) { settingsMsg('set-profile-msg', 'Name cannot be empty.', false); return; }
  const { error } = await sb.from('profiles').update({ name }).eq('id', currentUser.id);
  if (error) { settingsMsg('set-profile-msg', 'Could not save: ' + error.message, false); return; }
  document.getElementById('admin-name').textContent = name;
  settingsMsg('set-profile-msg', 'Profile saved ✓', true);
}

async function changeAdminPassword() {
  const p1 = document.getElementById('set-pw1').value;
  const p2 = document.getElementById('set-pw2').value;
  if (p1.length < 8) { settingsMsg('set-pw-msg', 'Password must be at least 8 characters.', false); return; }
  if (p1 !== p2) { settingsMsg('set-pw-msg', 'Passwords do not match.', false); return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { settingsMsg('set-pw-msg', 'Could not update: ' + error.message, false); return; }
  document.getElementById('set-pw1').value = '';
  document.getElementById('set-pw2').value = '';
  settingsMsg('set-pw-msg', 'Password updated ✓', true);
}

async function signOutEverywhere() {
  if (!(await showCustomConfirm('Sign Out', 'Sign out of ALL devices? You will need to log in again.', true, 'Sign Out'))) return;
  await sb.auth.signOut({ scope: 'global' });
  showLogin();
}

// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadAllData() {
  // The directory comes from a server-side Auth + profile join. Load it first
  // so user totals and recent registrations use the same source of truth.
  await loadUsers();
  await Promise.all([
    loadOverviewStats(),
    loadTickets(),
    loadFeedback(),
    loadAnnouncements(),
    loadAnalytics(),
    loadPlansAndFeatures(),
    loadSubscriptionMode(),
    loadRevenue(),
    loadCompliance(),
  ]);
}

// ── Compliance (REAL — computed from food_logs vs targets + workout_history) ──
async function loadCompliance() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
  const [{ data: profiles }, { data: foods }, { data: workouts }] = await Promise.all([
    sb.from('profiles').select('id,daily_calories,daily_protein,daily_carbs,daily_fat'),
    sb.from('food_logs').select('user_id,date,calories,protein,carbs,fat').gte('date', since),
    sb.from('workout_history').select('user_id,date,completed'),
  ]);

  // Macro adherence: average of (eaten ÷ target, capped 100%) over each user-day with food
  const tgt = {};
  (profiles || []).forEach(p => { tgt[p.id] = p; });
  const byUserDay = {};
  (foods || []).forEach(f => {
    const k = `${f.user_id}|${f.date}`;
    const o = byUserDay[k] || (byUserDay[k] = { uid: f.user_id, cal: 0, p: 0, c: 0, ft: 0 });
    o.cal += f.calories || 0; o.p += f.protein || 0; o.c += f.carbs || 0; o.ft += f.fat || 0;
  });
  let n = 0, sCal = 0, sP = 0, sC = 0, sF = 0;
  const ratio = (eaten, target) => (target > 0 ? Math.min(100, (eaten / target) * 100) : 0);
  Object.values(byUserDay).forEach(o => {
    const t = tgt[o.uid]; if (!t) return;
    sCal += ratio(o.cal, t.daily_calories); sP += ratio(o.p, t.daily_protein);
    sC += ratio(o.c, t.daily_carbs); sF += ratio(o.ft, t.daily_fat); n++;
  });
  const avg = s => (n ? Math.round(s / n) : 0);
  renderComplianceBars('macro-bars', [
    { label: 'Protein Target', pct: avg(sP), color: '#CDFF3F' },
    { label: 'Calorie Balance', pct: avg(sCal), color: '#7AD7FF' },
    { label: 'Carb Targets', pct: avg(sC), color: '#FF9C38' },
    { label: 'Fat Targets', pct: avg(sF), color: '#3FCEA4' },
  ], n);

  // Workout compliance: real completion + activity
  const w = workouts || [];
  const totalSessions = w.length;
  const completionRate = totalSessions ? Math.round(w.filter(x => x.completed).length / totalSessions * 100) : 0;
  const totalUsers = (profiles || []).length || 1;
  const activeWeek = new Set(w.filter(x => (x.date || '') >= since).map(x => x.user_id)).size;
  const everLogged = new Set(w.map(x => x.user_id)).size;
  renderComplianceBars('workout-bars', [
    { label: 'Workouts Completed', pct: completionRate, color: '#CDFF3F' },
    { label: 'Active This Week', pct: Math.round(activeWeek / totalUsers * 100), color: '#3FCEA4' },
    { label: 'Ever Logged a Workout', pct: Math.round(everLogged / totalUsers * 100), color: '#7AD7FF' },
  ], totalSessions);
}

function renderComplianceBars(elId, rows, sampleCount) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!sampleCount) { el.innerHTML = '<div class="empty-state">No data logged yet.</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div class="compliance-row">
      <div class="compliance-label"><span>${r.label}</span><span class="compliance-pct" style="color:${r.color}">${r.pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${r.pct}%;background:${r.color}"></div></div>
    </div>`).join('');
}

// ── Master switch: subscription system Hidden / Live ─────────────────────
let subscriptionMode = 'hidden';

async function loadSubscriptionMode() {
  const { data } = await sb.from('app_config').select('value').eq('key', 'subscription_mode').single();
  subscriptionMode = data?.value === 'live' ? 'live' : 'hidden';
  renderSubscriptionMode();
}

function renderSubscriptionMode() {
  const live = subscriptionMode === 'live';
  const label = document.getElementById('sub-mode-label');
  const desc  = document.getElementById('sub-mode-desc');
  const btn   = document.getElementById('sub-mode-toggle');
  const card  = document.getElementById('sub-mode-card');
  if (!btn) return;
  if (live) {
    label.textContent = 'Live';
    desc.textContent = 'users CAN see subscription plans, upgrade screens and paid-feature gating. Flip to Hidden to make the whole app free again instantly.';
    btn.textContent = '🔴 Switch to Hidden';
    card.style.borderColor = 'rgba(205,255,63,0.4)';
  } else {
    label.textContent = 'Hidden';
    desc.textContent = 'users see NO subscription, pricing, upgrade or payment screens. The app is fully free. Flip to Live when you’re ready to start charging.';
    btn.textContent = '🟢 Go Live';
    card.style.borderColor = 'rgba(255,255,255,0.07)';
  }
}

async function toggleSubscriptionMode() {
  const next = subscriptionMode === 'live' ? 'hidden' : 'live';
  if (next === 'live') {
    if (!(await showCustomConfirm('Go LIVE?', 'Users will start seeing subscription plans and paid features will be gated according to their plan. Make sure you have created your plans first.', false, 'Go Live'))) return;
  } else {
    if (!(await showCustomConfirm('Switch to Hidden?', 'Users will see NO subscription, pricing, upgrade or payment screens. The app will be fully free again.', true, 'Switch to Hidden'))) return;
  }
  const { error } = await sb.from('app_config')
    .upsert({ key: 'subscription_mode', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) { await showCustomAlert('Error', 'Could not change mode: ' + error.message); return; }
  subscriptionMode = next;
  renderSubscriptionMode();
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverviewStats() {
  // Pull the last 7 days of usage events once — powers real DAU + trend.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: workouts }, { count: chatCount }, { data: events }] = await Promise.all([
    sb.from('workout_history').select('completed'),
    sb.from('chat_messages').select('*', { count: 'exact', head: true }),
    sb.from('usage_events').select('user_id,created_at').gte('created_at', sevenDaysAgo),
  ]);

  const total = allUsers.length;
  const newSignups = allUsers.filter(p => {
    return (Date.now() - new Date(p.createdAt)) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const completed = (workouts || []).filter(w => w.completed).length;
  const completionRate = workouts?.length ? Math.round((completed / workouts.length) * 100) : 0;

  // Real Daily Active Users = distinct users with an event today
  const todayStr = new Date().toDateString();
  const dau = new Set((events || [])
    .filter(e => new Date(e.created_at).toDateString() === todayStr)
    .map(e => e.user_id)).size;
  const dauPct = total ? Math.round((dau / total) * 100) : 0;

  // Stats cards
  document.getElementById('stats-grid').innerHTML = `
    ${statCard('Total Trainees', total, `+${newSignups} this week`, '#CDFF3F', iconUsers())}
    ${statCard('Daily Active', dau, total ? `${dauPct}% of base` : 'No activity yet', '#7AD7FF', iconActivity())}
    ${statCard('Workout Completion', completionRate + '%', 'Exercises logged', '#3FCEA4', iconDumbbell())}
    ${statCard('AI Chat Sessions', chatCount || 0, 'Total interactions', '#FF9C38', iconChat())}
  `;

  // Badge
  document.getElementById('total-users-badge').textContent = total + ' users';

  // Goal chart
  const goalCounts = { bulk: 0, cut: 0, maintain: 0 };
  allUsers.forEach(p => { if (goalCounts[p.goal] !== undefined) goalCounts[p.goal]++; });
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

  // Trend chart — real distinct active users per day (last 7 days)
  drawTrendChart(events || []);

  // Recent signups
  const recent = [...allUsers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const chipColors = ['#CDFF3F','#7AD7FF','#3FCEA4','#FF9C38','#FF6161','#C084FC'];
  document.getElementById('recent-signups').innerHTML = recent.map((p, i) => `
    <div class="recent-item">
      <div class="user-chip" style="background:${chipColors[i % chipColors.length]}">${(p.name || 'A')[0].toUpperCase()}</div>
      <div class="recent-info">
        <div class="recent-name">${p.name || 'Anonymous'}</div>
        <div class="recent-sub">${goalLabels[p.goal] || p.goal || '—'} · ${p.level || '—'}</div>
      </div>
      <div class="recent-meta">${timeAgo(p.createdAt)}</div>
    </div>
  `).join('');

  // Inactive users count (from allUsers if loaded)
  updateInactiveList(allUsers);
}

function drawTrendChart(events) {
  const svg = document.getElementById('trend-svg');
  const now = new Date();
  // Build the last 7 calendar days, labelled by weekday.
  const dayDefs = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toDateString(), label: d.toLocaleDateString('en-IN', { weekday: 'short' }) };
  });

  // Real metric: distinct active users per day
  const vals = dayDefs.map(({ key }) => {
    const usersThatDay = new Set(
      (events || []).filter(e => new Date(e.created_at).toDateString() === key).map(e => e.user_id)
    );
    return usersThatDay.size;
  });
  const days = dayDefs.map(d => d.label);
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

// ── Product Usage Analytics ───────────────────────────────────────────────────
// The API returns aggregates only. Raw chat messages, food details, GPS routes,
// and other sensitive user content never enter this dashboard.
async function loadAnalytics() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Admin session expired.');
    const response = await fetch(`${ADMIN_API_ORIGIN}/api/admin-analytics`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const analytics = await response.json();
    if (!response.ok) throw new Error(analytics.error || 'Could not load analytics.');
    renderProductAnalytics(analytics);
  } catch (error) {
    console.error('Could not load product analytics:', error);
    ['feature-usage-list', 'screen-usage-list', 'screen-time-list', 'feature-retention-list', 'activity-history-list']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="empty-state">Analytics are temporarily unavailable.</div>';
      });
  }
}

function renderProductAnalytics(analytics) {
  const summary = analytics.summary || {};
  const screenCounts = Object.fromEntries((analytics.screenUsage || []).map(row => [row.screen, row.views]));
  const featureCounts = Object.fromEntries((analytics.featureUsage || []).map(row => [row.feature, row.count]));
  renderUsageBars('feature-usage-list', featureCounts, FEATURE_LABELS, '#CDFF3F');
  renderUsageBars('screen-usage-list', screenCounts, SCREEN_LABELS, '#7AD7FF');
  renderScreenTime(analytics.screenUsage || []);
  renderFeatureRetention(analytics.featureRetention || []);
  renderUserActivityHistory(analytics.users || []);

  setText('analytics-dau', summary.dau || 0);
  setText('analytics-wau', summary.wau || 0);
  setText('analytics-mau', summary.mau || 0);
  setText('analytics-total-time', formatDuration(summary.totalSeconds || 0));
  setText('analytics-avg-session', formatDuration(summary.avgSessionSeconds || 0));
  setText('analytics-repeat', summary.repeatUsers || 0);
  setText('analytics-repeat-pct', summary.mau ? `${summary.repeatRate || 0}%` : '—');
  setText('analytics-loyal', summary.powerUsers || 0);
  setText('analytics-total-events', Number(summary.totalEvents || 0).toLocaleString('en-IN'));
}

function renderScreenTime(rows) {
  const el = document.getElementById('screen-time-list');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">Time tracking begins as users use the current release.</div>';
    return;
  }
  const max = Math.max(...rows.map(row => row.seconds), 1);
  el.innerHTML = rows.slice(0, 10).map(row => `
    <div class="goal-row">
      <div class="goal-row-header">
        <span class="goal-label">${escapeHtml(SCREEN_LABELS[row.screen] || row.screen)}</span>
        <span class="goal-pct" style="color:var(--orange)">${formatDuration(row.seconds)} <small class="goal-meta">${row.views} opens</small></span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.max(2, Math.round((row.seconds / max) * 100))}%;background:var(--orange)"></div></div>
    </div>`).join('');
}

function renderFeatureRetention(rows) {
  const el = document.getElementById('feature-retention-list');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">Feature retention appears after users return to a feature on another day.</div>';
    return;
  }
  el.innerHTML = rows.slice(0, 10).map(row => `
    <div class="analytics-row">
      <span>${escapeHtml(FEATURE_LABELS[row.feature] || row.feature)}</span>
      <b>${row.repeatRate}% repeat · ${row.users} users</b>
    </div>`).join('');
}

function renderUserActivityHistory(rows) {
  const el = document.getElementById('activity-history-list');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No recent user activity yet.</div>';
    return;
  }
  const usersById = new Map(allUsers.map(user => [user.id, user]));
  el.innerHTML = rows.slice(0, 20).map(row => {
    const user = usersById.get(row.userId);
    const name = user?.name || 'Unknown user';
    const detail = [
      `Last active ${timeAgo(row.lastActiveAt)}`,
      `${row.activeDays} active days`,
      formatDuration(row.totalSeconds),
      row.mostUsedFeature ? (FEATURE_LABELS[row.mostUsedFeature] || row.mostUsedFeature) : 'No actions',
    ].join(' · ');
    return `<div class="analytics-user-row">
      <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></div>
      <div class="analytics-user-pages">${escapeHtml(SCREEN_LABELS[row.mostVisitedScreen] || row.mostVisitedScreen || 'No pages')}</div>
    </div>`;
  }).join('');
}

// Renders a ranked horizontal bar list into a container.
function renderUsageBars(elId, counts, labelMap, color) {
  const el = document.getElementById(elId);
  if (!el) return;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No usage recorded yet. Data appears once trainees start using the app.</div>';
    return;
  }
  const max = rows[0][1] || 1;
  el.innerHTML = rows.map(([key, count]) => {
    const pct = Math.round((count / max) * 100);
    const label = (labelMap && labelMap[key]) || key;
    return `
      <div class="goal-row">
        <div class="goal-row-header">
          <span class="goal-label">${label}</span>
          <span class="goal-pct" style="color:${color}">${count.toLocaleString('en-IN')}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }).join('');
}

// ── Revenue & Subscriptions ─────────────────────────────────────────────────────
// Real numbers from the subscriptions + payments tables.
async function loadRevenue() {
  const [{ data: subs }, { data: payments }] = await Promise.all([
    sb.from('subscriptions').select('plan_id,status,amount'),
    sb.from('payments').select('amount,status,created_at'),
  ]);
  const allSubs = subs || [];
  const pays = payments || [];

  // MRR = sum of amounts on currently-active subscriptions
  const active = allSubs.filter(s => s.status === 'active');
  const mrr = active.reduce((sum, s) => sum + (s.amount || 0), 0);
  const trialCount = allSubs.filter(s => s.status === 'trial' || !s.plan_id).length;

  // Real lifetime revenue from successful payments
  const lifetimeRev = pays.filter(p => p.status === 'success').reduce((sum, p) => sum + (p.amount || 0), 0);

  setText('mrr-real', '₹' + mrr.toLocaleString('en-IN'));
  setText('projected-mrr', '₹' + lifetimeRev.toLocaleString('en-IN'));
  setText('trial-users', trialCount);
  setText('annual-rev', '₹' + (mrr * 12).toLocaleString('en-IN'));

  drawRevenueChart(pays);
}

// Fetches subscriptions and renders the per-plan subscriber mix. Called after
// plans are loaded (needs allPlans), so it lives separately from loadRevenue.
async function loadRevenuePlanMix() {
  const { data: subs } = await sb.from('subscriptions').select('plan_id,status');
  renderRevenuePlanMix(subs || []);
}

// Shows how many users are on each dynamic plan (vs free)
function renderRevenuePlanMix(allSubs) {
  const el = document.getElementById('revenue-plan-mix');
  if (!el) return;
  const total = allSubs.length || 1;
  const colors = ['#CDFF3F', '#7AD7FF', '#3FCEA4', '#FF9C38', '#C084FC', '#FB7185'];
  const freeCount = allSubs.filter(s => !s.plan_id).length;

  const rows = (allPlans || []).map((p, i) => {
    const count = allSubs.filter(s => s.plan_id === p.id).length;
    const pct = Math.round((count / total) * 100);
    return { name: p.name, count, pct, color: colors[i % colors.length] };
  });
  rows.unshift({ name: 'Free / No plan', count: freeCount, pct: Math.round((freeCount / total) * 100), color: '#5A5A56' });

  el.innerHTML = rows.map(r => `
    <div class="plan-card" style="border-left-color:${r.color}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="plan-name">${r.name}</div>
        <div class="plan-conversion">${r.count} users · ${r.pct}%</div>
      </div>
      <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${r.pct}%;background:${r.color}"></div></div>
    </div>
  `).join('');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function drawRevenueChart(payments) {
  const svg = document.getElementById('rev-svg');
  if (!svg) return;
  // Build last 6 months of real successful-payment revenue
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { m: d.toLocaleDateString('en-IN', { month: 'short' }), y: d.getFullYear(), mo: d.getMonth(), v: 0 };
  });
  (payments || []).filter(p => p.status === 'success').forEach(p => {
    const d = new Date(p.created_at);
    const slot = months.find(s => s.mo === d.getMonth() && s.y === d.getFullYear());
    if (slot) slot.v += (p.amount || 0);
  });
  const data = months;
  const maxV = Math.max(...data.map(d => d.v), 1);
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
    <text x="8" y="${padY}" font-size="9" fill="#5A5A56" font-family="DM Sans">₹${Math.round(maxV).toLocaleString('en-IN')}</text>
    <text x="8" y="${H/2}" font-size="9" fill="#5A5A56" font-family="DM Sans">₹${Math.round(maxV/2).toLocaleString('en-IN')}</text>
  `;
}

// ════════════════════════════════════════════════════════════════════════
// DYNAMIC SUBSCRIPTION PLANS  (create / edit / delete plans + features)
// Reads & writes: features, subscription_plans, plan_features
// ════════════════════════════════════════════════════════════════════════
async function loadPlansAndFeatures() {
  const [{ data: features, error: fErr }, { data: plans }, { data: links }] = await Promise.all([
    sb.from('features').select('*').order('sort_order', { ascending: true }),
    sb.from('subscription_plans').select('*').order('sort_order', { ascending: true }),
    sb.from('plan_features').select('plan_id,feature_id'),
  ]);

  // If the tables don't exist yet (migration not run), show a friendly hint
  // instead of breaking the page.
  if (fErr) {
    const warn = document.getElementById('plans-setup-warning');
    if (warn) warn.classList.remove('hidden');
    return;
  }
  const warn = document.getElementById('plans-setup-warning');
  if (warn) warn.classList.add('hidden');

  allFeatures = features || [];
  const linksByPlan = {};
  (links || []).forEach(l => { (linksByPlan[l.plan_id] = linksByPlan[l.plan_id] || []).push(l.feature_id); });
  allPlans = (plans || []).map(p => ({ ...p, featureIds: linksByPlan[p.id] || [] }));

  renderFeatureCatalogue();
  renderPlans();
  renderPlanFormFeatures();
  loadRevenuePlanMix(); // refresh the per-plan subscriber mix on the Revenue tab
}

function renderFeatureCatalogue() {
  const el = document.getElementById('feature-catalogue');
  if (!el) return;
  if (!allFeatures.length) {
    el.innerHTML = '<div class="empty-state">No features yet. Add one below.</div>';
    return;
  }
  el.innerHTML = allFeatures.map(f => `
    <div class="log-item">
      <span class="log-name">${f.name} <span style="color:var(--text-3);font-size:11px">(${f.key})</span></span>
      <button class="tbl-btn" onclick="toggleFeatureFree('${f.id}', ${f.is_free})">
        ${f.is_free ? '🟢 Free' : '🔒 Premium'}
      </button>
    </div>
  `).join('');
}

async function toggleFeatureFree(featureId, currentlyFree) {
  const { error } = await sb.from('features').update({ is_free: !currentlyFree }).eq('id', featureId);
  if (!error) loadPlansAndFeatures();
}

async function addFeature(e) {
  e.preventDefault();
  const name = document.getElementById('feat-name').value.trim();
  const key  = document.getElementById('feat-key').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const isFree = document.getElementById('feat-free').checked;
  if (!name || !key) return;
  const { error } = await sb.from('features').insert({ name, key, is_free: isFree, sort_order: allFeatures.length + 1 });
  if (error) { await showCustomAlert('Error', 'Could not add feature: ' + error.message); return; }
  document.getElementById('feat-name').value = '';
  document.getElementById('feat-key').value = '';
  loadPlansAndFeatures();
}

function renderPlans() {
  const el = document.getElementById('plans-list');
  if (!el) return;
  if (!allPlans.length) {
    el.innerHTML = '<div class="empty-state">No plans yet. Create your first plan on the right →</div>';
    return;
  }
  const featName = id => (allFeatures.find(f => f.id === id) || {}).name || '?';
  el.innerHTML = allPlans.map(p => `
    <div class="plan-card" style="border-left-color:${p.is_active ? '#CDFF3F' : '#5A5A56'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div class="plan-name">${p.name} ${p.is_active ? '' : '<span class="pill pill-red" style="font-size:9px">DISABLED</span>'}</div>
        <div style="display:flex;gap:6px">
          <button class="tbl-btn" onclick="editPlan('${p.id}')">Edit</button>
          <button class="tbl-btn" onclick="togglePlanActive('${p.id}', ${p.is_active})">${p.is_active ? 'Disable' : 'Enable'}</button>
          <button class="tbl-btn" style="color:var(--red)" onclick="deletePlan('${p.id}', '${(p.name||'').replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </div>
      <div class="plan-price">₹${(p.price_monthly||0).toLocaleString('en-IN')} <span class="plan-period">/ mo</span>
        ${p.price_yearly ? ` · ₹${p.price_yearly.toLocaleString('en-IN')} <span class="plan-period">/ yr</span>` : ''}</div>
      ${p.description ? `<div class="plan-desc">${p.description}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
        ${p.featureIds.length
          ? p.featureIds.map(id => `<span class="pill pill-accent" style="font-size:10px">${featName(id)}</span>`).join('')
          : '<span style="color:var(--text-3);font-size:12px">No features selected</span>'}
      </div>
    </div>
  `).join('');
}

// Render the feature checkboxes inside the create/edit form
function renderPlanFormFeatures() {
  const el = document.getElementById('plan-form-features');
  if (!el) return;
  if (!allFeatures.length) {
    el.innerHTML = '<div style="color:var(--text-3);font-size:12px">Add features first.</div>';
    return;
  }
  el.innerHTML = allFeatures.map(f => `
    <label class="feat-check">
      <input type="checkbox" value="${f.id}" class="plan-feat-cb" />
      <span>${f.name}</span>
    </label>
  `).join('');
}

function editPlan(planId) {
  const p = allPlans.find(x => x.id === planId);
  if (!p) return;
  editingPlanId = planId;
  document.getElementById('plan-form-title').textContent = 'Edit Plan';
  document.getElementById('plan-name').value = p.name || '';
  document.getElementById('plan-desc').value = p.description || '';
  document.getElementById('plan-monthly').value = p.price_monthly || 0;
  document.getElementById('plan-yearly').value = p.price_yearly || 0;
  document.getElementById('plan-active').checked = !!p.is_active;
  document.querySelectorAll('.plan-feat-cb').forEach(cb => { cb.checked = p.featureIds.includes(cb.value); });
  document.getElementById('plan-cancel-edit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetPlanForm() {
  editingPlanId = null;
  document.getElementById('plan-form-title').textContent = 'Create New Plan';
  document.getElementById('plan-name').value = '';
  document.getElementById('plan-desc').value = '';
  document.getElementById('plan-monthly').value = '';
  document.getElementById('plan-yearly').value = '';
  document.getElementById('plan-active').checked = true;
  document.querySelectorAll('.plan-feat-cb').forEach(cb => { cb.checked = false; });
  document.getElementById('plan-cancel-edit').classList.add('hidden');
}

async function savePlan(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('plan-name').value.trim(),
    description: document.getElementById('plan-desc').value.trim(),
    price_monthly: parseInt(document.getElementById('plan-monthly').value || '0', 10),
    price_yearly: parseInt(document.getElementById('plan-yearly').value || '0', 10),
    is_active: document.getElementById('plan-active').checked,
  };
  if (!payload.name) { await showCustomAlert('Validation Error', 'Please enter a plan name.'); return; }
  const selectedFeatureIds = [...document.querySelectorAll('.plan-feat-cb:checked')].map(cb => cb.value);

  let planId = editingPlanId;
  if (editingPlanId) {
    payload.updated_at = new Date().toISOString();
    const { error } = await sb.from('subscription_plans').update(payload).eq('id', editingPlanId);
    if (error) { await showCustomAlert('Error', 'Could not save plan: ' + error.message); return; }
  } else {
    payload.sort_order = allPlans.length + 1;
    const { data, error } = await sb.from('subscription_plans').insert(payload).select('id').single();
    if (error) { await showCustomAlert('Error', 'Could not create plan: ' + error.message); return; }
    planId = data.id;
  }

  // Re-sync the plan↔feature links: clear then insert the selected set
  await sb.from('plan_features').delete().eq('plan_id', planId);
  if (selectedFeatureIds.length) {
    await sb.from('plan_features').insert(selectedFeatureIds.map(fid => ({ plan_id: planId, feature_id: fid })));
  }

  resetPlanForm();
  loadPlansAndFeatures();
  loadRevenue(); // refresh plan-mix percentages on the revenue tab
}

async function togglePlanActive(planId, currentlyActive) {
  const { error } = await sb.from('subscription_plans')
    .update({ is_active: !currentlyActive, updated_at: new Date().toISOString() }).eq('id', planId);
  if (!error) loadPlansAndFeatures();
}

async function deletePlan(planId, name) {
  if (!(await showCustomConfirm('Delete Plan', `Delete the plan "${name}"?\n\nUsers currently on it will fall back to free access. This cannot be undone.`, true, 'Delete'))) return;
  const { error } = await sb.from('subscription_plans').delete().eq('id', planId);
  if (!error) { loadPlansAndFeatures(); loadRevenue(); }
}

// Manually assign / change a user's subscription (requirement: assign access to users)
async function assignUserSubscription(userId, prefix) {
  const planId = document.getElementById(`${prefix}-sub-plan-${userId}`).value || null;
  const status = document.getElementById(`${prefix}-sub-status-${userId}`).value;
  const expiry = document.getElementById(`${prefix}-sub-expiry-${userId}`).value || null;
  const plan = (allPlans || []).find(p => p.id === planId);

  const row = {
    user_id: userId,
    plan_id: planId,
    status,
    amount: plan ? (plan.price_monthly || 0) : 0,
    current_period_end: expiry ? new Date(expiry).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // Upsert by user_id (one subscription row per user)
  const { error } = await sb.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) { await showCustomAlert('Error', 'Could not save subscription: ' + error.message); return; }
  loadUserLogs(userId, prefix === 'drw');
  loadRevenue();
  loadRevenuePlanMix();
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) { allUsers = []; return; }
  const response = await fetch(`${ADMIN_API_ORIGIN}/api/admin-users`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    allUsers = [];
    console.error('Could not load the admin directory:', data.error || response.status);
    return;
  }
  allUsers = data.users || [];

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
    if (search && !`${u.name} ${u.email || ''} ${u.goal}`.toLowerCase().includes(search)) return false;
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
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${u.email || 'No email available'}</div>
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
        <div class="detail-since">Registered ${formatDate(user.createdAt)}</div>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
          ${user.isAdmin ? '<span class="pill pill-accent">ADMIN</span>' : ''}
          ${user.isSuspended ? '<span class="pill pill-red">SUSPENDED</span>' : '<span class="pill pill-green">ACTIVE</span>'}
        </div>
      </div>
    </div>

    <div>
      <div class="detail-section-title">Profile</div>
      <div class="detail-rows">
        <div class="detail-row"><span class="detail-row-label">Email</span><span class="detail-row-val">${user.email || '—'}</span></div>
        <div class="detail-row"><span class="detail-row-label">Email status</span><span class="detail-row-val">${user.emailConfirmedAt ? 'Confirmed' : 'Awaiting confirmation'}</span></div>
        <div class="detail-row"><span class="detail-row-label">Last sign-in</span><span class="detail-row-val">${user.lastSignInAt ? formatDate(user.lastSignInAt) : 'Never'}</span></div>
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
      <div class="detail-section-title">Individual Analytics</div>
      <div id="${prefix}-analytics-${user.id}" class="analytics-loading">
        Loading secure usage analytics...
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
      <div class="detail-section-title">Subscription & Payments</div>
      <div id="${prefix}-billing-${user.id}" class="detail-rows">
        <div style="color:var(--text-3);font-size:12px">Loading subscription…</div>
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

const PLAN_LABELS = { free: 'Free', trial: 'Free Trial', pro_monthly: 'Pro Monthly', pro_annual: 'Elite Annual' };
const SUB_STATUS_COLORS = { active: 'var(--green)', trial: 'var(--blue)', past_due: '#FF9C38', canceled: 'var(--red)', expired: 'var(--text-3)' };

async function loadUserLogs(userId, isDrawer = false) {
  const prefix = isDrawer ? 'drw' : 'det';
  const [{ data: workouts }, { data: foods }, { data: sub }, { data: pays }] = await Promise.all([
    sb.from('workout_history').select('split,date,completed').eq('user_id', userId).order('date', { ascending: false }).limit(10),
    sb.from('food_logs').select('name,cal,logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(10),
    sb.from('subscriptions').select('*').eq('user_id', userId).single(),
    sb.from('payments').select('amount,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  const bEl = document.getElementById(`${prefix}-billing-${userId}`);
  if (bEl) {
    const currentPlanId = sub?.plan_id || '';
    const status = sub?.status || 'trial';
    const expiryVal = sub?.current_period_end ? sub.current_period_end.slice(0, 10) : '';
    const paysList = (pays || []).length
      ? pays.map(p => `
          <div class="log-item">
            <span class="log-name">₹${(p.amount || 0).toLocaleString('en-IN')} · ${formatDate(p.created_at)}</span>
            <span class="log-val" style="color:${p.status === 'success' ? 'var(--green)' : p.status === 'refunded' ? '#FF9C38' : 'var(--red)'}">${p.status}</span>
          </div>`).join('')
      : '<div class="empty-state" style="padding:8px">No payments yet.</div>';

    const planOptions = `<option value="">Free / No plan</option>` +
      (allPlans || []).map(p => `<option value="${p.id}" ${p.id === currentPlanId ? 'selected' : ''}>${p.name} (₹${(p.price_monthly||0)}/mo)</option>`).join('');
    const statusOptions = ['trial','active','past_due','canceled','expired']
      .map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s.replace('_',' ')}</option>`).join('');

    bEl.innerHTML = `
      <div class="field-group" style="margin-bottom:8px">
        <label class="field-label">Assign Plan</label>
        <select id="${prefix}-sub-plan-${userId}" class="field-input">${planOptions}</select>
      </div>
      <div style="display:flex;gap:8px">
        <div class="field-group" style="flex:1">
          <label class="field-label">Status</label>
          <select id="${prefix}-sub-status-${userId}" class="field-input" style="text-transform:capitalize">${statusOptions}</select>
        </div>
        <div class="field-group" style="flex:1">
          <label class="field-label">Expiry Date</label>
          <input type="date" id="${prefix}-sub-expiry-${userId}" class="field-input" value="${expiryVal}" />
        </div>
      </div>
      <button class="detail-btn detail-btn-admin" style="margin-top:6px" onclick="assignUserSubscription('${userId}','${prefix}')">💳 Save Subscription</button>
      <div style="font-size:11px;font-weight:700;color:var(--text-3);margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.8px">Payment History</div>
      <div class="logs-list">${paysList}</div>
    `;
  }

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

  loadUserAnalytics(userId, prefix);
}

async function loadUserAnalytics(userId, prefix) {
  const container = document.getElementById(`${prefix}-analytics-${userId}`);
  if (!container) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Admin session expired.');
    const response = await fetch(`${ADMIN_API_ORIGIN}/api/admin-user-analytics?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const analytics = await response.json();
    if (!response.ok) throw new Error(analytics.error || 'Could not load analytics.');
    renderUserAnalytics(container, analytics);
  } catch (error) {
    container.innerHTML = `<div class="empty-state" style="padding:8px">${escapeHtml(error.message || 'Analytics are unavailable.')}</div>`;
  }
}

function renderUserAnalytics(container, analytics) {
  const summary = analytics.summary || {};
  const totals = analytics.totals || {};
  const topScreens = (analytics.screenUsage || []).slice(0, 6);
  const topFeatures = (analytics.featureUsage || []).slice(0, 6);
  const recentDays = (analytics.activity || []).slice(0, 7);
  const screenName = (key) => SCREEN_LABELS[key] || key || 'Unknown screen';
  const featureName = (key) => FEATURE_LABELS[key] || key || 'No tracked actions';
  const metric = (label, value) => `<div class="analytics-metric"><span>${label}</span><strong>${value}</strong></div>`;
  const usageRows = topScreens.length
    ? topScreens.map(item => `<div class="analytics-row"><span>${escapeHtml(screenName(item.key))}</span><b>${formatDuration(item.seconds)} · ${item.views} opens</b></div>`).join('')
    : '<div class="empty-state" style="padding:4px">No page-use data yet.</div>';
  const featureRows = topFeatures.length
    ? topFeatures.map(item => `<div class="analytics-row"><span>${escapeHtml(featureName(item.key))}</span><b>${item.count}</b></div>`).join('')
    : '<div class="empty-state" style="padding:4px">No actions recorded yet.</div>';
  const dayRows = recentDays.length
    ? recentDays.map(day => `<div class="analytics-row"><span>${formatShortDate(day.date)}</span><b>${day.events} events · ${formatDuration(day.seconds)}</b></div>`).join('')
    : '<div class="empty-state" style="padding:4px">No activity history yet.</div>';

  container.innerHTML = `
    <div class="analytics-metrics">
      ${metric('Last active', summary.lastActiveAt ? timeAgo(summary.lastActiveAt) : 'Never')}
      ${metric('Active time', formatDuration(summary.totalSeconds || 0))}
      ${metric('Sessions', summary.totalSessions || 0)}
      ${metric('Avg. session', formatDuration(summary.avgSessionSeconds || 0))}
      ${metric('Active days', summary.activeDays || 0)}
      ${metric('Top feature', escapeHtml(featureName(summary.mostUsedFeature?.key)))}
    </div>
    <div class="analytics-highlight">
      <span>Most opened page</span><strong>${escapeHtml(screenName(summary.mostVisitedScreen?.key))}</strong>
    </div>
    <div class="analytics-subtitle">Time by section</div>
    <div class="analytics-list">${usageRows}</div>
    <div class="analytics-subtitle">Most-used actions</div>
    <div class="analytics-list">${featureRows}</div>
    <div class="analytics-subtitle">Last 7 active days</div>
    <div class="analytics-list">${dayRows}</div>
    <div class="analytics-totals">
      ${metric('Food logs', totals.foodLogs || 0)}
      ${metric('Workouts', `${totals.completedWorkouts || 0}/${totals.workouts || 0}`)}
      ${metric('Runs', `${totals.runs || 0} · ${Number(totals.runKm || 0).toFixed(1)} km`)}
      ${metric('Coach messages', totals.chatMessages || 0)}
    </div>
  `;
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
  if (!(await showCustomConfirm('Delete Trainee Profile', `Are you absolutely sure you want to PERMANENTLY DELETE "${name}"?\n\nAll their data (workouts, food logs, profile) will be erased and cannot be recovered.`, true, 'Delete Profile'))) return;
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

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return '—';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${total}s`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
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
