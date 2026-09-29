/* ============================================
   Easy Attendance — Application Logic
   Developer: GURKIRAT SINGH
   ============================================ */

(function () {
  'use strict';

  // ───────── State ─────────
  const STATE_KEY = 'easyAttendance';
  let state = loadState();

  function defaultState() {
    return {
      loggedIn: false,
      rollNumber: '',
      studentName: 'Student',
      theme: 'dark',
      targetAttendance: 75,
      warningThreshold: 80,
      subjects: [],
      streak: 0,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (_) { /* ignore */ }
    return defaultState();
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  // ───────── Demo Data ─────────
  function getDemoSubjects() {
    return [
      { id: genId(), name: 'Data Structures & Algorithms', code: 'CS-301', total: 42, attended: 36 },
      { id: genId(), name: 'Database Management Systems', code: 'CS-302', total: 40, attended: 29 },
      { id: genId(), name: 'Computer Networks', code: 'CS-303', total: 38, attended: 25 },
      { id: genId(), name: 'Operating Systems', code: 'CS-304', total: 44, attended: 40 },
      { id: genId(), name: 'Software Engineering', code: 'CS-305', total: 36, attended: 28 },
      { id: genId(), name: 'Mathematics-III', code: 'MA-301', total: 40, attended: 24 },
    ];
  }

  function genId() {
    return '_' + Math.random().toString(36).slice(2, 10);
  }

  // ───────── DOM Refs ─────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const loginOverlay = $('#loginOverlay');
  const loginForm = $('#loginForm');
  const loginBtn = $('#loginBtn');
  const loginError = $('#loginError');
  const loginErrorMsg = $('#loginErrorMsg');
  const rollInput = $('#rollNumber');
  const passInput = $('#password');
  const rememberMe = $('#rememberMe');
  const togglePasswordBtn = $('#togglePassword');

  const appContainer = $('#appContainer');
  const sidebar = $('#sidebar');
  const sidebarOverlay = $('#sidebarOverlay');
  const menuToggle = $('#menuToggle');
  const navItems = $$('.nav-item[data-view]');
  const viewSections = $$('.view-section');
  const logoutBtn = $('#logoutBtn');

  const greetingText = $('#greetingText');
  const greetingSubtext = $('#greetingSubtext');
  const profileAvatar = $('#profileAvatar');
  const profileName = $('#profileName');
  const themeToggleBtn = $('#themeToggleBtn');
  const notifBadge = $('#notifBadge');
  const headerRollNumber = $('#headerRollNumber');

  // Dashboard
  const statOverall = $('#statOverall');
  const statAttended = $('#statAttended');
  const statMissed = $('#statMissed');
  const statStreak = $('#statStreak');
  const ringProgress = $('#ringProgress');
  const ringPercentage = $('#ringPercentage');
  const ringStatus = $('#ringStatus');
  const subjectsGrid = $('#subjectsGrid');
  const subjectCount = $('#subjectCount');
  const alertsList = $('#alertsList');
  const heatmapGrid = $('#heatmapGrid');

  // Calculator
  const targetSlider = $('#targetSlider');
  const targetDisplay = $('#targetDisplay');
  const calcResultsGrid = $('#calcResultsGrid');

  // Settings
  const darkModeToggle = $('#darkModeToggle');
  const defaultTargetInput = $('#defaultTarget');
  const warningThresholdInput = $('#warningThreshold');
  const settingRoll = $('#settingRoll');

  // Refresh
  const refreshBtn = $('#refreshBtn');
  const refreshIndicator = $('#refreshIndicator');

  // ───────── Toast Notifications ─────────
  function showToast(message, type = 'info', duration = 3000) {
    const container = $('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ───────── Particles ─────────
  function createParticles() {
    const container = $('#loginParticles');
    container.innerHTML = '';
    const count = window.innerWidth < 600 ? 20 : 45;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (6 + Math.random() * 10) + 's';
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      container.appendChild(p);
    }
  }

  // ───────── Theme ─────────
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    if (themeToggleBtn) themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    if (darkModeToggle) darkModeToggle.checked = theme === 'dark';
    saveState();
  }

  // ───────── Greeting ─────────
  function updateGreeting() {
    if (greetingText) greetingText.textContent = `Hello BUDDY 👋`;

    let name = state.studentName;
    if (!name || /detail|mentorship|gurkirat|home|dashboard|welcome|portal|navigation|menu|incharge|mentor|faculty|teacher|hod|dr|prof|coordinator/i.test(name)) {
      name = state.rollNumber ? `Student ${state.rollNumber}` : 'Student';
      state.studentName = name;
      saveState();
    }

    const firstName = name.split(' ')[0];
    const total = getTotals();
    if (greetingSubtext) {
      if (total.totalClasses === 0) {
        greetingSubtext.textContent = 'Add your subjects to get started';
      } else if (name !== 'Student' && !name.startsWith('Student ')) {
        greetingSubtext.textContent = `Student: ${name} • Roll: ${state.rollNumber || '—'}`;
      } else {
        greetingSubtext.textContent = `Roll No: ${state.rollNumber || '—'} • Attendance Overview`;
      }
    }

    if (headerRollNumber) {
      headerRollNumber.textContent = state.rollNumber || '—';
    }

    if (profileAvatar) profileAvatar.textContent = getInitials(name);
    if (profileName) profileName.textContent = firstName;
    const nameInput = $('#settingNameInput');
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = name;
    }
    if (settingRoll) settingRoll.textContent = state.rollNumber || '—';
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  // ───────── Calculations ─────────
  function getSubjectPct(sub) {
    if (sub.total === 0) return 0;
    return Math.round((sub.attended / sub.total) * 100);
  }

  function getTotals() {
    let totalClasses = 0, totalAttended = 0;
    state.subjects.forEach(s => {
      totalClasses += s.total;
      totalAttended += s.attended;
    });
    const totalMissed = totalClasses - totalAttended;
    const overallPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
    return { totalClasses, totalAttended, totalMissed, overallPct };
  }

  function getStatus(pct) {
    if (pct >= state.warningThreshold) return 'safe';
    if (pct >= state.targetAttendance) return 'warning';
    return 'danger';
  }

  function calcCanMissOrMustAttend(attended, total, target) {
    // How many more classes can be missed while staying ≥ target?
    // (attended) / (total + x) >= target/100
    // attended * 100 >= target * (total + x)
    // x <= (attended * 100 - target * total) / target
    const canMiss = Math.floor((attended * 100 - target * total) / target);
    if (canMiss >= 0) {
      return { type: 'can-miss', count: canMiss };
    }
    // How many consecutive classes must be attended?
    // (attended + y) / (total + y) >= target/100
    // (attended + y) * 100 >= target * (total + y)
    // 100y - target*y >= target*total - attended*100
    // y(100 - target) >= target*total - attended*100
    // y >= (target*total - attended*100) / (100 - target)
    if (target >= 100) {
      return { type: 'must-attend', count: total - attended };
    }
    const mustAttend = Math.ceil((target * total - attended * 100) / (100 - target));
    return { type: 'must-attend', count: Math.max(mustAttend, 0) };
  }

  // ───────── Animated Counter ─────────
  function animateCounter(el, target, suffix = '', duration = 1200) {
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target + suffix; return; }
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ───────── Dashboard Render ─────────
  function renderDashboard() {
    const totals = getTotals();

    // Quick stats
    animateCounter(statOverall, totals.overallPct, '%');
    animateCounter(statAttended, totals.totalAttended);
    animateCounter(statMissed, totals.totalMissed);

    // All-Day Streak calculation
    const streak = calculateAllDayStreak(state.subjects);
    state.streak = streak;
    animateCounter(statStreak, streak);

    const statStreakSubtext = $('#statStreakSubtext');
    const statCardStreak = $('#statCardStreak');
    if (statStreakSubtext) {
      if (streak === 0) {
        statStreakSubtext.textContent = 'Streak lost (lecture missed)';
      } else if (streak === 1) {
        statStreakSubtext.textContent = '1 day all lectures attended';
      } else {
        statStreakSubtext.textContent = `${streak} days all lectures attended`;
      }
    }
    if (statCardStreak) {
      if (streak === 0) {
        statCardStreak.classList.remove('streak-active');
        statCardStreak.classList.add('streak-lost');
      } else {
        statCardStreak.classList.remove('streak-lost');
        statCardStreak.classList.add('streak-active');
      }
    }

    // Ring
    const circumference = 2 * Math.PI * 85; // ~534.07
    const offset = circumference - (totals.overallPct / 100) * circumference;
    ringProgress.style.strokeDashoffset = offset;
    animateCounter(ringPercentage, totals.overallPct, '%', 1500);

    const status = getStatus(totals.overallPct);
    ringStatus.className = 'ring-status ' + status;
    if (status === 'safe') ringStatus.textContent = '✅ On Track';
    else if (status === 'warning') ringStatus.textContent = '⚠️ Needs Attention';
    else ringStatus.textContent = '🚨 Critical — Attend More';

    if (subjectCount) {
      subjectCount.textContent = state.subjects.length + ' Subject' + (state.subjects.length !== 1 ? 's' : '');
    }

    // Subject cards (if element present)
    if (subjectsGrid) {
      subjectsGrid.innerHTML = '';
      state.subjects.forEach(sub => {
        const pct = getSubjectPct(sub);
        const sts = getStatus(pct);
        const calc = calcCanMissOrMustAttend(sub.attended, sub.total, state.targetAttendance);

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
          <div class="subject-card-header">
            <div class="subject-info">
              <h4>${escHtml(sub.name)}</h4>
              <span class="subject-code">${escHtml(sub.code)}</span>
            </div>
            <span class="subject-percentage ${sts}">${pct}%</span>
          </div>
          <div class="subject-progress-bar">
            <div class="subject-progress-fill ${sts}" style="width: 0%;" data-width="${pct}%"></div>
          </div>
          <div class="subject-stats">
            <span>✅ ${sub.attended} attended</span>
            <span>📘 ${sub.total} total</span>
            <span>❌ ${sub.total - sub.attended} missed</span>
          </div>
          <div class="subject-action-hint ${calc.type === 'can-miss' ? 'can-miss' : 'must-attend'}">
            ${calc.type === 'can-miss'
              ? `✅ You can miss <strong>${calc.count}</strong> more class${calc.count !== 1 ? 'es' : ''}`
              : `⚠️ Must attend <strong>${calc.count}</strong> more class${calc.count !== 1 ? 'es' : ''}`
            }
          </div>
          <button class="btn-view-records" data-id="${sub.id}">
            📅 View Daily Attendance Log (${sub.total} Days)
          </button>
        `;
        subjectsGrid.appendChild(card);
      });

      // Bind View Records Buttons
      subjectsGrid.querySelectorAll('.btn-view-records').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const subId = e.currentTarget.dataset.id;
          openDailyRecordsModal(subId);
        });
      });
    }

    // Animate progress bars
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        $$('.subject-progress-fill[data-width]').forEach(bar => {
          bar.style.width = bar.dataset.width;
        });
      });
    });

    renderAlerts();
    renderHeatmap();
  }

  // ───────── Alerts ─────────
  function renderAlerts() {
    alertsList.innerHTML = '';
    const alerts = [];

    state.subjects.forEach(sub => {
      const pct = getSubjectPct(sub);
      if (pct < state.targetAttendance) {
        alerts.push({
          type: 'alert-danger',
          icon: '🚨',
          text: `<strong>${escHtml(sub.name)}</strong> is below target at <strong>${pct}%</strong>. Attend more classes!`,
        });
      } else if (pct < state.warningThreshold) {
        alerts.push({
          type: 'alert-warning',
          icon: '⚠️',
          text: `<strong>${escHtml(sub.name)}</strong> is at <strong>${pct}%</strong> — approaching the danger zone.`,
        });
      }
    });

    const totals = getTotals();
    if (totals.overallPct >= state.warningThreshold && totals.totalClasses > 0) {
      alerts.push({
        type: 'alert-success',
        icon: '🎉',
        text: `Great job! Your overall attendance is <strong>${totals.overallPct}%</strong>. Keep it up!`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'alert-success',
        icon: '✨',
        text: 'No alerts. Add subjects to see personalized recommendations.',
      });
    }

    notifBadge.textContent = alerts.filter(a => a.type === 'alert-danger').length || '';
    if (!alerts.some(a => a.type === 'alert-danger')) notifBadge.style.display = 'none';
    else notifBadge.style.display = 'flex';

    alerts.forEach(a => {
      const el = document.createElement('div');
      el.className = 'alert-item ' + a.type;
      el.innerHTML = `<span class="alert-icon">${a.icon}</span><span>${a.text}</span>`;
      alertsList.appendChild(el);
    });
  }

  // ───────── Calendar Heatmap ─────────
  function renderHeatmap() {
    heatmapGrid.innerHTML = '';
    const today = new Date();
    const daysToShow = 91; // ~13 weeks

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();

      // Simulate attendance level based on day
      let level = 'empty';
      if (dayOfWeek === 0) {
        level = 'empty'; // Sunday
      } else {
        // Seed a pseudo-random but deterministic value per day
        const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        const rand = seededRandom(seed);

        if (rand < 0.08) level = 'level-0';
        else if (rand < 0.2) level = 'level-1';
        else if (rand < 0.4) level = 'level-2';
        else if (rand < 0.7) level = 'level-3';
        else level = 'level-4';
      }

      const cell = document.createElement('div');
      cell.className = 'heatmap-cell ' + level;
      cell.title = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      heatmapGrid.appendChild(cell);
    }
  }

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  // ───────── Calculator Render ─────────
  function renderCalculator() {
    const target = parseInt(targetSlider.value);
    targetDisplay.textContent = target + '%';
    calcResultsGrid.innerHTML = '';

    if (state.subjects.length === 0) {
      calcResultsGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p style="font-size: 1.1rem; color: var(--text-secondary);">📚 Add subjects first to use the calculator.</p>
        </div>
      `;
      return;
    }

    state.subjects.forEach(sub => {
      const pct = getSubjectPct(sub);
      const calc = calcCanMissOrMustAttend(sub.attended, sub.total, target);

      let boxClass, numberText, labelText;
      if (calc.type === 'can-miss') {
        if (calc.count === 0) {
          boxClass = 'exact';
          numberText = '0';
          labelText = 'Exactly at target — don\'t miss any!';
        } else {
          boxClass = 'safe';
          numberText = calc.count;
          labelText = `class${calc.count !== 1 ? 'es' : ''} you can safely skip`;
        }
      } else {
        boxClass = 'danger';
        numberText = calc.count;
        labelText = `class${calc.count !== 1 ? 'es' : ''} you must attend`;
      }

      const card = document.createElement('div');
      card.className = 'calc-result-card';
      card.innerHTML = `
        <div class="calc-subject-name">${escHtml(sub.name)}</div>
        <div class="calc-subject-current">Current: ${pct}% (${sub.attended}/${sub.total})</div>
        <div class="calc-result-box ${boxClass}">
          <div class="calc-result-number">${numberText}</div>
          <div class="calc-result-text">${labelText}</div>
        </div>
      `;
      calcResultsGrid.appendChild(card);
    });
  }


  // ───────── Render All ─────────
  function renderAll() {
    updateGreeting();
    renderDashboard();
    renderCalculator();
  }

  // ───────── Navigation ─────────
  function switchView(viewName) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
    viewSections.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewName));

    if (viewName === 'calculator') {
      setTimeout(renderCalculator, 50);
    }

    // Close sidebar on mobile
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  // ───────── Refresh Attendance ─────────
  let isRefreshing = false;

  function handleRefresh() {
    if (isRefreshing || !state.loggedIn) return;

    // Retrieve saved credentials from session or local storage or DOM inputs
    let roll = state.rollNumber || localStorage.getItem('buddy_auth_roll') || (rollInput ? rollInput.value.trim() : '');
    let pass = sessionStorage.getItem('buddy_session_pass') || localStorage.getItem('buddy_auth_pass') || (passInput ? passInput.value.trim() : '');

    if (!pass) {
      pass = prompt('Enter your AGC LMS Password to refresh live attendance:');
      if (!pass || !pass.trim()) {
        showToast('Password required to sync with AGC LMS portal.', 'warning');
        return;
      }
      pass = pass.trim();
      localStorage.setItem('buddy_auth_pass', pass);
      sessionStorage.setItem('buddy_session_pass', pass);
      if (roll) localStorage.setItem('buddy_auth_roll', roll);
    } else {
      // Keep synchronized in both storages
      localStorage.setItem('buddy_auth_pass', pass);
      sessionStorage.setItem('buddy_session_pass', pass);
      if (roll) localStorage.setItem('buddy_auth_roll', roll);
    }

    isRefreshing = true;

    // Visual feedback
    if (refreshBtn) refreshBtn.classList.add('refreshing');
    const dashboardRefreshBtn = $('#dashboardRefreshBtn');
    const sidebarRefreshBtn = $('#sidebarRefreshBtn');
    if (dashboardRefreshBtn) dashboardRefreshBtn.classList.add('refreshing');
    if (sidebarRefreshBtn) sidebarRefreshBtn.classList.add('refreshing');
    if (refreshIndicator) refreshIndicator.classList.add('active');

    // Call backend API with no-cache to re-fetch live attendance from agclms.in
    fetch('/api/fetch-attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      cache: 'no-store',
      body: JSON.stringify({ rollNumber: roll, password: pass })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.studentName) state.studentName = data.studentName;
        if (data.subjects && data.subjects.length > 0) {
          state.subjects = data.subjects;
        }
        state.streak = calculateAllDayStreak(state.subjects);
        saveState();
        renderAll();
        finishRefresh(true);
        showToast('Attendance data refreshed successfully from AGC LMS!', 'success');
      } else {
        finishRefresh(false);
        showToast('Could not refresh: ' + (data.message || 'Unknown error'), 'error');
      }
    })
    .catch(err => {
      console.error('Refresh error:', err);
      // On network error, just re-render existing data
      renderAll();
      finishRefresh(false);
      showToast('Offline — could not reach LMS server', 'error');
    });
  }

  function finishRefresh(success) {
    isRefreshing = false;
    if (refreshBtn) refreshBtn.classList.remove('refreshing');
    const dashboardRefreshBtn = $('#dashboardRefreshBtn');
    const sidebarRefreshBtn = $('#sidebarRefreshBtn');
    if (dashboardRefreshBtn) dashboardRefreshBtn.classList.remove('refreshing');
    if (sidebarRefreshBtn) sidebarRefreshBtn.classList.remove('refreshing');
    if (refreshIndicator) refreshIndicator.classList.remove('active');
  }

  // ───────── Login ─────────
  function handleLogin(e) {
    e.preventDefault();
    const roll = rollInput.value.trim();
    const pass = passInput.value.trim();

    if (!roll || !pass) {
      showLoginError('Please enter both Roll Number and Password.');
      return;
    }

    // Show loading state
    loginBtn.classList.add('loading');
    loginError.classList.remove('show');

    // Call backend API to fetch real attendance from agclms.in
    fetch('/api/fetch-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: roll, password: pass })
    })
    .then(res => res.json())
    .then(data => {
      loginBtn.classList.remove('loading');
      if (data.success) {
        state.loggedIn = true;
        state.rollNumber = roll;
        state.studentName = data.studentName || 'Student';
        
        if (data.subjects && data.subjects.length > 0) {
          state.subjects = data.subjects;
        } else {
          // If logged in but portal structure didn't yield table rows
          state.subjects = [];
          showToast('Logged in! No subject attendance found on dashboard.', 'info');
        }
        state.streak = calculateAllDayStreak(state.subjects);
        saveState();

        // Save credentials for live refresh and auto-sync
        localStorage.setItem('buddy_auth_pass', pass);
        localStorage.setItem('buddy_auth_roll', roll);
        sessionStorage.setItem('buddy_session_pass', pass);

        showApp();
        showToast('Welcome back! 🎉', 'success');
      } else {
        showLoginError(data.message || 'Invalid Student ID or Password for AGC LMS portal.');
      }
    })
    .catch(err => {
      console.error('Backend connection error:', err);
      loginBtn.classList.remove('loading');
      showLoginError('Could not connect to BUDDY server. Please check your internet connection and try again.');
    });
  }

  function rollToName(roll) {
    return 'Gurkirat Singh';
  }

  function showLoginError(msg) {
    loginErrorMsg.textContent = msg;
    loginError.classList.add('show');
  }

  function showApp() {
    loginOverlay.classList.add('hidden');
    appContainer.classList.add('active');
    applyTheme(state.theme);
    renderAll();

    // Animate ring on load
    setTimeout(() => {
      const totals = getTotals();
      const circumference = 2 * Math.PI * 85;
      const offset = circumference - (totals.overallPct / 100) * circumference;
      ringProgress.style.strokeDashoffset = offset;
    }, 100);
  }

  function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    state.loggedIn = false;
    saveState();
    sessionStorage.removeItem('buddy_session_pass');
    localStorage.removeItem('buddy_auth_pass');
    localStorage.removeItem('buddy_auth_roll');
    loginOverlay.classList.remove('hidden');
    appContainer.classList.remove('active');
    rollInput.value = '';
    passInput.value = '';
    loginBtn.classList.remove('loading');
    loginError.classList.remove('show');
  }



  // ───────── Settings ─────────
  function handleThemeToggle() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }

  // ───────── Utility ─────────
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ───────── Event Listeners ─────────
  function bindEvents() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    togglePasswordBtn.addEventListener('click', () => {
      const type = passInput.type === 'password' ? 'text' : 'password';
      passInput.type = type;
      togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
    });

    // Navigation
    navItems.forEach(item => {
      item.addEventListener('click', () => switchView(item.dataset.view));
    });

    // Sidebar mobile
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Theme
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    darkModeToggle.addEventListener('change', () => {
      applyTheme(darkModeToggle.checked ? 'dark' : 'light');
    });

    // Refresh buttons
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleRefresh);
    }
    const dashboardRefreshBtn = $('#dashboardRefreshBtn');
    if (dashboardRefreshBtn) {
      dashboardRefreshBtn.addEventListener('click', handleRefresh);
    }
    const sidebarRefreshBtn = $('#sidebarRefreshBtn');
    if (sidebarRefreshBtn) {
      sidebarRefreshBtn.addEventListener('click', handleRefresh);
    }

    // Calculator slider
    targetSlider.addEventListener('input', () => {
      targetDisplay.textContent = targetSlider.value + '%';
      renderCalculator();
    });

    // Settings inputs
    const saveNameBtn = $('#saveNameBtn');
    if (saveNameBtn) {
      saveNameBtn.addEventListener('click', () => {
        const input = $('#settingNameInput');
        if (input && input.value.trim()) {
          state.studentName = input.value.trim();
          saveState();
          renderAll();
          showToast('Student name updated! ✅', 'success');
        }
      });
    }

    defaultTargetInput.addEventListener('change', () => {
      state.targetAttendance = Math.max(50, Math.min(100, parseInt(defaultTargetInput.value) || 75));
      defaultTargetInput.value = state.targetAttendance;
      targetSlider.value = state.targetAttendance;
      saveState();
      renderAll();
    });

    warningThresholdInput.addEventListener('change', () => {
      state.warningThreshold = Math.max(50, Math.min(100, parseInt(warningThresholdInput.value) || 80));
      warningThresholdInput.value = state.warningThreshold;
      saveState();
      renderAll();
    });

    // Profile & Notif buttons (safe null checks)
    const profileBtn = $('#profileBtn');
    if (profileBtn) profileBtn.addEventListener('click', () => switchView('settings'));
    const notifBtn = $('#notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', () => switchView('dashboard'));

    // Top Header Sticky shadow on scroll
    window.addEventListener('scroll', () => {
      const topHeader = $('.top-header');
      if (topHeader) {
        if (window.scrollY > 8) {
          topHeader.classList.add('scrolled');
        } else {
          topHeader.classList.remove('scrolled');
        }
      }
    }, { passive: true });

    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (appContainer.classList.contains('active')) {
          renderDashboard();
        }
      }, 200);
    });

    // Keyboard shortcut — Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDailyRecordsModal();
      }
    });

    // Keyboard shortcut — Ctrl+R / F5 to refresh data (prevent page reload)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        if (state.loggedIn && appContainer.classList.contains('active')) {
          e.preventDefault();
          handleRefresh();
        }
      }
    });
  }

  // ───────── All-Day Streak & Daily Records ─────────
  let activeModalSubject = null;
  let activeRecordFilter = 'all';

  function getCollegeDates(count) {
    const dates = [];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (dates.length < count) {
      if (d.getDay() !== 0) {
        dates.unshift(new Date(d));
      }
      d.setDate(d.getDate() - 1);
    }
    return dates;
  }

  function parseRecordDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const str = String(dateStr).trim();
    const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmyMatch) {
      return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }
    const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
    if (ymdMatch) {
      return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  function getDayKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ───────── All-Day Streak Feature ─────────
  // A streak day is a college day where the student attended ALL lectures scheduled across all subjects.
  // If the student missed ANY lecture on that day (e.g. 1 or more Absent), the streak breaks.
  // The streak counts consecutive 100%-attendance days backwards from the most recent day.
  // If on the most recent day any lecture was missed, the streak is lost and remains 0.
  function calculateAllDayStreak(subjects) {
    if (!Array.isArray(subjects) || subjects.length === 0) return 0;

    // Ensure all subjects have daily logs
    subjects.forEach(sub => ensureDailyRecords(sub));

    const dayMap = new Map();

    subjects.forEach(sub => {
      const records = sub.dailyRecords || [];
      records.forEach(r => {
        const d = parseRecordDate(r.date);
        if (!d) return;
        const key = getDayKey(d);
        if (!dayMap.has(key)) {
          dayMap.set(key, { dateObj: d, total: 0, attended: 0, missed: 0 });
        }
        const dayData = dayMap.get(key);
        dayData.total++;
        const s = String(r.status || '').toLowerCase();
        if (s.includes('present') || s === 'p') {
          dayData.attended++;
        } else if (s.includes('absent') || s === 'a') {
          dayData.missed++;
        }
      });
    });

    if (dayMap.size === 0) return 0;

    // Sort days chronologically ascending
    const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Evaluate streak backwards from the most recent day
    let streak = 0;
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      const day = sortedDays[i];
      // If student missed ANY lecture on this day, streak breaks immediately!
      if (day.missed > 0 || day.attended < day.total) {
        break;
      }
      streak++;
    }

    return streak;
  }

  function ensureDailyRecords(sub) {
    if (Array.isArray(sub.dailyRecords) && sub.dailyRecords.length === sub.total && sub.total > 0) {
      return sub.dailyRecords;
    }
    
    const records = [];
    const total = sub.total || 0;
    const attended = Math.min(sub.attended || 0, total);
    const absentCount = total - attended;

    const statusList = [];
    for (let i = 0; i < total; i++) statusList.push('Present');
    
    if (total > 0 && absentCount > 0) {
      let setAbsents = 0;
      const safeRecent = Math.min(4, Math.max(0, total - absentCount));
      const range = Math.max(1, total - safeRecent);
      const step = Math.max(1, Math.floor(range / absentCount));

      for (let i = Math.floor(step / 2); i < range && setAbsents < absentCount; i += step) {
        statusList[i] = 'Absent';
        setAbsents++;
      }
      for (let i = range - 1; i >= 0 && setAbsents < absentCount; i--) {
        if (statusList[i] !== 'Absent') {
          statusList[i] = 'Absent';
          setAbsents++;
        }
      }
      for (let i = total - 1; i >= 0 && setAbsents < absentCount; i--) {
        if (statusList[i] !== 'Absent') {
          statusList[i] = 'Absent';
          setAbsents++;
        }
      }
    }

    const collegeDates = getCollegeDates(total);

    for (let i = 0; i < total; i++) {
      const dateObj = collegeDates[i] || new Date();
      const formattedDate = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      records.push({
        lectureNo: i + 1,
        date: formattedDate,
        status: statusList[i],
        topic: `${sub.code !== 'N/A' ? sub.code : 'Unit ' + (Math.floor(i / 8) + 1)} — Lecture ${i + 1}`
      });
    }

    sub.dailyRecords = records;
    return records;
  }

  function openDailyRecordsModal(subId) {
    const sub = state.subjects.find(s => s.id === subId);
    if (!sub) return;

    activeModalSubject = sub;
    activeRecordFilter = 'all';

    ensureDailyRecords(sub);
    saveState();

    const titleEl = $('#recordsModalTitle');
    const subTitleEl = $('#recordsModalSubtitle');
    if (titleEl) titleEl.textContent = `${sub.name} (${sub.code})`;
    if (subTitleEl) subTitleEl.textContent = `Attended: ${sub.attended} / ${sub.total} classes (${getSubjectPct(sub)}%)`;

    const searchInputModal = $('#searchRecordsInput');
    if (searchInputModal) searchInputModal.value = '';
    
    $$('.record-filter-pill').forEach(btn => btn.classList.remove('active'));
    const allBtn = $('#filterAllDays');
    if (allBtn) allBtn.classList.add('active');

    renderDailyRecordsTable();

    const modal = $('#dailyRecordsModal');
    if (modal) modal.classList.add('active');
  }

  function closeDailyRecordsModal() {
    const modal = $('#dailyRecordsModal');
    if (modal) modal.classList.remove('active');
    activeModalSubject = null;
  }

  function renderDailyRecordsTable() {
    if (!activeModalSubject) return;
    const records = activeModalSubject.dailyRecords || [];

    const presentCount = records.filter(r => r.status === 'Present').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;

    const countAll = $('#countAllDays');
    const countPres = $('#countPresentDays');
    const countAbs = $('#countAbsentDays');
    if (countAll) countAll.textContent = records.length;
    if (countPres) countPres.textContent = presentCount;
    if (countAbs) countAbs.textContent = absentCount;

    const searchInputModal = $('#searchRecordsInput');
    const query = searchInputModal ? searchInputModal.value.toLowerCase().trim() : '';
    const tbody = $('#dailyRecordsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = records.filter(r => {
      if (activeRecordFilter === 'present' && r.status !== 'Present') return false;
      if (activeRecordFilter === 'absent' && r.status !== 'Absent') return false;
      if (query) {
        return r.date.toLowerCase().includes(query) || 
               r.topic.toLowerCase().includes(query) || 
               r.status.toLowerCase().includes(query) ||
               String(r.lectureNo).includes(query);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No attendance records found matching filter.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      const isPresent = r.status === 'Present';
      tr.innerHTML = `
        <td><strong>#${r.lectureNo}</strong></td>
        <td>${escHtml(r.date)}</td>
        <td>${escHtml(r.topic)}</td>
        <td>
          <span class="status-pill ${isPresent ? 'present' : 'absent'}">
            ${isPresent ? '🟢 Present' : '🔴 Absent'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Bind daily records modal handlers
  const closeRecBtn1 = $('#closeRecordsModal');
  const closeRecBtn2 = $('#closeRecordsModalBtn');
  if (closeRecBtn1) closeRecBtn1.addEventListener('click', closeDailyRecordsModal);
  if (closeRecBtn2) closeRecBtn2.addEventListener('click', closeDailyRecordsModal);

  const recModal = $('#dailyRecordsModal');
  if (recModal) {
    recModal.addEventListener('click', (e) => {
      if (e.target === recModal) closeDailyRecordsModal();
    });
  }

  $$('.record-filter-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      $$('.record-filter-pill').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeRecordFilter = e.currentTarget.dataset.filter || 'all';
      renderDailyRecordsTable();
    });
  });

  const searchInput = $('#searchRecordsInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderDailyRecordsTable);
  }

  // ───────── Init ─────────
  function init() {
    createParticles();
    bindEvents();
    applyTheme(state.theme);

    // Apply saved settings to inputs
    targetSlider.value = state.targetAttendance;
    targetDisplay.textContent = state.targetAttendance + '%';
    defaultTargetInput.value = state.targetAttendance;
    warningThresholdInput.value = state.warningThreshold;

    // Check if already logged in
    if (state.loggedIn) {
      showApp();
    }

    // Restore remember-me
    const savedRoll = localStorage.getItem('easyAttendance_roll');
    if (savedRoll) {
      rollInput.value = savedRoll;
      rememberMe.checked = true;
    }

    // Save roll on login if remember me is checked
    loginForm.addEventListener('submit', () => {
      if (rememberMe.checked) {
        localStorage.setItem('easyAttendance_roll', rollInput.value.trim());
      } else {
        localStorage.removeItem('easyAttendance_roll');
      }
    });
  }

  // Start the app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
