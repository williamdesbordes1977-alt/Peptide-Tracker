/* ============================================
   69-Week Peptide Program Tracker - Application
   ============================================ */

(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'peptideTracker';
  const TOTAL_WEEKS = 69;

  const PHASES = [
    { name: 'Titration', startWeek: 1, endWeek: 12, cssClass: 'titration', color: '#8b5cf6' },
    { name: 'Maintenance', startWeek: 13, endWeek: 56, cssClass: 'maintenance', color: '#3b82f6' },
    { name: 'Taper', startWeek: 57, endWeek: 69, cssClass: 'taper', color: '#06b6d4' },
  ];

  const INJECTION_SITES = [
    'Abdomen L', 'Abdomen R',
    'Thigh L', 'Thigh R',
    'Upper Arm L', 'Upper Arm R',
    'Glute L', 'Glute R',
  ];

  const SIDE_EFFECTS = [
    'Nausea', 'Headache', 'Fatigue', 'Dizziness',
    'Injection Site Reaction', 'Appetite Loss', 'Constipation', 'Other',
  ];

  // ---- Default State ----
  function getDefaultState() {
    return {
      initialized: false,
      program: {
        name: '69-Week Peptide Program',
        peptideName: '',
        startDate: '',
        doseUnit: 'mg',
        weightUnit: 'lbs',
        notes: '',
      },
      entries: [],
      currentView: 'dashboard',
    };
  }

  // ---- State Management ----
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...getDefaultState(), ...saved };
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return getDefaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  // ---- Utility Functions ----
  function getWeekNumber(date) {
    if (!state.program.startDate) return null;
    const start = new Date(state.program.startDate + 'T00:00:00');
    const d = new Date(date + 'T00:00:00');
    const diffMs = d - start;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  function getCurrentWeek() {
    if (!state.program.startDate) return 0;
    const today = new Date().toISOString().split('T')[0];
    return getWeekNumber(today);
  }

  function getPhaseForWeek(week) {
    return PHASES.find(p => week >= p.startWeek && week <= p.endWeek) || null;
  }

  function getWeekDateRange(weekNum) {
    if (!state.program.startDate) return { start: '', end: '' };
    const startDate = new Date(state.program.startDate + 'T00:00:00');
    const weekStart = new Date(startDate.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    return {
      start: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }

  function getEntriesForWeek(weekNum) {
    return state.entries.filter(e => getWeekNumber(e.date) === weekNum);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Navigation ----
  function setView(viewName) {
    state.currentView = viewName;
    saveState();
    render();
    updateNav();
  }

  function updateNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === state.currentView);
    });
  }

  // ---- Update Header Badge ----
  function updateHeader() {
    const badge = document.getElementById('currentWeekBadge');
    const week = getCurrentWeek();
    if (!state.program.startDate || week <= 0) {
      badge.textContent = 'Not Started';
    } else if (week > TOTAL_WEEKS) {
      badge.textContent = 'Complete!';
    } else {
      badge.textContent = `Week ${week} / ${TOTAL_WEEKS}`;
    }
  }

  // ---- Render Router ----
  function render() {
    updateHeader();
    const main = document.getElementById('mainContent');

    if (!state.initialized) {
      main.innerHTML = renderSetup();
      bindSetupEvents();
      return;
    }

    switch (state.currentView) {
      case 'dashboard': main.innerHTML = renderDashboard(); bindDashboardEvents(); break;
      case 'schedule': main.innerHTML = renderSchedule(); bindScheduleEvents(); break;
      case 'log': main.innerHTML = renderLog(); bindLogEvents(); break;
      case 'metrics': main.innerHTML = renderMetrics(); break;
      case 'settings': main.innerHTML = renderSettings(); bindSettingsEvents(); break;
      default: main.innerHTML = renderDashboard(); bindDashboardEvents();
    }
  }

  // ---- Setup View ----
  function renderSetup() {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div class="setup-screen fade-in">
        <div class="text-center mb-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2 class="setup-title">Welcome to Your 69-Week Peptide Tracker</h2>
        <p class="setup-subtitle">Set up your program to get started with dose logging, progress tracking, and more.</p>

        <div class="card">
          <div class="form-group">
            <label class="form-label">Peptide Name</label>
            <input type="text" class="form-input" id="setupPeptide" placeholder="e.g., BPC-157, Tirzepatide, Semaglutide">
          </div>
          <div class="form-group">
            <label class="form-label">Program Start Date</label>
            <input type="date" class="form-input" id="setupStartDate" value="${today}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Dose Unit</label>
              <select class="form-select" id="setupDoseUnit">
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="units">units</option>
                <option value="mL">mL</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Weight Unit</label>
              <select class="form-select" id="setupWeightUnit">
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <textarea class="form-textarea" id="setupNotes" placeholder="Any notes about your program..."></textarea>
          </div>
          <button class="btn btn-primary mt-8" id="setupSubmit">Start Tracking</button>
        </div>

        <div class="card mt-16">
          <p class="card-title">Program Phases</p>
          <div class="mt-8">
            ${PHASES.map(p => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span class="phase-dot" style="background:${p.color};"></span>
                <span style="font-size:0.875rem;">${p.name}</span>
                <span class="text-muted" style="font-size:0.75rem;margin-left:auto;">Weeks ${p.startWeek}–${p.endWeek}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
  }

  function bindSetupEvents() {
    document.getElementById('setupSubmit')?.addEventListener('click', () => {
      const peptide = document.getElementById('setupPeptide').value.trim();
      const startDate = document.getElementById('setupStartDate').value;
      const doseUnit = document.getElementById('setupDoseUnit').value;
      const weightUnit = document.getElementById('setupWeightUnit').value;
      const notes = document.getElementById('setupNotes').value.trim();

      if (!startDate) {
        alert('Please select a start date.');
        return;
      }

      state.program.peptideName = peptide;
      state.program.startDate = startDate;
      state.program.doseUnit = doseUnit;
      state.program.weightUnit = weightUnit;
      state.program.notes = notes;
      state.initialized = true;
      state.currentView = 'dashboard';
      saveState();
      render();
    });
  }

  // ---- Dashboard View ----
  function renderDashboard() {
    const week = getCurrentWeek();
    const phase = getPhaseForWeek(week);
    const totalEntries = state.entries.length;
    const thisWeekEntries = getEntriesForWeek(week);
    const weeksWithEntries = new Set(state.entries.map(e => getWeekNumber(e.date))).size;
    const progress = Math.min(100, Math.max(0, ((week - 1) / TOTAL_WEEKS) * 100));

    const latestWeight = [...state.entries].reverse().find(e => e.weight);
    const firstWeight = state.entries.find(e => e.weight);
    let weightChange = '';
    if (latestWeight && firstWeight && latestWeight !== firstWeight) {
      const diff = (latestWeight.weight - firstWeight.weight).toFixed(1);
      const sign = diff > 0 ? '+' : '';
      weightChange = `${sign}${diff} ${state.program.weightUnit}`;
    }

    const recentEntries = [...state.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return `
      <div class="fade-in">
        <!-- Progress Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Program Progress</span>
            <span class="text-muted" style="font-size:0.75rem;">${progress.toFixed(0)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill overall" style="width:${progress}%"></div>
          </div>
          <div class="phase-timeline mt-8">
            ${PHASES.map(p => {
              const width = ((p.endWeek - p.startWeek + 1) / TOTAL_WEEKS) * 100;
              let cls = '';
              if (week >= p.startWeek && week <= p.endWeek) cls = 'active';
              else if (week > p.endWeek) cls = 'completed';
              return `<div class="phase-segment ${cls}" style="flex:${width};background:${p.color};"></div>`;
            }).join('')}
          </div>
          <div class="phase-label">
            ${PHASES.map(p => `<span>${p.name}</span>`).join('')}
          </div>
        </div>

        <!-- Current Status -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Current Status</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            ${phase ? `<span class="phase-dot" style="background:${phase.color};width:12px;height:12px;"></span>` : ''}
            <div>
              <div style="font-size:1.125rem;font-weight:700;">
                ${week > 0 && week <= TOTAL_WEEKS ? `Week ${week}` : week > TOTAL_WEEKS ? 'Program Complete' : 'Not Started'}
              </div>
              <div class="text-muted" style="font-size:0.8125rem;">
                ${phase ? `${phase.name} Phase` : week > TOTAL_WEEKS ? 'Congratulations!' : 'Configure start date'}
                ${week > 0 && week <= TOTAL_WEEKS ? ` &middot; ${getWeekDateRange(week).start} – ${getWeekDateRange(week).end}` : ''}
              </div>
            </div>
          </div>
          <div class="text-muted" style="font-size:0.8125rem;">
            ${thisWeekEntries.length > 0
              ? `${thisWeekEntries.length} log${thisWeekEntries.length > 1 ? 's' : ''} this week`
              : 'No logs this week yet'}
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${totalEntries}</div>
            <div class="stat-label">Total Logs</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${weeksWithEntries}</div>
            <div class="stat-label">Weeks Logged</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${latestWeight ? latestWeight.weight : '—'}</div>
            <div class="stat-label">Latest Weight (${state.program.weightUnit})</div>
          </div>
          <div class="stat-item">
            <div class="stat-value ${weightChange.startsWith('-') ? 'text-success' : weightChange.startsWith('+') ? 'text-warning' : ''}">${weightChange || '—'}</div>
            <div class="stat-label">Weight Change</div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card mt-12">
          <div class="card-header">
            <span class="card-title">Recent Activity</span>
            ${recentEntries.length > 0 ? `<button class="btn btn-sm btn-secondary" id="viewAllLogs">View All</button>` : ''}
          </div>
          ${recentEntries.length > 0 ? `
            <ul class="entry-list">
              ${recentEntries.map(e => renderEntryItem(e)).join('')}
            </ul>
          ` : `
            <div class="empty-state">
              <p>No entries yet. Tap "Log" to add your first dose.</p>
            </div>
          `}
        </div>
      </div>`;
  }

  function renderEntryItem(entry) {
    const week = getWeekNumber(entry.date);
    const phase = getPhaseForWeek(week);
    return `
      <li class="entry-item" data-id="${entry.id}">
        <div class="entry-header">
          <span class="entry-date">${formatDate(entry.date)}</span>
          <span class="entry-dose">${entry.dose} ${state.program.doseUnit}</span>
        </div>
        <div class="entry-details">
          ${phase ? `<span class="entry-tag"><span class="phase-dot" style="background:${phase.color};width:6px;height:6px;display:inline-block;border-radius:50%;"></span> Wk ${week}</span>` : ''}
          ${entry.injectionSite ? `<span class="entry-tag">${escapeHtml(entry.injectionSite)}</span>` : ''}
          ${entry.sideEffects && entry.sideEffects.length > 0 ? `<span class="entry-tag text-warning">${entry.sideEffects.length} side effect${entry.sideEffects.length > 1 ? 's' : ''}</span>` : ''}
          ${entry.weight ? `<span class="entry-tag">${entry.weight} ${state.program.weightUnit}</span>` : ''}
        </div>
      </li>`;
  }

  function bindDashboardEvents() {
    document.getElementById('viewAllLogs')?.addEventListener('click', () => setView('log'));
    document.querySelectorAll('.entry-item').forEach(el => {
      el.addEventListener('click', () => showEntryDetail(el.dataset.id));
    });
  }

  // ---- Schedule View ----
  function renderSchedule() {
    const currentWeek = getCurrentWeek();
    const weeksWithEntries = new Set(state.entries.map(e => getWeekNumber(e.date)));

    return `
      <div class="fade-in">
        <div class="section-header">
          <h2 class="section-title">69-Week Schedule</h2>
        </div>

        <div class="schedule-phases mb-16">
          ${PHASES.map(p => `
            <div class="phase-chip">
              <span class="phase-dot" style="background:${p.color};"></span>
              ${p.name} (Wk ${p.startWeek}–${p.endWeek})
            </div>
          `).join('')}
        </div>

        <div class="week-grid">
          ${Array.from({ length: TOTAL_WEEKS }, (_, i) => {
            const w = i + 1;
            const phase = getPhaseForWeek(w);
            const isCurrent = w === currentWeek;
            const isFuture = w > currentWeek;
            const hasEntries = weeksWithEntries.has(w);
            const entries = getEntriesForWeek(w);
            const classes = [
              'week-cell',
              phase ? `phase-${phase.cssClass}` : '',
              isCurrent ? 'current' : '',
              isFuture ? 'future' : '',
              hasEntries ? 'has-entries' : '',
            ].filter(Boolean).join(' ');

            return `<div class="${classes}" data-week="${w}" title="Week ${w}: ${phase ? phase.name : ''} ${hasEntries ? `(${entries.length} log${entries.length > 1 ? 's' : ''})` : ''}">
              <span class="week-num">${w}</span>
              ${hasEntries ? `<span class="week-status">${entries.length}x</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function bindScheduleEvents() {
    document.querySelectorAll('.week-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const weekNum = parseInt(cell.dataset.week);
        showWeekDetail(weekNum);
      });
    });
  }

  // ---- Log View ----
  function renderLog() {
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getCurrentWeek();

    // Site usage counts for rotation helper
    const siteCounts = {};
    INJECTION_SITES.forEach(s => { siteCounts[s] = 0; });
    state.entries.forEach(e => {
      if (e.injectionSite && siteCounts[e.injectionSite] !== undefined) {
        siteCounts[e.injectionSite]++;
      }
    });

    // Find least used site
    const minCount = Math.min(...Object.values(siteCounts));

    return `
      <div class="fade-in">
        <div class="section-header">
          <h2 class="section-title">Log Entry</h2>
          <span class="text-muted" style="font-size:0.8125rem;">Week ${currentWeek > 0 ? currentWeek : '—'}</span>
        </div>

        <div class="card">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="logDate" value="${today}">
            </div>
            <div class="form-group">
              <label class="form-label">Dose (${escapeHtml(state.program.doseUnit)})</label>
              <input type="number" class="form-input" id="logDose" step="any" placeholder="0.0" min="0">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Injection Site</label>
            <div class="site-grid" id="siteGrid">
              ${INJECTION_SITES.map(site => `
                <button class="site-btn" data-site="${site}">
                  ${site}
                  <span class="site-count">${siteCounts[site]}x${siteCounts[site] === minCount ? ' ★' : ''}</span>
                </button>
              `).join('')}
            </div>
            <div class="form-hint">★ = least used (recommended for rotation)</div>
          </div>

          <div class="form-group">
            <label class="form-label">Side Effects</label>
            <div class="chip-group" id="sideEffectsGroup">
              ${SIDE_EFFECTS.map(se => `
                <button class="chip" data-effect="${se}">${se}</button>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Weight (${escapeHtml(state.program.weightUnit)})</label>
              <input type="number" class="form-input" id="logWeight" step="any" placeholder="Optional" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Time of Day</label>
              <select class="form-select" id="logTimeOfDay">
                <option value="">-- Select --</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="logNotes" placeholder="How are you feeling? Any observations..."></textarea>
          </div>

          <button class="btn btn-primary" id="logSubmit">Save Entry</button>
        </div>

        <!-- Entry History -->
        <div class="section-header mt-16">
          <h2 class="section-title" style="font-size:1rem;">Entry History</h2>
          <span class="text-muted" style="font-size:0.75rem;">${state.entries.length} total</span>
        </div>
        ${state.entries.length > 0 ? `
          <ul class="entry-list" id="entryHistory">
            ${[...state.entries].sort((a, b) => b.date.localeCompare(a.date)).map(e => renderEntryItem(e)).join('')}
          </ul>
        ` : `
          <div class="empty-state">
            <p>No entries yet. Fill out the form above to log your first dose.</p>
          </div>
        `}
      </div>`;
  }

  function bindLogEvents() {
    let selectedSite = '';
    let selectedEffects = new Set();

    // Site selection
    document.querySelectorAll('.site-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.site-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSite = btn.dataset.site;
      });
    });

    // Side effects
    document.querySelectorAll('.chip[data-effect]').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        const effect = chip.dataset.effect;
        if (selectedEffects.has(effect)) selectedEffects.delete(effect);
        else selectedEffects.add(effect);
      });
    });

    // Submit
    document.getElementById('logSubmit')?.addEventListener('click', () => {
      const date = document.getElementById('logDate').value;
      const dose = parseFloat(document.getElementById('logDose').value);
      const weight = parseFloat(document.getElementById('logWeight').value) || null;
      const timeOfDay = document.getElementById('logTimeOfDay').value;
      const notes = document.getElementById('logNotes').value.trim();

      if (!date) { alert('Please select a date.'); return; }
      if (isNaN(dose) || dose <= 0) { alert('Please enter a valid dose.'); return; }

      const entry = {
        id: generateId(),
        date,
        dose,
        injectionSite: selectedSite,
        sideEffects: [...selectedEffects],
        weight,
        timeOfDay,
        notes,
        createdAt: new Date().toISOString(),
      };

      state.entries.push(entry);
      saveState();
      setView('log');
    });

    // Entry click to view detail
    document.querySelectorAll('#entryHistory .entry-item').forEach(el => {
      el.addEventListener('click', () => showEntryDetail(el.dataset.id));
    });
  }

  // ---- Metrics View ----
  function renderMetrics() {
    const sortedEntries = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
    const weightEntries = sortedEntries.filter(e => e.weight);
    const doseEntries = sortedEntries.filter(e => e.dose);

    // Side effect frequency
    const effectCounts = {};
    state.entries.forEach(e => {
      (e.sideEffects || []).forEach(se => {
        effectCounts[se] = (effectCounts[se] || 0) + 1;
      });
    });
    const effectsList = Object.entries(effectCounts).sort((a, b) => b[1] - a[1]);

    // Injection site distribution
    const siteCounts = {};
    state.entries.forEach(e => {
      if (e.injectionSite) {
        siteCounts[e.injectionSite] = (siteCounts[e.injectionSite] || 0) + 1;
      }
    });

    return `
      <div class="fade-in">
        <div class="section-header">
          <h2 class="section-title">Metrics</h2>
        </div>

        <!-- Weight Chart -->
        <div class="metric-chart">
          <div class="card-title mb-12">Weight Over Time (${escapeHtml(state.program.weightUnit)})</div>
          ${weightEntries.length >= 2 ? renderLineChart(weightEntries.map(e => ({ x: e.date, y: e.weight })), 'var(--accent)') : `
            <div class="empty-state"><p>Need at least 2 weight entries to show chart.</p></div>
          `}
          ${weightEntries.length >= 2 ? `
            <div class="metric-summary">
              <div class="metric-summary-item">
                <div class="metric-summary-value">${weightEntries[0].weight}</div>
                <div class="metric-summary-label">Starting</div>
              </div>
              <div class="metric-summary-item">
                <div class="metric-summary-value">${weightEntries[weightEntries.length - 1].weight}</div>
                <div class="metric-summary-label">Current</div>
              </div>
              <div class="metric-summary-item">
                <div class="metric-summary-value ${(weightEntries[weightEntries.length - 1].weight - weightEntries[0].weight) < 0 ? 'text-success' : 'text-warning'}">
                  ${(weightEntries[weightEntries.length - 1].weight - weightEntries[0].weight).toFixed(1)}
                </div>
                <div class="metric-summary-label">Change</div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Dose Chart -->
        <div class="metric-chart">
          <div class="card-title mb-12">Dose Over Time (${escapeHtml(state.program.doseUnit)})</div>
          ${doseEntries.length >= 2 ? renderLineChart(doseEntries.map(e => ({ x: e.date, y: e.dose })), 'var(--phase-titration)') : `
            <div class="empty-state"><p>Need at least 2 dose entries to show chart.</p></div>
          `}
        </div>

        <!-- Side Effects -->
        <div class="card">
          <div class="card-title mb-12">Side Effects Frequency</div>
          ${effectsList.length > 0 ? `
            ${effectsList.map(([name, count]) => {
              const pct = (count / state.entries.length) * 100;
              return `
                <div style="margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:4px;">
                    <span>${escapeHtml(name)}</span>
                    <span class="text-muted">${count}x (${pct.toFixed(0)}%)</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%;background:var(--warning);"></div>
                  </div>
                </div>`;
            }).join('')}
          ` : `<div class="empty-state"><p>No side effects recorded.</p></div>`}
        </div>

        <!-- Injection Site Distribution -->
        <div class="card">
          <div class="card-title mb-12">Injection Site Rotation</div>
          ${Object.keys(siteCounts).length > 0 ? `
            <div class="site-grid">
              ${INJECTION_SITES.map(site => {
                const count = siteCounts[site] || 0;
                const maxCount = Math.max(...Object.values(siteCounts), 1);
                const pct = (count / maxCount) * 100;
                return `
                  <div style="text-align:center;padding:8px;background:var(--bg-input);border-radius:var(--radius-sm);">
                    <div style="font-size:1.125rem;font-weight:700;">${count}</div>
                    <div style="font-size:0.6875rem;color:var(--text-muted);">${site}</div>
                    <div class="progress-bar mt-8" style="height:4px;">
                      <div class="progress-fill" style="width:${pct}%;background:var(--accent);"></div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          ` : `<div class="empty-state"><p>No injection site data.</p></div>`}
        </div>
      </div>`;
  }

  function renderLineChart(data, strokeColor) {
    if (data.length < 2) return '';
    const width = 540;
    const height = 180;
    const padding = { top: 10, right: 10, bottom: 25, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const yValues = data.map(d => d.y);
    const yMin = Math.min(...yValues) * 0.95;
    const yMax = Math.max(...yValues) * 1.05;
    const yRange = yMax - yMin || 1;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.y - yMin) / yRange) * chartH;
      return { x, y, data: d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
    const areaPath = linePath + ` L ${points[points.length - 1].x},${padding.top + chartH} L ${points[0].x},${padding.top + chartH} Z`;

    // Grid lines
    const gridCount = 4;
    const gridLines = Array.from({ length: gridCount }, (_, i) => {
      const y = padding.top + (i / (gridCount - 1)) * chartH;
      const val = yMax - (i / (gridCount - 1)) * yRange;
      return { y, val: val.toFixed(1) };
    });

    return `
      <div class="chart-canvas">
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          ${gridLines.map(g => `
            <line class="chart-grid-line" x1="${padding.left}" y1="${g.y}" x2="${width - padding.right}" y2="${g.y}"/>
            <text class="chart-label" x="${padding.left - 6}" y="${g.y + 3}" text-anchor="end">${g.val}</text>
          `).join('')}
          <path d="${areaPath}" fill="${strokeColor}" class="chart-area"/>
          <path d="${linePath}" stroke="${strokeColor}" class="chart-line"/>
          ${points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" class="chart-dot" fill="var(--bg-primary)" stroke="${strokeColor}"/>
          `).join('')}
          ${data.length <= 12 ? points.map((p, i) => {
            const label = new Date(data[i].x + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `<text class="chart-label" x="${p.x}" y="${height - 4}" text-anchor="middle">${label}</text>`;
          }).join('') : `
            <text class="chart-label" x="${padding.left}" y="${height - 4}" text-anchor="start">${new Date(data[0].x + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
            <text class="chart-label" x="${width - padding.right}" y="${height - 4}" text-anchor="end">${new Date(data[data.length - 1].x + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
          `}
        </svg>
      </div>`;
  }

  // ---- Settings View ----
  function renderSettings() {
    return `
      <div class="fade-in">
        <div class="section-header">
          <h2 class="section-title">Settings</h2>
        </div>

        <div class="setting-group">
          <div class="setting-group-title">Program</div>
          <div class="setting-item" id="editProgram">
            <span class="setting-label">Peptide</span>
            <span class="setting-value">${escapeHtml(state.program.peptideName) || 'Not set'}</span>
          </div>
          <div class="setting-item" id="editStartDate">
            <span class="setting-label">Start Date</span>
            <span class="setting-value">${state.program.startDate ? formatDate(state.program.startDate) : 'Not set'}</span>
          </div>
          <div class="setting-item" id="editDoseUnit">
            <span class="setting-label">Dose Unit</span>
            <span class="setting-value">${escapeHtml(state.program.doseUnit)}</span>
          </div>
          <div class="setting-item" id="editWeightUnit">
            <span class="setting-label">Weight Unit</span>
            <span class="setting-value">${escapeHtml(state.program.weightUnit)}</span>
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-group-title">Data</div>
          <div class="setting-item" id="exportData">
            <span class="setting-label">Export Data (JSON)</span>
            <span class="setting-value">&rsaquo;</span>
          </div>
          <div class="setting-item" id="exportCSV">
            <span class="setting-label">Export Entries (CSV)</span>
            <span class="setting-value">&rsaquo;</span>
          </div>
          <div class="setting-item" id="importData">
            <span class="setting-label">Import Data</span>
            <span class="setting-value">&rsaquo;</span>
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-group-title">Danger Zone</div>
          <div class="setting-item" id="clearEntries" style="border-color:rgba(239,68,68,0.3);">
            <span class="setting-label text-danger">Clear All Entries</span>
            <span class="setting-value text-danger">${state.entries.length} entries</span>
          </div>
          <div class="setting-item" id="resetApp" style="border-color:rgba(239,68,68,0.3);">
            <span class="setting-label text-danger">Reset Entire App</span>
            <span class="setting-value text-danger">&rsaquo;</span>
          </div>
        </div>

        <div class="text-center mt-16 text-muted" style="font-size:0.75rem;">
          69-Week Peptide Program Tracker v1.0<br>
          Data stored locally in your browser.
        </div>
      </div>`;
  }

  function bindSettingsEvents() {
    document.getElementById('editProgram')?.addEventListener('click', () => {
      const val = prompt('Peptide name:', state.program.peptideName);
      if (val !== null) { state.program.peptideName = val.trim(); saveState(); render(); }
    });

    document.getElementById('editStartDate')?.addEventListener('click', () => {
      showEditModal('startDate');
    });

    document.getElementById('editDoseUnit')?.addEventListener('click', () => {
      const val = prompt('Dose unit (mg, mcg, units, mL):', state.program.doseUnit);
      if (val !== null && val.trim()) { state.program.doseUnit = val.trim(); saveState(); render(); }
    });

    document.getElementById('editWeightUnit')?.addEventListener('click', () => {
      const val = prompt('Weight unit (lbs, kg):', state.program.weightUnit);
      if (val !== null && val.trim()) { state.program.weightUnit = val.trim(); saveState(); render(); }
    });

    document.getElementById('exportData')?.addEventListener('click', exportJSON);
    document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('importData')?.addEventListener('click', importData);

    document.getElementById('clearEntries')?.addEventListener('click', () => {
      if (confirm(`Delete all ${state.entries.length} entries? This cannot be undone.`)) {
        state.entries = [];
        saveState();
        render();
      }
    });

    document.getElementById('resetApp')?.addEventListener('click', () => {
      if (confirm('Reset the entire app? All data will be lost.')) {
        if (confirm('Are you really sure? This cannot be undone.')) {
          localStorage.removeItem(STORAGE_KEY);
          state = getDefaultState();
          render();
        }
      }
    });
  }

  // ---- Export / Import ----
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `peptide-tracker-${new Date().toISOString().split('T')[0]}.json`);
  }

  function exportCSV() {
    const headers = ['Date', 'Week', 'Phase', 'Dose', 'Unit', 'Injection Site', 'Side Effects', 'Weight', 'Weight Unit', 'Time of Day', 'Notes'];
    const rows = [...state.entries].sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const week = getWeekNumber(e.date);
      const phase = getPhaseForWeek(week);
      return [
        e.date,
        week,
        phase ? phase.name : '',
        e.dose,
        state.program.doseUnit,
        e.injectionSite || '',
        (e.sideEffects || []).join('; '),
        e.weight || '',
        state.program.weightUnit,
        e.timeOfDay || '',
        (e.notes || '').replace(/"/g, '""'),
      ].map(v => `"${v}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `peptide-tracker-${new Date().toISOString().split('T')[0]}.csv`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (confirm(`Import ${imported.entries?.length || 0} entries? This will replace your current data.`)) {
            state = { ...getDefaultState(), ...imported };
            saveState();
            render();
          }
        } catch (err) {
          alert('Invalid file format. Please select a valid JSON export.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ---- Modals ----
  function showModal(html) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modalContent');
    content.innerHTML = html;
    modal.classList.remove('hidden');

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  function showEditModal(field) {
    if (field === 'startDate') {
      showModal(`
        <div class="modal-header">
          <h3 class="modal-title">Edit Start Date</h3>
          <button class="modal-close" id="modalClose">&times;</button>
        </div>
        <div class="form-group">
          <input type="date" class="form-input" id="modalStartDate" value="${state.program.startDate}">
        </div>
        <button class="btn btn-primary" id="modalSave">Save</button>
      `);
      document.getElementById('modalClose')?.addEventListener('click', closeModal);
      document.getElementById('modalSave')?.addEventListener('click', () => {
        const val = document.getElementById('modalStartDate').value;
        if (val) {
          state.program.startDate = val;
          saveState();
          closeModal();
          render();
        }
      });
    }
  }

  function showWeekDetail(weekNum) {
    const phase = getPhaseForWeek(weekNum);
    const entries = getEntriesForWeek(weekNum);
    const range = getWeekDateRange(weekNum);
    const currentWeek = getCurrentWeek();

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Week ${weekNum}</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div style="margin-bottom:16px;">
        ${phase ? `<span class="phase-chip"><span class="phase-dot" style="background:${phase.color};"></span>${phase.name} Phase</span>` : ''}
        <div class="text-muted mt-8" style="font-size:0.8125rem;">${range.start} – ${range.end}</div>
        ${weekNum === currentWeek ? '<div class="text-accent mt-8" style="font-size:0.8125rem;font-weight:600;">Current Week</div>' : ''}
      </div>
      ${entries.length > 0 ? `
        <div class="card-title mb-8">Entries (${entries.length})</div>
        <ul class="entry-list">
          ${entries.map(e => `
            <li class="entry-item">
              <div class="entry-header">
                <span class="entry-date">${formatDate(e.date)}</span>
                <span class="entry-dose">${e.dose} ${escapeHtml(state.program.doseUnit)}</span>
              </div>
              <div class="entry-details">
                ${e.injectionSite ? `<span class="entry-tag">${escapeHtml(e.injectionSite)}</span>` : ''}
                ${e.weight ? `<span class="entry-tag">${e.weight} ${escapeHtml(state.program.weightUnit)}</span>` : ''}
                ${e.timeOfDay ? `<span class="entry-tag">${escapeHtml(e.timeOfDay)}</span>` : ''}
              </div>
              ${e.sideEffects && e.sideEffects.length ? `<div class="text-warning mt-8" style="font-size:0.75rem;">Side effects: ${e.sideEffects.map(s => escapeHtml(s)).join(', ')}</div>` : ''}
              ${e.notes ? `<div class="text-muted mt-8" style="font-size:0.75rem;">${escapeHtml(e.notes)}</div>` : ''}
            </li>
          `).join('')}
        </ul>
      ` : `
        <div class="empty-state"><p>No entries for this week.</p></div>
      `}
      <button class="btn btn-primary mt-12" id="modalLogWeek">Log Entry for Week ${weekNum}</button>
    `);

    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('modalLogWeek')?.addEventListener('click', () => {
      closeModal();
      setView('log');
    });
  }

  function showEntryDetail(entryId) {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return;

    const week = getWeekNumber(entry.date);
    const phase = getPhaseForWeek(week);

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Entry Detail</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <div style="font-size:1.125rem;font-weight:700;">${formatDate(entry.date)}</div>
            <div class="text-muted" style="font-size:0.8125rem;">
              Week ${week} ${phase ? `&middot; ${phase.name}` : ''}
              ${entry.timeOfDay ? ` &middot; ${escapeHtml(entry.timeOfDay)}` : ''}
            </div>
          </div>
          <div style="font-size:1.25rem;font-weight:700;color:var(--accent);">${entry.dose} ${escapeHtml(state.program.doseUnit)}</div>
        </div>
        ${entry.injectionSite ? `<div style="margin-bottom:8px;font-size:0.875rem;"><strong>Site:</strong> ${escapeHtml(entry.injectionSite)}</div>` : ''}
        ${entry.weight ? `<div style="margin-bottom:8px;font-size:0.875rem;"><strong>Weight:</strong> ${entry.weight} ${escapeHtml(state.program.weightUnit)}</div>` : ''}
        ${entry.sideEffects && entry.sideEffects.length ? `<div style="margin-bottom:8px;font-size:0.875rem;"><strong>Side Effects:</strong> <span class="text-warning">${entry.sideEffects.map(s => escapeHtml(s)).join(', ')}</span></div>` : ''}
        ${entry.notes ? `<div style="margin-bottom:8px;font-size:0.875rem;"><strong>Notes:</strong> ${escapeHtml(entry.notes)}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-danger btn-sm" id="deleteEntry" style="flex:1;">Delete Entry</button>
      </div>
    `);

    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('deleteEntry')?.addEventListener('click', () => {
      if (confirm('Delete this entry?')) {
        state.entries = state.entries.filter(e => e.id !== entryId);
        saveState();
        closeModal();
        render();
      }
    });
  }

  // ---- Init ----
  function init() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    // PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    render();
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
