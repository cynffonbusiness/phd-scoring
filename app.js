console.log('Script 1 starting');
/* ============================================================
   PHD — Navigation + Players roster
   Phase 2 JS (scoring, stats, history, training: future passes)
============================================================ */

// ── Override dev-preview CSS (stacked screens → single active screen) ──
(function () {
  const s = document.createElement('style');
  s.textContent = [
    /* Force body to a definite height so flex:1 on .screens distributes correctly.
       Without this, body height is auto (only the header is in-flow), .screens
       collapses to 0px, and overflow:hidden clips all screen content. */
    'html{height:100%!important}',
    'body{height:100vh!important;overflow:hidden!important}',
    '.screens{height:calc(100vh - 64px)!important;flex:none!important;' +
      'position:relative!important;overflow:hidden!important}',
    '.screen{display:none!important;position:absolute!important;',
    'inset:0!important;min-height:unset!important;overflow-y:auto!important}',
    '.screen.active{display:flex!important}',
    '.dev-section{display:none!important}',
  ].join('');
  document.head.appendChild(s);
}());

// ── Navigation ──────────────────────────────────────────────
const screenStack = [];

function showScreen(id) {
  // Directly set display on every screen so no CSS rule can override
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
    target.scrollTop = 0;
  }
  document.getElementById('btn-back').style.display =
    screenStack.length ? 'block' : 'none';
  const btnHome = document.getElementById('btn-home');
  if (btnHome) btnHome.style.display = (id !== 'screen-home') ? 'block' : 'none';
  if (id === 'screen-home') { try { renderHomeResumeMatch(); } catch(e) {} }
}

function navigateTo(id) {
  console.trace('[navigateTo] → ' + id);
  const active = document.querySelector('.screen.active');
  screenStack.length = 0;          // back always goes exactly one step
  if (active) screenStack.push(active.id);
  showScreen(id);
}

function navigateBack() {
  if (!screenStack.length) return;
  showScreen(screenStack.pop());
  // keep back button visible only if there's still history
  document.getElementById('btn-back').style.display =
    screenStack.length ? 'block' : 'none';
}

// Home mega-buttons + any [data-target] button
document.querySelectorAll('[data-target]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.target));
});

document.getElementById('btn-back').addEventListener('click', navigateBack);
document.getElementById('btn-home').addEventListener('click', () => {
  screenStack.length = 0;
  showScreen('screen-home');
});

// ── Players — localStorage helpers ──────────────────────────
const STORAGE_KEY = 'phd_players';

function getPlayers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function setPlayers(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function initials(name) {
  return name.trim().split(/\s+/)
    .map(w => w[0].toUpperCase())
    .slice(0, 2).join('');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Players — render ─────────────────────────────────────────
function renderPlayers(filter) {
  filter = (filter || '').trim().toLowerCase();
  const players = getPlayers();
  const shown = filter
    ? players.filter(p => p.name.toLowerCase().includes(filter))
    : players;
  const list = document.getElementById('player-list');

  if (!shown.length) {
    list.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">&#128101;</div>' +
        '<div class="empty-text">' +
          (filter ? 'No players match your search.' :
                    'No players yet.<br>Add your first player below.') +
        '</div>' +
      '</div>';
    return;
  }

  list.innerHTML = shown.map(p => {
    const ini = initials(p.name);
    const added = p.added ? 'Added ' + formatDate(p.added) : '';
    return (
      '<div class="player-item" data-player-id="' + p.id + '">' +
        '<div class="player-avatar">' + ini + '</div>' +
        '<div class="player-info">' +
          '<div class="player-name">' + escHtml(p.name) + '</div>' +
          '<div class="player-stats-line">' + escHtml(added) + '</div>' +
        '</div>' +
        '<div class="player-actions">' +
          '<button class="icon-btn" data-edit="' + p.id + '" title="Edit">&#9999;</button>' +
          '<button class="icon-btn delete" data-delete="' + p.id + '" title="Delete">&#128465;</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Players — inline edit ────────────────────────────────────
function activateInlineEdit(item, playerId) {
  const players = getPlayers();
  const player = players.find(p => p.id === playerId);
  if (!player) return;

  // swap name to input
  item.querySelector('.player-name').innerHTML =
    '<input class="form-input" id="inline-edit-input" ' +
    'style="min-height:40px;padding:8px 12px;font-size:1rem;" ' +
    'value="' + escHtml(player.name) + '" maxlength="32"/>';

  // swap action buttons to save/cancel
  item.querySelector('.player-actions').innerHTML =
    '<button class="icon-btn" data-save="' + playerId + '" ' +
    'title="Save" style="color:var(--success);border-color:var(--success);">&#10003;</button>' +
    '<button class="icon-btn" data-cancel="' + playerId + '" title="Cancel">&#10005;</button>';

  const input = document.getElementById('inline-edit-input');
  input.focus();
  input.select();

  // save on Enter
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') commitEdit(playerId);
    if (e.key === 'Escape') renderPlayers(currentSearch());
  });
}

function commitEdit(playerId) {
  const input = document.getElementById('inline-edit-input');
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) { input.focus(); return; }
  const players = getPlayers();
  const idx = players.findIndex(p => p.id === playerId);
  if (idx !== -1) { players[idx].name = newName; setPlayers(players); }
  renderPlayers(currentSearch());
}

function currentSearch() {
  return (document.getElementById('player-search') || {}).value || '';
}

// ── Players — event delegation on list ──────────────────────
document.getElementById('player-list').addEventListener('click', e => {
  const editBtn   = e.target.closest('[data-edit]');
  const deleteBtn = e.target.closest('[data-delete]');
  const saveBtn   = e.target.closest('[data-save]');
  const cancelBtn = e.target.closest('[data-cancel]');

  if (editBtn) {
    const id = editBtn.dataset.edit;
    const item = editBtn.closest('.player-item');
    activateInlineEdit(item, id);
    return;
  }

  if (saveBtn) {
    commitEdit(saveBtn.dataset.save);
    return;
  }

  if (cancelBtn) {
    renderPlayers(currentSearch());
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.delete;
    setPlayers(getPlayers().filter(p => p.id !== id));
    renderPlayers(currentSearch());
    return;
  }
});

// ── Players — search ─────────────────────────────────────────
document.getElementById('player-search').addEventListener('input', function () {
  renderPlayers(this.value);
});

// ── Players — add via modal ──────────────────────────────────
function openAddModal() {
  document.getElementById('modal-player-title').textContent = 'Add Player';
  document.getElementById('modal-player-name').value = '';
  document.getElementById('modal-player-nickname').value = '';
  document.getElementById('modal-player').classList.add('open');
  document.getElementById('modal-player-name').focus();
}

function closeModal() {
  document.getElementById('modal-player').classList.remove('open');
}

document.getElementById('btn-add-player').addEventListener('click', openAddModal);
document.getElementById('btn-cancel-player').addEventListener('click', closeModal);

// Close modal on overlay click (outside the sheet)
document.getElementById('modal-player').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('btn-save-player').addEventListener('click', saveNewPlayer);

document.getElementById('modal-player-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveNewPlayer();
  if (e.key === 'Escape') closeModal();
});

function saveNewPlayer() {
  const nameInput = document.getElementById('modal-player-name');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    nameInput.style.borderColor = 'var(--danger)';
    setTimeout(() => { nameInput.style.borderColor = ''; }, 1200);
    return;
  }
  const players = getPlayers();
  players.push({ id: makeId(), name, added: new Date().toISOString() });
  setPlayers(players);
  closeModal();
  renderPlayers(currentSearch());
}

// ── Boot ─────────────────────────────────────────────────────
(function init() {
  showScreen('screen-home');
  renderPlayers();
}());

/* ============================================================
   PHD — Match State + Game Assignment  (Phase 3)
============================================================ */

// ── CSS for new components ───────────────────────────────────
(function () {
  const s = document.createElement('style');
  s.textContent =
    '.match-points-bar{display:flex;align-items:center;justify-content:space-between;' +
      'background:#0a0a0a;border:2px solid var(--border);border-radius:var(--radius);padding:14px 20px}' +
    '.points-side{text-align:center}' +
    '.points-team{font-size:0.65rem;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;' +
      'font-family:Arial,sans-serif}' +
    '.points-score{font-size:2.2rem;color:var(--accent);line-height:1.1}' +
    '.points-sep{font-size:1.2rem;color:var(--text-muted);font-family:Arial,sans-serif}' +
    '.game-header{background:var(--bg-card);border:2px solid var(--accent);' +
      'border-radius:var(--radius-lg);padding:16px;text-align:center}' +
    '.game-num{font-size:0.65rem;color:var(--text-muted);letter-spacing:3px;' +
      'text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:6px}' +
    '.game-format-title{font-size:1.6rem;color:var(--accent);letter-spacing:1px}' +
    '.game-meta{font-size:0.75rem;color:var(--text-dim);font-family:Arial,sans-serif;' +
      'font-weight:400;margin-top:6px}' +
    '.roster-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px}' +
    '.roster-btn{background:var(--bg-raised);border:2px solid var(--border);' +
      'border-radius:var(--radius);color:var(--text);font-family:Arial,sans-serif;' +
      'font-weight:700;font-size:0.85rem;padding:10px 6px;cursor:pointer;text-align:center;' +
      'transition:background 0.12s,border-color 0.12s;min-height:48px;' +
      '-webkit-tap-highlight-color:transparent;line-height:1.2}' +
    '.roster-btn.selected{background:var(--accent);border-color:var(--accent);color:#fff}' +
    '.roster-btn.disabled{opacity:0.28;pointer-events:none}' +
    '.selection-chips{display:flex;flex-wrap:wrap;gap:6px;min-height:28px;' +
      'padding:6px 0;align-items:center}' +
    '.chip{display:inline-flex;align-items:center;gap:6px;background:var(--accent);' +
      'color:#fff;border-radius:99px;padding:5px 8px 5px 12px;font-size:0.8rem;' +
      'font-family:Arial,sans-serif}' +
    '.chip-remove{background:none;border:none;color:rgba(255,255,255,0.75);cursor:pointer;' +
      'font-size:1rem;line-height:1;padding:0;display:flex;align-items:center}' +
    '.chip-remove:hover{color:#fff}' +
    '.gs-section-label{font-size:0.65rem;color:var(--text-muted);letter-spacing:2px;' +
      'text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:10px}' +
    '.gs-card{background:var(--bg-card);border:1px solid var(--border);' +
      'border-radius:var(--radius-lg);padding:16px;display:flex;flex-direction:column;gap:12px}';
  document.head.appendChild(s);
}());

// ── Match State ──────────────────────────────────────────────
const matchState = {
  homeTeam: 'PHD',
  awayTeam: '',
  currentGame: 1,
  points: { home: 0, away: 0 },
  games: []   // { gameNum, format, phd:[], opp:[], winner:null }
};

// ── Fixed game format schedule ───────────────────────────────
const GAME_FORMATS = [
  { num:1, label:'Fours',   score:801, legs:1, players:4, throw:'away' },
  { num:2, label:'Triples', score:701, legs:1, players:3, throw:'home' },
  { num:3, label:'Doubles', score:601, legs:1, players:2, throw:'away' },
  { num:4, label:'Doubles', score:601, legs:1, players:2, throw:'home' },
  { num:5, label:'Singles', score:501, legs:3, players:1, throw:'away' },
  { num:6, label:'Singles', score:501, legs:3, players:1, throw:'home' },
  { num:7, label:'Singles', score:501, legs:3, players:1, throw:'away' },
  { num:8, label:'Singles', score:501, legs:3, players:1, throw:'home' },
  { num:9, label:'Singles', score:501, legs:3, players:1, throw:'away' },
];

// ── Match Setup Screen ───────────────────────────────────────
function renderMatchSetup() {
  document.getElementById('screen-match-setup').innerHTML = `
    <div>
      <div class="page-title">Match Night</div>
      <div class="page-subtitle">Set up tonight's fixture</div>
    </div>
    <div class="form-group">
      <label class="form-label" for="ms-home">PHD Team Name</label>
      <input class="form-input" id="ms-home" type="text"
             value="${escHtml(matchState.homeTeam)}"
             placeholder="PHD" maxlength="24"/>
    </div>
    <div class="form-group">
      <label class="form-label" for="ms-away">Opponents</label>
      <input class="form-input" id="ms-away" type="text"
             value="${escHtml(matchState.awayTeam)}"
             placeholder="Opponent team name" maxlength="24"/>
    </div>
    <div class="mt-auto">
      <button class="btn btn-primary" id="btn-begin-match">
        &#127919;&nbsp; Begin Match Night
      </button>
    </div>`;

  document.getElementById('ms-away').addEventListener('keydown', e => {
    if (e.key === 'Enter') beginMatch();
  });
  document.getElementById('ms-home').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ms-away').focus();
  });
  document.getElementById('btn-begin-match').addEventListener('click', beginMatch);
}

function beginMatch() {
  const home = (document.getElementById('ms-home').value || '').trim() || 'PHD';
  const away = (document.getElementById('ms-away').value || '').trim();
  if (!away) {
    flashRed(document.getElementById('ms-away'));
    return;
  }
  matchState.homeTeam  = home;
  matchState.awayTeam  = away;
  matchState.currentGame = 1;
  matchState.points    = { home: 0, away: 0 };
  matchState.games     = [];
  navigateTo('screen-game-setup');
  renderGameSetup();
}

// Re-render each time user taps "Start Match" from home
document.querySelector('[data-target="screen-match-setup"]')
  .addEventListener('click', renderMatchSetup);

// ── Game Assignment Screen ───────────────────────────────────
let phdSelected = [];   // ordered array of names chosen for PHD side

function renderGameSetup() {
  phdSelected = [];
  const gn   = matchState.currentGame;
  const fmt  = GAME_FORMATS[gn - 1];
  const scr  = document.getElementById('screen-game-setup');

  const throwTeam = fmt.throw === 'home' ? matchState.homeTeam : matchState.awayTeam;
  const legLabel  = fmt.legs === 1 ? 'Single leg' : `Best of ${fmt.legs} legs`;
  const plural    = fmt.players > 1;

  // Opponent inputs
  const oppInputsHtml = Array.from({ length: fmt.players }, (_, i) => `
    <div class="form-group">
      <label class="form-label" for="opp-${i + 1}">
        ${plural ? `Opponent ${i + 1}` : 'Opponent name'}
      </label>
      <input class="form-input" id="opp-${i + 1}" type="text"
             placeholder="Name" maxlength="32"/>
    </div>`).join('');

  // PHD roster grid
  const players = getPlayers();
  const rosterHtml = players.length
    ? `<div class="roster-grid" id="roster-grid">
        ${players.map(p =>
          `<button class="roster-btn" data-roster-name="${escHtml(p.name)}">
            ${escHtml(p.name)}
          </button>`
        ).join('')}
       </div>`
    : `<p style="font-size:0.8rem;color:var(--text-muted);font-family:Arial,sans-serif;
               text-align:center;padding:6px 0;">
         No roster saved — use the name input below.
       </p>`;

  scr.innerHTML = `
    <!-- Running points bar -->
    <div class="match-points-bar">
      <div class="points-side">
        <div class="points-team">${escHtml(matchState.homeTeam)}</div>
        <div class="points-score">${matchState.points.home}</div>
      </div>
      <div class="points-sep">&#8212;</div>
      <div class="points-side">
        <div class="points-team">${escHtml(matchState.awayTeam)}</div>
        <div class="points-score">${matchState.points.away}</div>
      </div>
    </div>

    <!-- Game header -->
    <div class="game-header">
      <div class="game-num">Game ${gn} of 9</div>
      <div class="game-format-title">${fmt.label} &mdash; ${fmt.score}</div>
      <div class="game-meta">
        ${legLabel} &nbsp;&bull;&nbsp;
        ${escHtml(throwTeam)} throws first
      </div>
    </div>

    <!-- PHD side -->
    <div class="gs-card" id="phd-card">
      <div class="gs-section-label">
        ${escHtml(matchState.homeTeam)} &mdash;
        Select ${fmt.players} ${plural ? 'players' : 'player'}
      </div>
      ${rosterHtml}
      <div class="selection-chips" id="phd-chips">
        <span style="font-size:0.75rem;color:var(--text-muted);font-family:Arial,sans-serif;">
          No players selected
        </span>
      </div>
      <div style="display:flex;gap:8px;align-items:stretch;">
        <input class="form-input" id="phd-name-input" type="text"
               placeholder="Type a name instead" maxlength="32"
               style="min-height:48px;padding:10px 14px;font-size:0.95rem;"/>
        <button class="btn btn-ghost" id="btn-add-phd-name"
                style="flex:0 0 auto;width:56px;min-height:48px;padding:0;
                       font-size:1.4rem;border-radius:var(--radius);">+</button>
      </div>
    </div>

    <!-- Opponent side -->
    <div class="gs-card">
      <div class="gs-section-label">${escHtml(matchState.awayTeam)}</div>
      ${oppInputsHtml}
    </div>

    <!-- Start button -->
    <button class="btn btn-primary" id="btn-start-game" style="margin-top:auto;">
      &#127919;&nbsp; Start Game ${gn}
    </button>`;

  attachGameSetupListeners(fmt);
}

function attachGameSetupListeners(fmt) {
  // Roster grid: tap to toggle selection
  const grid = document.getElementById('roster-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.roster-btn');
      if (!btn || btn.classList.contains('disabled')) return;
      togglePhdPlayer(btn.dataset.rosterName, fmt.players);
    });
  }

  // Typed name input
  const nameInput = document.getElementById('phd-name-input');
  function addTypedName() {
    const name = nameInput.value.trim();
    if (!name || phdSelected.length >= fmt.players) return;
    phdSelected.push(name);
    nameInput.value = '';
    refreshPhdUI(fmt.players);
    nameInput.focus();
  }
  document.getElementById('btn-add-phd-name').addEventListener('click', addTypedName);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTypedName(); });

  // Start game
  document.getElementById('btn-start-game').addEventListener('click', () => startGame(fmt));
}

function togglePhdPlayer(name, max) {
  const idx = phdSelected.indexOf(name);
  if (idx !== -1) {
    phdSelected.splice(idx, 1);
  } else if (phdSelected.length < max) {
    phdSelected.push(name);
  }
  refreshPhdUI(max);
}

function refreshPhdUI(max) {
  const chipsEl = document.getElementById('phd-chips');
  if (chipsEl) {
    if (phdSelected.length) {
      chipsEl.innerHTML = phdSelected.map((n, i) =>
        `<div class="chip">
           ${max > 1 ? `<span style="opacity:0.7;font-size:0.7rem;">${i + 1}.</span>` : ''}
           ${escHtml(n)}
           <button class="chip-remove" data-idx="${i}" title="Remove">&#10005;</button>
         </div>`
      ).join('');
      chipsEl.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          phdSelected.splice(parseInt(btn.dataset.idx), 1);
          refreshPhdUI(max);
        });
      });
    } else {
      chipsEl.innerHTML =
        '<span style="font-size:0.75rem;color:var(--text-muted);font-family:Arial,sans-serif;">' +
        'No players selected</span>';
    }
  }

  // Sync roster button states
  const grid = document.getElementById('roster-grid');
  if (grid) {
    const full = phdSelected.length >= max;
    grid.querySelectorAll('.roster-btn').forEach(btn => {
      const isSel = phdSelected.includes(btn.dataset.rosterName);
      btn.classList.toggle('selected', isSel);
      btn.classList.toggle('disabled', full && !isSel);
    });
  }
}

function startGame(fmt) {
  // Validate PHD selection
  if (phdSelected.length < fmt.players) {
    const card = document.getElementById('phd-card');
    if (card) {
      card.style.borderColor = 'var(--danger)';
      card.style.borderWidth = '2px';
      setTimeout(() => { card.style.borderColor = ''; card.style.borderWidth = ''; }, 1200);
    }
    return;
  }

  // Validate opponent inputs
  const oppNames = [];
  for (let i = 1; i <= fmt.players; i++) {
    const inp = document.getElementById('opp-' + i);
    const val = inp ? inp.value.trim() : '';
    if (!val) { flashRed(inp); return; }
    oppNames.push(val);
  }

  // Persist into matchState
  matchState.games[matchState.currentGame - 1] = {
    gameNum: matchState.currentGame,
    format:  Object.assign({}, fmt),
    phd:     phdSelected.slice(),
    opp:     oppNames,
    winner:  null
  };

  // Navigate to scoring (logic added next pass)
  navigateTo('screen-scoring');
}

// ── Shared utility ───────────────────────────────────────────
function flashRed(el) {
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  if (el.focus) el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1200);
}

// ── Init this phase ──────────────────────────────────────────
renderMatchSetup();

/* ══════════════════════════════════════════════════════
   PHASE 4 — SCORING ENGINE
══════════════════════════════════════════════════════ */

// ── CSS injection ─────────────────────────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = [
    // Screen container
    '#screen-scoring{overflow:hidden!important;padding:8px 0 0!important;gap:0!important;display:flex;flex-direction:column;}',

    // ── TOP BAR (3 sections: home | legs | away) ──────
    '.sc-topbar{background:#0a0a0a;border-bottom:1px solid var(--border);display:flex;align-items:stretch;flex-shrink:0;min-height:50px;}',
    '.sc-top-left{flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:4px 10px;min-width:0;overflow:hidden;gap:1px;}',
    '.sc-top-center{width:72px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid var(--border);border-right:1px solid var(--border);background:#111;padding:2px 4px;gap:1px;}',
    '.sc-top-right{flex:1;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding:4px 10px;min-width:0;overflow:hidden;gap:1px;}',
    '.sc-top-player{font-size:12px;font-weight:700;color:var(--text-muted);font-family:Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.25;}',
    '.sc-top-player-active{color:var(--accent);}',
    '.sc-top-legs{display:flex;align-items:center;gap:4px;}',
    '.sc-top-leg-val{font-size:16px;font-weight:900;color:var(--accent);font-family:"Arial Black",Arial,sans-serif;line-height:1;}',
    '.sc-top-leg-lbl{font-size:7px;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;}',
    '.sc-top-game-info{font-size:8px;color:var(--text-muted);font-family:Arial,sans-serif;text-align:center;}',

    // ── MAIN TABLE (capped height, scrollable) ────────
    '.sc-table-wrap{flex:1;min-height:0;overflow-y:auto;background:#1a1a1a;}',
    '.sc-table-wrap::-webkit-scrollbar{width:4px;}.sc-table-wrap::-webkit-scrollbar-track{background:#111;}.sc-table-wrap::-webkit-scrollbar-thumb{background:#444;border-radius:2px;}',
    '.sc-tbl-head{display:grid;grid-template-columns:1fr 1.4fr 48px 1fr 1.4fr;background:#1e1e1e;border-bottom:2px solid #333;position:sticky;top:0;z-index:2;}',
    '.sc-tbl-head>div{padding:3px 6px;font-size:11px!important;font-weight:500!important;color:#888!important;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;display:flex;align-items:center;}',
    '.sc-tbl-row{display:grid;grid-template-columns:1fr 1.4fr 48px 1fr 1.4fr;border-bottom:1px solid #333;min-height:120px;}',
    '.sc-tbl-row:nth-child(odd){background:#1a1a1a;}',
    '.sc-tbl-row:nth-child(even){background:#222;}',
    '.sc-tbl-row:not(.sc-tbl-start):not(.sc-tbl-pending){cursor:pointer;}',
    '.sc-tbl-row:not(.sc-tbl-start):not(.sc-tbl-pending):hover{background:#2a2a2a;}',
    '.sc-tbl-row>div{padding:3px 6px;font-size:13px;font-family:Arial,sans-serif;color:#ccc;display:flex;align-items:center;}',
    '.sc-tbl-c1{display:flex;align-items:center;justify-content:flex-end;font-size:2rem!important;line-height:1;font-weight:700!important;color:#999;border-right:1px solid #555;overflow:hidden;}',
    '.sc-tbl-c2{display:flex;align-items:center;justify-content:flex-end;font-size:3.5rem!important;line-height:1;font-weight:900!important;color:#fff;font-family:"Arial Black",Arial,sans-serif;overflow:hidden;}',
    '.sc-tbl-c3{justify-content:center;background:#161616;color:#555;font-size:10px;border-left:1px solid #333;border-right:1px solid #333;}',
    '.sc-tbl-c4{display:flex;align-items:center;justify-content:flex-start;font-size:2rem!important;line-height:1;font-weight:700!important;color:#999;overflow:hidden;}',
    '.sc-tbl-c5{display:flex;align-items:center;justify-content:flex-start;font-size:3.5rem!important;line-height:1;font-weight:900!important;color:#fff;font-family:"Arial Black",Arial,sans-serif;border-left:1px solid #555;overflow:hidden;}',
    '.sc-tbl-start{background:#161616!important;cursor:default!important;}',
    '.sc-tbl-start>div{color:#555!important;font-size:11px!important;font-weight:400!important;font-style:italic;}',
    '.sc-tbl-pending{cursor:default!important;}',
    '.sc-tbl-pending-cell{background:var(--accent)!important;color:#fff!important;font-weight:700!important;}',
    '.sc-tbl-bust{color:#ff6b6b!important;font-size:10px!important;font-weight:700!important;}',
    // Edit row inside table
    '.sc-history-edit-row{background:rgba(232,82,10,0.08);border:1px solid var(--accent)!important;}',
    '.sc-history-edit-row input{flex:1;background:#333;color:#fff;border:1px solid var(--accent);border-radius:6px;padding:4px 8px;font-size:13px;}',
    '.sc-history-edit-row button{padding:4px 10px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:700;}',
    '.sc-edit-save{background:var(--accent);color:#fff;}',
    '.sc-edit-cancel{background:#555;color:#fff;}',

    // ── BOTTOM SCORE BAR (dominant element — flex:1) ──
    '.sc-score-bar{display:flex;flex-shrink:0;height:120px;border-top:2px solid var(--border);}',
    '.sc-score-box{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;min-width:0;background:#111;transition:background 0.2s,border-bottom 0.2s;gap:4px;}',
    '.sc-score-box.active-turn{background:rgba(232,82,10,0.08);border-bottom:3px solid var(--accent);}',
    '.sc-box-name{font-size:9px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;color:var(--text-muted);}',
    '.sc-box-rem{font-size:min(5rem,22vw);font-weight:900;line-height:1;font-family:"Arial Black",Arial,sans-serif;letter-spacing:-2px;text-align:center;color:#fff;}',
    '.sc-score-box.active-turn .sc-box-rem{color:var(--accent);}',
    '.sc-score-divider{width:1px;background:var(--border);flex-shrink:0;align-self:stretch;}',

    // ── NUMPAD AREA ───────────────────────────────────
    '.sc-numpad-area{background:#0a0a0a;border-top:1px solid var(--border);flex-shrink:0;display:flex;flex-direction:column;gap:3px;padding:4px;}',
    '.sc-input-row{display:flex;align-items:center;gap:10px;padding:2px 6px;}',
    '.sc-input-label{font-size:11px;color:var(--text-muted);flex:1;font-family:Arial,sans-serif;}',
    '.sc-input-val{font-size:26px;font-weight:800;color:#fff;min-width:60px;text-align:center;letter-spacing:2px;transition:color 0.15s;}',
    '.sc-input-val.bust-flash{color:var(--danger)!important;}',
    '.sc-input-val.leg-flash{color:var(--success)!important;}',
    '.sc-action-row{display:grid;grid-template-columns:1fr 1fr;gap:3px;}',
    '.sc-action-row .numpad-btn{min-height:72px;border-radius:7px;border:1px solid var(--border);background:#1a1a1a;color:#fff;font-size:1.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}',
    '.sc-action-row .numpad-btn:active{background:#2a2a2a;}',
    '.sc-action-row .numpad-bust{background:#1a0a0a!important;border-color:var(--danger)!important;color:var(--danger)!important;}',
    '.sc-action-row .numpad-undo{background:#1a1a2a!important;border-color:#555!important;color:#aaa!important;}',
    '#sc-numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;}',
    '#sc-numpad .numpad-btn{min-height:72px;border-radius:7px;border:1px solid var(--border);background:#1a1a1a;color:#fff;font-size:1.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}',
    '#sc-numpad .numpad-btn:active{background:#2a2a2a;}',
    '#sc-numpad .numpad-confirm{background:var(--accent);border-color:var(--accent);}',
    '#sc-numpad .numpad-del{background:#2a1a1a;border-color:var(--danger);color:var(--danger);}',
    // Undo confirmation popup
    '.undo-popup-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.78);}',
    '.undo-popup-box{background:#1e1e1e;border:1px solid #444;border-radius:14px;padding:26px 22px;min-width:260px;max-width:320px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.6);}',
    '.undo-popup-title{font-size:1.1rem;font-weight:700;color:#fff;font-family:Arial,sans-serif;margin-bottom:20px;letter-spacing:0.3px;}',
    '.undo-popup-btns{display:flex;gap:10px;}',
    '.undo-popup-yes{flex:1;min-height:50px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;}',
    '.undo-popup-no{flex:1;min-height:50px;background:#2a2a2a;color:#bbb;border:1px solid #555;border-radius:9px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;}',
  ].join('');
  document.head.appendChild(s);
}());

// ── Game state ────────────────────────────────────────
const gameState = {
  players: [],
  sideScores: { home: 501, away: 501 },
  currentPlayerIndex: 0,
  currentLeg: 1,
  legsWon: { home: 0, away: 0 },
  startingScore: 501,
  whoThrowsFirst: 'away',
  format: null,
  currentInput: '',
  visitSeq: 0,
  bustActive: false,
  flashMsg: null,
  flashTimer: null,
  visitEdit: null,   // { pi, vi, value } — set when editing a past visit via numpad
};

// ── Build interleaved player order ────────────────────
function buildPlayerOrder(game) {
  const fmt = game.format;
  const phdPlayers = game.phd.map(n => ({ name: n, side: 'home' }));
  const oppPlayers = game.opp.map(n => ({ name: n, side: 'away' }));
  const firstSide  = fmt.throw;
  const firstArr   = firstSide === 'away' ? oppPlayers : phdPlayers;
  const secondArr  = firstSide === 'away' ? phdPlayers : oppPlayers;
  const order = [];
  const len = Math.max(firstArr.length, secondArr.length);
  for (let i = 0; i < len; i++) {
    if (firstArr[i])  order.push(firstArr[i]);
    if (secondArr[i]) order.push(secondArr[i]);
  }
  return order;
}

// ── Initialise scoring screen from matchState ─────────
function initScoringScreen() {
  const game = matchState.games[matchState.currentGame - 1];
  if (!game) return;
  const fmt = game.format;

  if (gameState.flashTimer) { clearTimeout(gameState.flashTimer); gameState.flashTimer = null; }

  gameState.format         = fmt;
  gameState.startingScore  = fmt.score;
  gameState.whoThrowsFirst = fmt.throw;
  gameState.sideScores     = { home: fmt.score, away: fmt.score };
  gameState.legsWon        = { home: 0, away: 0 };
  gameState.currentLeg     = 1;
  gameState.visitSeq       = 0;
  gameState.currentInput   = '';
  gameState.bustActive     = false;
  gameState.flashMsg       = null;
  gameState.players        = buildPlayerOrder(game).map(p => ({ name: p.name, side: p.side, visits: [] }));

  const firstIdx = gameState.players.findIndex(p => p.side === fmt.throw);
  gameState.currentPlayerIndex = firstIdx >= 0 ? firstIdx : 0;

  renderScoringScreen();
}

// ── Wrap Phase-3 startGame to call scoring init ───────
(function(){
  const _orig = window.startGame;
  window.startGame = function(fmt) {
    _orig(fmt);
    initScoringScreen();
  };
}());

// ── Rebuild the full scoring screen HTML ──────────────
function renderScoringScreen() {
  const scr = document.getElementById('screen-scoring');
  if (!scr) return;
  const fmt      = gameState.format;
  const homeTeam = matchState.homeTeam || 'PHD';
  const awayTeam = matchState.awayTeam || 'Opponents';

  // Score bar labels show team name (player names are in the topbar)

  scr.innerHTML = `
    <!-- Top bar: 3 sections (home player | legs | away player) -->
    <div class="sc-topbar">
      <div class="sc-top-left" id="sc-top-left"></div>
      <div class="sc-top-center">
        <div class="sc-top-legs">
          <span class="sc-top-leg-val" id="sc-legs-home">0</span>
          <span class="sc-top-leg-lbl">LEGS</span>
          <span class="sc-top-leg-val" id="sc-legs-away">0</span>
        </div>
        <div class="sc-top-game-info">G${matchState.currentGame}/9 &bull; ${escHtml(fmt.label)}</div>
      </div>
      <div class="sc-top-right" id="sc-top-right"></div>
    </div>

    <!-- Scrollable 5-column visit table -->
    <div class="sc-table-wrap" id="sc-history"></div>

    <!-- Bottom score bar: dark background, active gets orange tint + accent border -->
    <div class="sc-score-bar" id="sc-score-bar">
      <div class="sc-score-box" id="sc-panel-home">
        <div class="sc-box-name" id="sc-names-home">${escHtml(homeTeam)}</div>
        <div class="sc-box-rem" id="sc-rem-home">${fmt.score}</div>
      </div>
      <div class="sc-score-divider"></div>
      <div class="sc-score-box" id="sc-panel-away">
        <div class="sc-box-name" id="sc-names-away">${escHtml(awayTeam)}</div>
        <div class="sc-box-rem" id="sc-rem-away">${fmt.score}</div>
      </div>
    </div>

    <!-- Input display + action buttons + numpad -->
    <div class="sc-numpad-area">
      <div class="sc-input-row">
        <div class="sc-input-label" id="sc-input-label">Enter score</div>
        <div class="sc-input-val" id="sc-input-val">&mdash;</div>
      </div>
      <div class="sc-action-row">
        <button class="numpad-btn numpad-bust" data-sc-val="bust">BUST</button>
        <button class="numpad-btn numpad-undo" data-sc-val="undo">UNDO</button>
      </div>
      <div id="sc-numpad">
        ${[1,2,3,4,5,6,7,8,9].map(n =>
          `<button class="numpad-btn" data-sc-val="${n}">${n}</button>`).join('')}
        <button class="numpad-btn numpad-del"     data-sc-val="del">&#9003;</button>
        <button class="numpad-btn"                data-sc-val="0">0</button>
        <button class="numpad-btn numpad-confirm" data-sc-val="confirm">&#10003;</button>
      </div>
    </div>

    <!-- Dummy: keep legacy IDs alive for compat (hidden) -->
    <div style="display:none;" id="sc-recent-home"></div>
    <div style="display:none;" id="sc-recent-away"></div>
    <div style="display:none;" id="sc-mid-info"></div>
    <div style="display:none;" id="sc-match-pts"></div>

    <!-- placeholder to satisfy old selector (replaced below in sc-score-area -->
    <div style="display:none;"><div id="sc-topbar-names"></div>
    </div>`;

  bindNumpad();
  // Wire action-row buttons (BUST / UNDO live outside #sc-numpad)
  scr.querySelectorAll('.sc-action-row [data-sc-val]').forEach(btn => {
    btn.addEventListener('click', () => handleNumpadInput(btn.dataset.scVal));
  });
  renderScoringUI();
}

// ── Update all display elements ───────────────────────
function renderScoringUI() {
  const gs = gameState;
  const cp = gs.players[gs.currentPlayerIndex];
  if (!cp) return;

  const homeActive = cp.side === 'home';
  const awayActive = cp.side === 'away';

  // Remaining scores + legs
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setTxt('sc-rem-home', gs.sideScores.home);
  setTxt('sc-rem-away', gs.sideScores.away);
  setTxt('sc-legs-home', gs.legsWon.home);
  setTxt('sc-legs-away', gs.legsWon.away);

  // Top bar: home players stacked left, away players stacked right
  // Currently throwing player is orange; all others are muted
  const topLeftEl  = document.getElementById('sc-top-left');
  const topRightEl = document.getElementById('sc-top-right');
  if (topLeftEl) {
    topLeftEl.className = 'sc-top-left';
    topLeftEl.innerHTML = gs.players
      .filter(p => p.side === 'home')
      .map(p => `<span class="sc-top-player${p === cp ? ' sc-top-player-active' : ''}">${escHtml(p.name)}</span>`)
      .join('');
  }
  if (topRightEl) {
    topRightEl.className = 'sc-top-right';
    topRightEl.innerHTML = gs.players
      .filter(p => p.side === 'away')
      .map(p => `<span class="sc-top-player${p === cp ? ' sc-top-player-active' : ''}">${escHtml(p.name)}</span>`)
      .join('');
  }

  // Score box team name labels (player names are in the topbar)
  const homeNameEl = document.getElementById('sc-names-home');
  if (homeNameEl) homeNameEl.textContent = matchState.homeTeam || 'PHD';
  const awayNameEl = document.getElementById('sc-names-away');
  if (awayNameEl) awayNameEl.textContent = matchState.awayTeam || 'Opponents';

  // Training mode: update all N team panels
  if (gs.mode === 'training') {
    (gs.teams || []).forEach((team, i) => {
      const side    = 't' + i;
      const panelEl = document.getElementById(`sc-panel-t${i}`);
      if (!panelEl) return;
      panelEl.classList.toggle('active-turn', cp.side === side);
      const remEl   = document.getElementById(`sc-rem-t${i}`);
      if (remEl) remEl.textContent = gs.sideScores[side];
      const chEl    = document.getElementById(`sc-checkout-t${i}`);
      if (chEl) {
        const rem = gs.sideScores[side];
        chEl.textContent = (checkoutToggle && rem >= 2 && rem <= 170) ? (CHECKOUTS[rem] || '') : '';
      }
      const namesEl = document.getElementById(`sc-names-t${i}`);
      if (namesEl) {
        namesEl.innerHTML = gs.players
          .filter(p => p.side === side)
          .map(p => `<span${p === cp ? ' class="sc-active-player"' : ''}>${escHtml(p.name)}</span>`)
          .join('<br>');
      }
    });
    // Refresh legs-won display in topbar (multi-leg training only)
    if (gs.format && gs.format.legs > 1) {
      const ldisp = document.getElementById('tr-legs-display');
      if (ldisp) ldisp.textContent = (gs.teams || []).map(t => gs.legsWon[t.side] || 0).join('–');
    }
    // Refresh training topbar team name highlights
    const trBarLeft = document.getElementById('tr-bar-left');
    if (trBarLeft) {
      trBarLeft.innerHTML = `<span class="sc-top-player${cp.side === 't0' ? ' sc-top-player-active' : ''}">${escHtml((gs.players || []).filter(p => p.side === 't0').map(p => p.name).join(' & '))}</span>`;
    }
    const trBarRight = document.getElementById('tr-bar-right');
    if (trBarRight) {
      trBarRight.innerHTML = `<span class="sc-top-player${cp.side === 't1' ? ' sc-top-player-active' : ''}">${escHtml((gs.players || []).filter(p => p.side === 't1').map(p => p.name).join(' & '))}</span>`;
    }
  }

  // Score box active state (match mode)
  const homeBox = document.getElementById('sc-panel-home');
  const awayBox = document.getElementById('sc-panel-away');
  if (homeBox) homeBox.classList.toggle('active-turn', homeActive);
  if (awayBox) awayBox.classList.toggle('active-turn', awayActive);

  // Input display
  const ivEl = document.getElementById('sc-input-val');
  const ilEl = document.getElementById('sc-input-label');
  if (ivEl) {
    if (gs.flashMsg) {
      ivEl.textContent = gs.flashMsg.text;
      ivEl.className   = 'sc-input-val ' + (gs.flashMsg.cls || '');
    } else if (gs.visitEdit) {
      ivEl.textContent = gs.visitEdit.value || '—';
      ivEl.className   = 'sc-input-val';
    } else {
      ivEl.textContent = gs.currentInput || '—';
      ivEl.className   = 'sc-input-val';
    }
  }
  if (ilEl) ilEl.textContent = gs.visitEdit ? 'Editing visit' : `${cp.name} — Leg ${gs.currentLeg}`;

  // Don't rebuild the history table while a visit is being edited — it would destroy the edit row
  if (!gs.visitEdit) renderVisitHistory();
}

// ── Last 3 visits for a side inside the score panel ───
function renderRecentVisits(side) {
  const gs  = gameState;
  const el  = document.getElementById(`sc-recent-${side}`);
  if (!el) return;
  const legVisits = [];
  gs.players.filter(p => p.side === side).forEach(p =>
    p.visits.filter(v => v.leg === gs.currentLeg).forEach(v => legVisits.push(v))
  );
  legVisits.sort((a, b) => b.seq - a.seq);
  el.innerHTML = legVisits.slice(0, 3).map(v =>
    v.wasBust
      ? `<span class="sc-recent-item" style="color:var(--danger)">BUST</span>`
      : `<span class="sc-recent-item">${v.scored}</span>`
  ).join('');
}

// ── Visit history: 5-column table (2-sided) or simple list (3+ team training) ─
function renderVisitHistory() {
  const gs = gameState;
  const el = document.getElementById('sc-history');
  if (!el) return;

  // ── N-column table for 3-or-4-team training ─────────────────────
  if (gs.mode === 'training' && gs.numTeams > 2) {
    el.style.background = '';
    const cp         = gs.players[gs.currentPlayerIndex];
    const N          = gs.numTeams;
    const cols       = `repeat(${N},1fr)`;
    const startScore = gs.startingScore;

    // For each team: current-leg visits sorted chronologically
    const teamVisits = gs.teams.map(team => {
      const vis = [];
      gs.players.forEach((p, pi) => {
        if (p.side !== team.side) return;
        p.visits
          .filter(v => v.leg === gs.currentLeg)
          .forEach((v, vi) => vis.push({ p, pi, v, vi }));
      });
      vis.sort((a, b) => a.v.seq - b.v.seq);
      return vis;
    });

    const rounds = teamVisits.reduce((m, tv) => Math.max(m, tv.length), 0);

    // Header row + starting-score row
    let html = `
      <div class="sc-mtr-head" style="display:grid;grid-template-columns:${cols};">
        ${gs.teams.map(t => `<div>${escHtml(t.name)}</div>`).join('')}
      </div>
      <div class="sc-tbl-row sc-tbl-start" style="display:grid;grid-template-columns:${cols};">
        ${gs.teams.map(() => `<div class="sc-mtr-cell"><span>${startScore}</span></div>`).join('')}
      </div>`;

    // One row per round
    for (let i = 0; i < rounds; i++) {
      const cells = gs.teams.map((team, ti) => {
        const entry = teamVisits[ti][i];
        if (!entry) return `<div class="sc-mtr-cell"></div>`;
        const { pi, vi, v } = entry;
        if (v.wasBust) {
          return `<div class="sc-mtr-cell" data-pi="${pi}" data-vi="${vi}">` +
                 `<span class="sc-mtr-bust">BUST</span>` +
                 `<span class="sc-mtr-rem sc-mtr-dim">${v.remaining}</span></div>`;
        }
        return `<div class="sc-mtr-cell" data-pi="${pi}" data-vi="${vi}">` +
               `<span class="sc-mtr-scored">${v.scored}</span>` +
               `<span class="sc-mtr-rem">${v.remaining}</span></div>`;
      }).join('');
      html += `\n      <div class="sc-tbl-row" style="display:grid;grid-template-columns:${cols};">${cells}</div>`;
    }

    // Pending input row (active team's column only)
    if (cp && gs.currentInput) {
      const cells = gs.teams.map(team => {
        const active = cp.side === team.side;
        return active
          ? `<div class="sc-mtr-cell sc-mtr-pending"><span class="sc-mtr-input">${escHtml(gs.currentInput)}</span></div>`
          : `<div class="sc-mtr-cell"></div>`;
      }).join('');
      html += `\n      <div class="sc-tbl-row sc-tbl-pending" style="display:grid;grid-template-columns:${cols};">${cells}</div>`;
    }

    el.innerHTML = html;

    // Click a cell → inline edit (replaces the whole row, same as 5-col table)
    el.querySelectorAll('.sc-tbl-row:not(.sc-tbl-start):not(.sc-tbl-pending)').forEach(rowEl => {
      rowEl.querySelectorAll('.sc-mtr-cell[data-pi]').forEach(cell => {
        cell.addEventListener('click', () => {
          activateVisitEdit(rowEl, +cell.dataset.pi, +cell.dataset.vi);
        });
      });
    });

    el.scrollTop = el.scrollHeight;
    return;
  }

  // ── 5-column table for match mode and 2-team training ──────────────
  // Determine the two sides: match uses home/away, 2-team training uses t0/t1
  const leftSide  = gs.mode === 'training' ? 't0' : 'home';
  const rightSide = gs.mode === 'training' ? 't1' : 'away';

  el.style.background = '';
  const cp  = gs.players[gs.currentPlayerIndex];
  const fmt = gs.format;
  const startScore = fmt ? fmt.score : gs.startingScore;

  // Separate left and right visits, sorted chronologically
  const leftVisits  = [];
  const rightVisits = [];
  gs.players.forEach((p, pi) => {
    p.visits.filter(v => v.leg === gs.currentLeg).forEach((v, vi) => {
      if      (p.side === leftSide)  leftVisits.push({ p, pi, v, vi });
      else if (p.side === rightSide) rightVisits.push({ p, pi, v, vi });
    });
  });
  leftVisits.sort((a, b)  => a.v.seq - b.v.seq);
  rightVisits.sort((a, b) => a.v.seq - b.v.seq);

  const leftLen    = leftVisits.length;
  const rightLen   = rightVisits.length;
  const inputText  = gs.currentInput;
  const showPending = !!(cp && inputText);
  const pendingLeft = cp ? cp.side === leftSide : false;
  let rounds = Math.max(leftLen, rightLen);
  if (showPending) {
    const ps = pendingLeft ? leftLen : rightLen;
    const os = pendingLeft ? rightLen : leftLen;
    if (ps >= os) rounds = Math.max(rounds, ps + 1);
  }

  // Header + starting row
  let html = `
    <div class="sc-tbl-head">
      <div class="sc-tbl-c1">Scored</div>
      <div class="sc-tbl-c2">To Go</div>
      <div class="sc-tbl-c3">#</div>
      <div class="sc-tbl-c4">Scored</div>
      <div class="sc-tbl-c5">To Go</div>
    </div>
    <div class="sc-tbl-row sc-tbl-start">
      <div class="sc-tbl-c1"></div>
      <div class="sc-tbl-c2">${startScore}</div>
      <div class="sc-tbl-c3">&mdash;</div>
      <div class="sc-tbl-c4"></div>
      <div class="sc-tbl-c5">${startScore}</div>
    </div>`;

  // One row per round; pending input is inlined into the correct slot
  for (let i = 0; i < rounds; i++) {
    const lv = leftVisits[i];
    const rv = rightVisits[i];
    const lPendHere = showPending && pendingLeft  && !lv && i === leftLen;
    const rPendHere = showPending && !pendingLeft && !rv && i === rightLen;
    const isPending = lPendHere || rPendHere;
    const c1 = lv ? (lv.v.wasBust ? 'BUST' : String(lv.v.scored)) : (lPendHere ? escHtml(inputText) : '');
    const c2 = lv ? String(lv.v.remaining) : '';
    const c4 = rv ? (rv.v.wasBust ? 'BUST' : String(rv.v.scored)) : (rPendHere ? escHtml(inputText) : '');
    const c5 = rv ? String(rv.v.remaining) : '';
    const lPi = lv ? lv.pi : -1, lVi = lv ? lv.vi : -1;
    const rPi = rv ? rv.pi : -1, rVi = rv ? rv.vi : -1;
    html += `
      <div class="sc-tbl-row${isPending ? ' sc-tbl-pending' : ''}" data-pi="${lPi}" data-vi="${lVi}" data-api="${rPi}" data-avi="${rVi}">
        <div class="sc-tbl-c1${lv && lv.v.wasBust ? ' sc-tbl-bust' : ''}${lPendHere ? ' sc-tbl-pending-cell' : ''}">${c1}</div>
        <div class="sc-tbl-c2${lPendHere ? ' sc-tbl-pending-cell' : ''}">${escHtml(c2)}</div>
        <div class="sc-tbl-c3">${isPending ? '&#9658;' : (i + 1) * 3}</div>
        <div class="sc-tbl-c4${rv && rv.v.wasBust ? ' sc-tbl-bust' : ''}${rPendHere ? ' sc-tbl-pending-cell' : ''}">${c4}</div>
        <div class="sc-tbl-c5${rPendHere ? ' sc-tbl-pending-cell' : ''}">${escHtml(c5)}</div>
      </div>`;
  }

  el.innerHTML = html;

  // Click left cells → edit left visit; click right cells → edit right visit
  el.querySelectorAll('.sc-tbl-row:not(.sc-tbl-start):not(.sc-tbl-pending)').forEach(row => {
    const lPi = +row.dataset.pi,  lVi = +row.dataset.vi;
    const rPi = +row.dataset.api, rVi = +row.dataset.avi;
    row.querySelectorAll('.sc-tbl-c1,.sc-tbl-c2').forEach(cell => {
      cell.addEventListener('click', e => {
        if (lPi >= 0 && lVi >= 0) { e.stopPropagation(); activateVisitEdit(row, lPi, lVi); }
      });
    });
    row.querySelectorAll('.sc-tbl-c4,.sc-tbl-c5').forEach(cell => {
      cell.addEventListener('click', e => {
        if (rPi >= 0 && rVi >= 0) { e.stopPropagation(); activateVisitEdit(row, rPi, rVi); }
      });
    });
  });

  el.scrollTop = el.scrollHeight;
}

// ── Bind numpad (fresh element each renderScoringScreen) ─
function bindNumpad() {
  const grid = document.getElementById('sc-numpad');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-sc-val]');
    if (btn) handleNumpadInput(btn.dataset.scVal);
  });

  // Flash feedback — covers both #sc-numpad and .sc-action-row buttons.
  // touchstart fires immediately on iOS; click handles desktop/mouse.
  // A flag prevents double-flash when both events fire on the same tap.
  const area = grid.closest('.sc-numpad-area');
  if (!area) return;
  let flashPending = false;
  function flashBtn(btn) {
    if (!btn) return;
    flashPending = true;
    btn.classList.add('numpad-flash');
    setTimeout(() => { btn.classList.remove('numpad-flash'); flashPending = false; }, 150);
  }
  area.addEventListener('touchstart', e => {
    flashBtn(e.target.closest('.numpad-btn'));
  }, { passive: true });
  area.addEventListener('click', e => {
    if (flashPending) return; // already flashed via touchstart
    flashBtn(e.target.closest('.numpad-btn'));
  });
}

// ── Numpad input handler ──────────────────────────────
function handleNumpadInput(val) {
  const gs = gameState;
  if (gs.flashMsg) return;

  // ── Visit edit mode: route all numpad input to the editor ──
  if (gs.visitEdit) {
    if (val === 'confirm') { commitVisitEdit(); return; }
    if (val === 'undo')    { cancelVisitEdit(); return; }
    if (val === 'bust')    { gs.visitEdit.value = ''; gs.visitEdit.fresh = false; updateEditDisplay(); return; }
    if (val === 'del') {
      gs.visitEdit.value = gs.visitEdit.fresh ? '' : gs.visitEdit.value.slice(0, -1);
      gs.visitEdit.fresh = false;
      updateEditDisplay();
      return;
    }
    // Digit — first keypress clears the pre-filled value and starts fresh
    const candidate = gs.visitEdit.fresh ? val : gs.visitEdit.value + val;
    gs.visitEdit.fresh = false;
    const parsed    = parseInt(candidate, 10);
    if (isNaN(parsed) || parsed > 180) return;
    gs.visitEdit.value = candidate;
    updateEditDisplay();
    return;
  }

  if (val === 'del') {
    gs.currentInput = gs.currentInput.slice(0, -1);
    renderScoringUI();
    return;
  }
  if (val === 'bust') {
    const cp = gs.players[gs.currentPlayerIndex];
    if (cp) { gs.currentInput = ''; triggerBust(cp); }
    return;
  }
  if (val === 'undo') {
    showUndoConfirm();
    return;
  }
  if (val === 'confirm') {
    const raw = gs.currentInput;
    gs.currentInput = '';
    const score = parseInt(raw, 10);
    if (isNaN(score) || score < 0) { renderScoringUI(); return; }
    processVisit(score);
    return;
  }
  // Digit
  const candidate = gs.currentInput + val;
  if (parseInt(candidate, 10) > 180) return;
  gs.currentInput = candidate;
  renderScoringUI();
}

// ── Process a confirmed score ─────────────────────────
function processVisit(score) {
  const gs  = gameState;
  const cp  = gs.players[gs.currentPlayerIndex];
  if (!cp) return;

  const rem    = gs.sideScores[cp.side];
  const newRem = rem - score;

  // Bust: negative or stranded on 1
  if (newRem < 0 || newRem === 1) { triggerBust(cp); return; }

  cp.visits.push({ scored: score, wasBust: false, leg: gs.currentLeg, seq: ++gs.visitSeq, remaining: newRem });
  gs.sideScores[cp.side] = newRem;

  if (newRem === 0) {
    handleLegWin(cp.side);
  } else {
    advanceTurn();
    renderScoringUI();
  }
}

// ── Bust ─────────────────────────────────────────────
function triggerBust(player) {
  const gs  = gameState;
  const rem = gs.sideScores[player.side];
  player.visits.push({ scored: 0, wasBust: true, leg: gs.currentLeg, seq: ++gs.visitSeq, remaining: rem });

  gs.flashMsg     = { text: 'BUST!', cls: 'bust-flash' };
  gs.currentInput = '';
  renderScoringUI();

  if (gs.flashTimer) clearTimeout(gs.flashTimer);
  gs.flashTimer = setTimeout(() => {
    gs.flashMsg   = null;
    gs.flashTimer = null;
    advanceTurn();
    renderScoringUI();
  }, 1500);
}

// ── Advance turn ──────────────────────────────────────
function advanceTurn() {
  const gs = gameState;
  gs.currentPlayerIndex = (gs.currentPlayerIndex + 1) % gs.players.length;
}

// ── Leg win logic ─────────────────────────────────────
function handleLegWin(winningSide) {
  const gs  = gameState;
  const fmt = gs.format;

  if (fmt.legs === 1) {
    recordGameWinner(winningSide);
    return;
  }

  gs.legsWon[winningSide]++;
  if (gs.legsWon[winningSide] >= Math.ceil(fmt.legs / 2)) {
    recordGameWinner(winningSide);
  } else {
    startNewLeg();
  }
}

// ── New leg ───────────────────────────────────────────
function startNewLeg() {
  const gs     = gameState;
  gs.currentLeg++;
  gs.sideScores = { home: gs.startingScore, away: gs.startingScore };

  // Alternate first throw each leg
  const legFirst = (gs.currentLeg % 2 === 1)
    ? gs.whoThrowsFirst
    : (gs.whoThrowsFirst === 'home' ? 'away' : 'home');
  const idx = gs.players.findIndex(p => p.side === legFirst);
  gs.currentPlayerIndex = idx >= 0 ? idx : 0;

  gs.flashMsg = { text: `LEG ${gs.currentLeg}`, cls: 'leg-flash' };
  renderScoringUI();

  if (gs.flashTimer) clearTimeout(gs.flashTimer);
  gs.flashTimer = setTimeout(() => {
    gs.flashMsg   = null;
    gs.flashTimer = null;
    renderScoringUI();
  }, 1800);
}

// ── Record game winner, update points, go to stats ───
function recordGameWinner(side) {
  const game = matchState.games[matchState.currentGame - 1];
  if (!game || game.winner) return;   // strict guard — must be absolute first check
  game.winner = side;
  if (side === 'home') matchState.points.home++;
  else matchState.points.away++;
  renderStatsScreen(side);
  navigateTo('screen-stats');
}

// ── Undo confirmation popup ───────────────────────────
function showUndoConfirm() {
  let popup = document.getElementById('undo-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id        = 'undo-popup';
    popup.className = 'undo-popup-overlay';
    popup.innerHTML =
      `<div class="undo-popup-box">` +
      `<div class="undo-popup-title">Undo last score?</div>` +
      `<div class="undo-popup-btns">` +
      `<button class="undo-popup-yes" id="undo-yes">Yes, Undo</button>` +
      `<button class="undo-popup-no"  id="undo-no">Cancel</button>` +
      `</div></div>`;
    document.body.appendChild(popup);
    document.getElementById('undo-yes').addEventListener('click', () => {
      hideUndoConfirm(); undoLastVisit();
    });
    document.getElementById('undo-no').addEventListener('click', hideUndoConfirm);
    popup.addEventListener('click', e => { if (e.target === popup) hideUndoConfirm(); });
  }
  popup.style.display = 'flex';
}

function hideUndoConfirm() {
  const popup = document.getElementById('undo-popup');
  if (popup) popup.style.display = 'none';
}

// ── Undo last visit ───────────────────────────────────
function undoLastVisit() {
  const gs = gameState;
  let maxSeq = -1, tPi = -1, tVi = -1;

  gs.players.forEach((p, pi) =>
    p.visits.forEach((v, vi) => {
      if (v.leg === gs.currentLeg && v.seq > maxSeq) {
        maxSeq = v.seq; tPi = pi; tVi = vi;
      }
    })
  );

  if (tPi < 0) return;
  gs.players[tPi].visits.splice(tVi, 1);
  if (gs.visitSeq > 0) gs.visitSeq--;
  Object.keys(gs.sideScores).forEach(side => recalcSideScore(side));
  gs.currentPlayerIndex = tPi;

  // Restore training turn-tracking state so the next advanceTurn
  // correctly continues from the player who just had their visit undone.
  if (gs.mode === 'training' && gs.trTeamPlayers) {
    const side = gs.players[tPi].side;            // 't0', 't1', …
    const ti   = parseInt(side.slice(1), 10);
    gs.trTeamTurn = ti;
    const posInTeam = gs.trTeamPlayers[ti].indexOf(tPi);
    if (posInTeam >= 0) gs.trTeamPlayerOffset[ti] = posInTeam;
  }

  gs.currentInput = '';
  renderScoringUI();
}

// ── Recalculate remaining scores from visit history ───
function recalcSideScore(side) {
  const gs      = gameState;
  const players = gs.players.filter(p => p.side === side);

  // Collect all current-leg visits, sort chronologically
  const all = [];
  players.forEach(p =>
    p.visits.filter(v => v.leg === gs.currentLeg).forEach(v => all.push(v))
  );
  all.sort((a, b) => a.seq - b.seq);

  let rem = gs.startingScore;
  all.forEach(v => {
    if (!v.wasBust) rem -= v.scored;
    v.remaining = rem; // Bust visits also reflect current remaining at time of throw
  });
  gs.sideScores[side] = rem;
}

// ── Inline visit editing (keyboard-free — uses on-screen numpad) ─
function activateVisitEdit(row, pi, vi) {
  const gs    = gameState;
  const visit = gs.players[pi] && gs.players[pi].visits[vi];
  if (!visit) return;

  // Store edit state; numpad routes here while this is set
  // fresh=true: first digit pressed clears the old value before appending
  gs.visitEdit = { pi, vi, value: visit.wasBust ? '' : String(visit.scored), fresh: true };

  // Determine which half of the table this visit belongs to (left or right)
  const leftSide = gs.mode === 'training' ? 't0' : 'home';
  const isLeft   = gs.players[pi].side === leftSide;

  // Build the edit controls inline — readonly+inputmode=none keeps iOS keyboard closed
  const editControls =
    `<div style="display:flex;align-items:center;gap:3px;padding:2px 4px;">` +
    `<input id="sc-visit-edit-inp" type="text" readonly inputmode="none"` +
    ` value="${gs.visitEdit.value}" placeholder="0–180"` +
    ` style="flex:1;min-width:0;background:#333;color:#fff;border:1px solid var(--accent);border-radius:6px;padding:3px 6px;font-size:13px;"/>` +
    `<button class="sc-edit-save" style="padding:3px 8px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:var(--accent);color:#fff;">&#10003;</button>` +
    `<button class="sc-edit-cancel" style="padding:3px 8px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:#555;color:#fff;">&#10005;</button>` +
    `</div>`;

  // Edit row uses the same grid as sc-tbl-row; controls span only the active side's columns
  const editHtml =
    `<div class="sc-tbl-row sc-history-edit-row" id="sc-visit-edit-row" data-pi="${pi}" data-vi="${vi}">` +
    (isLeft
      ? `<div style="grid-column:1/3;">${editControls}</div><div class="sc-tbl-c3">&#9998;</div><div style="grid-column:4/6;"></div>`
      : `<div style="grid-column:1/3;"></div><div class="sc-tbl-c3">&#9998;</div><div style="grid-column:4/6;">${editControls}</div>`) +
    `</div>`;

  row.outerHTML = editHtml;

  const histEl = document.getElementById('sc-history');
  if (!histEl) return;
  const editRow = document.getElementById('sc-visit-edit-row');
  if (!editRow) return;

  editRow.querySelector('.sc-edit-save').addEventListener('click',   () => commitVisitEdit());
  editRow.querySelector('.sc-edit-cancel').addEventListener('click', () => cancelVisitEdit());

  // Tap outside the edit row → cancel (delayed one tick so this tap doesn't self-cancel)
  histEl._editOutsideHandler = e => {
    if (!editRow.contains(e.target)) cancelVisitEdit();
  };
  setTimeout(() => histEl.addEventListener('click', histEl._editOutsideHandler), 0);

  updateEditDisplay();
}

// ── Visit edit helpers ────────────────────────────────
// Update the edit row input + numpad label/value without rebuilding the table
function updateEditDisplay() {
  const gs  = gameState;
  const ed  = gs.visitEdit;
  const inp = document.getElementById('sc-visit-edit-inp');
  if (inp) inp.value = ed ? ed.value : '';
  const ilEl = document.getElementById('sc-input-label');
  const ivEl = document.getElementById('sc-input-val');
  if (ilEl) ilEl.textContent = 'Editing visit';
  if (ivEl) { ivEl.textContent = (ed && ed.value) ? ed.value : '—'; ivEl.className = 'sc-input-val'; }
}

function commitVisitEdit() {
  const gs    = gameState;
  const ed    = gs.visitEdit;
  if (!ed) return;
  const visit = gs.players[ed.pi] && gs.players[ed.pi].visits[ed.vi];
  if (!visit) { cancelVisitEdit(); return; }
  const raw = ed.value.trim();
  if (raw === '') {
    visit.scored = 0; visit.wasBust = true;
  } else {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0 || n > 180) {
      const inp = document.getElementById('sc-visit-edit-inp');
      if (inp) { inp.style.borderColor = 'var(--danger)'; setTimeout(() => { inp.style.borderColor = ''; }, 800); }
      return;
    }
    visit.scored = n; visit.wasBust = false;
  }
  gs.visitEdit = null;
  cleanEditOutsideHandler();
  Object.keys(gs.sideScores).forEach(side => recalcSideScore(side));
  renderScoringUI();
}

function cancelVisitEdit() {
  gameState.visitEdit = null;
  cleanEditOutsideHandler();
  renderScoringUI();
}

function cleanEditOutsideHandler() {
  const histEl = document.getElementById('sc-history');
  if (histEl && histEl._editOutsideHandler) {
    histEl.removeEventListener('click', histEl._editOutsideHandler);
    histEl._editOutsideHandler = null;
  }
}

// ── Populate stats screen ─────────────────────────────
function renderStatsScreen(winningSide) {
  const gs       = gameState;
  const homeTeam = matchState.homeTeam || 'PHD';
  const awayTeam = matchState.awayTeam || 'Opponents';

  function sideStats(side) {
    const allVisits = [];
    gs.players.filter(p => p.side === side).forEach(p => p.visits.forEach(v => allVisits.push(v)));
    const scored = allVisits.filter(v => !v.wasBust);
    const total  = scored.reduce((s, v) => s + v.scored, 0);
    const visits = scored.length;
    const avg    = visits > 0 ? (total / visits).toFixed(1) : '—';
    const high   = visits > 0 ? Math.max(...scored.map(v => v.scored)) : 0;
    const c100   = scored.filter(v => v.scored >= 100 && v.scored < 180).length;
    const c180   = scored.filter(v => v.scored === 180).length;
    const darts  = visits * 3;
    return { avg, high, c100, c180, darts };
  }

  const hs = sideStats('home');
  const as = sideStats('away');
  const winnerName = winningSide === 'home' ? homeTeam : awayTeam;

  // Winner banner
  const wnEl = document.querySelector('.stats-winner-name');
  const wsEl = document.querySelector('.stats-winner-sub');
  if (wnEl) wnEl.textContent = winnerName + ' Win!';
  if (wsEl) wsEl.textContent = `Match points: ${matchState.points.home}–${matchState.points.away}`;

  // Legs / match-points cards
  const cards = document.querySelectorAll('.flex-row .card');
  if (cards[0]) cards[0].innerHTML = `<div style="font-size:11px;color:var(--text-muted)">LEGS</div><div style="font-size:24px;font-weight:800">${gs.legsWon.home}–${gs.legsWon.away}</div>`;
  if (cards[1]) cards[1].innerHTML = `<div style="font-size:11px;color:var(--text-muted)">MATCH PTS</div><div style="font-size:24px;font-weight:800">${matchState.points.home}–${matchState.points.away}</div>`;

  // Stats table
  const tbl = document.querySelector('.stats-table');
  if (tbl) {
    tbl.innerHTML = `
      <thead><tr><th>Stat</th><th>${escHtml(homeTeam)}</th><th>${escHtml(awayTeam)}</th></tr></thead>
      <tbody>
        <tr><td>3-dart Avg</td><td>${hs.avg}</td><td>${as.avg}</td></tr>
        <tr><td>Highest Visit</td><td>${hs.high}</td><td>${as.high}</td></tr>
        <tr><td>100+</td><td>${hs.c100}</td><td>${as.c100}</td></tr>
        <tr><td>180s</td><td>${hs.c180}</td><td>${as.c180}</td></tr>
        <tr><td>Darts Thrown</td><td>${hs.darts}</td><td>${as.darts}</td></tr>
      </tbody>`;
  }

  // Hide checkout highlight (honour system — no dart-by-dart tracking)
  const cho = document.querySelector('.checkout-highlight');
  if (cho) cho.style.display = 'none';
}

// ── Stats screen button wiring (once) ────────────────
(function bindStatsButtons() {
  const nextBtn   = document.getElementById('btn-next-game');
  const finishBtn = document.getElementById('btn-finish-match');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      matchState.currentGame++;
      if (matchState.currentGame > 9) {
        navigateTo('screen-home');
        return;
      }
      phdSelected = [];
      renderGameSetup();
      navigateTo('screen-game-setup');
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', () => navigateTo('screen-home'));
  }
}());

/* ══════════════════════════════════════════════════════
   PHASE 5 — TRAINING MODE + MATCH HISTORY + AUTO-SAVE
══════════════════════════════════════════════════════ */

// ── Storage keys ──────────────────────────────────────
const MATCH_HISTORY_KEY    = 'phd_match_history';
const TRAINING_HISTORY_KEY = 'phd_training_history';

// ── CSS for Phase 5 components ────────────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = [
    // Training screen layout
    '#screen-training{padding:20px 16px;gap:16px;}',
    '#screen-training-stats{padding:20px 16px;gap:16px;}',
    // Roster grid (training)
    '.tr-roster-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
    '.tr-roster-btn{background:var(--bg-raised);border:2px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:Arial,sans-serif;font-weight:700;font-size:0.85rem;padding:10px 6px;cursor:pointer;text-align:center;min-height:48px;-webkit-tap-highlight-color:transparent;line-height:1.2;transition:background 0.12s,border-color 0.12s;}',
    '.tr-roster-btn.tr-selected{background:var(--accent);border-color:var(--accent);color:#fff;}',
    // Player list (training)
    '.tr-player-list{display:flex;flex-direction:column;gap:6px;}',
    '.tr-player-row{display:flex;align-items:center;gap:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:0.9rem;}',
    '.tr-num{color:var(--text-muted);font-size:0.75rem;min-width:18px;font-family:Arial,sans-serif;}',
    '.tr-remove-btn{background:none;border:none;color:var(--danger);cursor:pointer;font-size:1.1rem;padding:4px 6px;line-height:1;margin-left:auto;}',
    // Throw-first selector
    '.tr-throw-grid{display:flex;flex-wrap:wrap;gap:8px;}',
    '.tr-throw-btn{background:var(--bg-raised);border:2px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:Arial,sans-serif;font-weight:700;font-size:0.85rem;padding:10px 16px;cursor:pointer;min-height:48px;-webkit-tap-highlight-color:transparent;transition:background 0.12s,border-color 0.12s;}',
    '.tr-throw-btn.tr-selected{background:var(--accent);border-color:var(--accent);color:#fff;}',
    // Leg format selector (Best of / First to — 2 columns)
    '.tr-fmt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
    // Score preset buttons
    '.tr-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}',
    '.tr-score-btn{background:var(--bg-raised);border:2px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:Arial,sans-serif;font-weight:700;font-size:1rem;padding:10px 6px;cursor:pointer;text-align:center;min-height:56px;-webkit-tap-highlight-color:transparent;line-height:1.2;transition:background 0.12s,border-color 0.12s;}',
    '.tr-score-btn.tr-score-sel{background:var(--accent);border-color:var(--accent);color:#fff;}',
    // History expand rows
    '.hm-expand{display:none;padding:0 14px 12px;}',
    '.hm-expand.open{display:block;}',
    '.hm-game-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);gap:10px;}',
    '.hm-game-row:last-child{border-bottom:none;}',
    '.hm-game-label{font-size:0.75rem;color:var(--text-muted);font-family:Arial,sans-serif;min-width:70px;}',
    '.hm-game-winner{font-size:0.85rem;color:var(--accent);font-weight:700;}',
    '.hm-game-players{font-size:0.7rem;color:var(--text-muted);font-family:Arial,sans-serif;text-align:right;flex:1;}',
    '.hm-del-btn{background:none;border:1px solid var(--danger);color:var(--danger);border-radius:6px;padding:3px 10px;font-size:0.75rem;cursor:pointer;font-family:Arial,sans-serif;white-space:nowrap;}',
    // Multi-team training setup
    '.tr-team-card{background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-lg);padding:14px;display:flex;flex-direction:column;gap:10px;}',
    '.tr-num-teams-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
    // Training score bar: N panels side by side
    '.sc-train-bar{display:flex;flex-shrink:0;height:150px;width:100%;background:#0a0a0a;border-top:2px solid var(--border);overflow:hidden;}',
    '.sc-train-panel{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:5px 4px;border-right:1px solid var(--border);min-width:0;overflow:hidden;transition:background 0.2s;}',
    '.sc-train-panel:last-child{border-right:none;}',
    '.sc-train-panel.active-turn{background:rgba(232,82,10,0.08);border-bottom:3px solid var(--accent);}',
    '.sc-train-panel .score-team{font-size:0.7rem;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;text-align:center;word-break:break-word;max-width:100%;flex-shrink:0;}',
    '.sc-train-panel .score-remaining{flex:1;display:flex;align-items:center;justify-content:center;font-size:min(5rem,22vw);font-weight:900;color:var(--text);line-height:1;text-align:center;}',
    '.sc-train-panel.active-turn .score-remaining{color:var(--accent);}',
    '.sc-train-panel .score-players{font-size:0.7rem;text-align:center;color:var(--text-dim);line-height:1.4;min-height:14px;max-width:100%;overflow:hidden;flex-shrink:0;}',
    '.sc-train-panel .sc-recent{font-size:10px;color:var(--text-muted);text-align:center;margin-top:2px;min-height:12px;}',
    '.sc-train-bar.teams-3 .score-remaining,.sc-train-bar.teams-4 .score-remaining{font-size:min(2rem,11vw);}',
    '.sc-train-bar.teams-4 .score-team{font-size:0.5rem;}',
    // Multi-team training table: one column per team
    '.sc-mtr-head{background:#1e1e1e;border-bottom:2px solid #333;position:sticky;top:0;z-index:2;}',
    '.sc-mtr-head>div{padding:3px 6px;font-size:9px;font-weight:700;color:#888;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;border-right:1px solid #333;}',
    '.sc-mtr-head>div:last-child{border-right:none;}',
    '.sc-mtr-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40px;border-right:1px solid #333;}',
    '.sc-mtr-cell:last-child{border-right:none;}',
    '.sc-mtr-scored{font-size:10px;color:#999;font-family:Arial,sans-serif;}',
    '.sc-mtr-rem{font-size:18px;font-weight:900;color:#fff;font-family:"Arial Black",Arial,sans-serif;line-height:1;}',
    '.sc-mtr-dim{color:#666!important;}',
    '.sc-mtr-bust{font-size:10px;font-weight:700;color:var(--danger);}',
    '.sc-mtr-pending{background:rgba(232,82,10,0.12)!important;border-bottom:2px solid var(--accent)!important;}',
    '.sc-mtr-input{font-size:18px;font-weight:900;color:var(--accent);font-family:"Arial Black",Arial,sans-serif;line-height:1;}',
    // 3-4 team training: table-dominant layout — same proportions as 2-team (override old compact overrides)
    '#screen-scoring.sc-multi-training .sc-table-wrap{flex:1!important;max-height:none!important;min-height:0!important;}',
    '#screen-scoring.sc-multi-training .sc-train-bar{flex:none!important;flex-shrink:0!important;height:150px!important;}',
    // Checkout suggestion
    '.tr-checkout-hint{font-size:11px;font-weight:700;color:var(--accent);font-family:Arial,sans-serif;text-align:center;min-height:14px;line-height:1.3;letter-spacing:0.5px;padding:1px 0;}',
    '.tr-checkout-toggle{background:#1a1a1a;border:1px solid #555;border-radius:6px;color:#888;font-size:11px;font-weight:700;padding:4px 10px;cursor:pointer;font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;letter-spacing:0.5px;white-space:nowrap;flex-shrink:0;}',
    '.tr-checkout-toggle.active{border-color:var(--accent);color:var(--accent);}',
  ].join('');
  document.head.appendChild(s);
}());

// ── Training state ────────────────────────────────────
const trainingState = {
  startingScore: 501,
  legs:          1,
  legFormat:     'bestof',   // 'bestof' | 'firstto'
  teams:         [],   // [{name, players:[]}]  committed on startTraining
  firstTeamIdx:  0,
};

// Working vars for training setup form
let trNumTeams    = 2;
let trTeams       = [
  { name: 'Team 1', players: [] },
  { name: 'Team 2', players: [] },
  { name: 'Team 3', players: [] },
  { name: 'Team 4', players: [] },
];
let trFirstTeamIdx = null;   // index into trTeams (0-based)
let trScore        = 501;
let trLegFormat    = 'bestof'; // 'bestof' | 'firstto'
let trLegs         = 1;

// ── Training setup screen render ──────────────────────
function renderTrainingSetup() {
  const scr = document.getElementById('screen-training');
  if (!scr) return;

  scr.innerHTML = `
    <div>
      <div class="page-title">Training</div>
      <div class="page-subtitle">Set up a practice game</div>
    </div>

    <div class="form-group">
      <label class="form-label">Starting Score</label>
      <div class="tr-score-grid" id="tr-score-grid">
        <button class="tr-score-btn" data-score="121">121</button>
        <button class="tr-score-btn" data-score="301">301</button>
        <button class="tr-score-btn tr-score-sel" data-score="501">501</button>
        <button class="tr-score-btn" data-score="custom">Custom</button>
      </div>
      <input class="form-input" id="tr-custom-score" type="number" min="101" max="9999"
             inputmode="numeric" placeholder="Enter score (min 101)"
             style="display:none;margin-top:8px;"/>
    </div>

    <div class="form-group">
      <label class="form-label">Legs — Format</label>
      <div class="tr-fmt-grid" id="tr-fmt-grid">
        <button class="tr-score-btn tr-score-sel" data-fmt="bestof">Best of</button>
        <button class="tr-score-btn" data-fmt="firstto">First to</button>
      </div>
      <div class="tr-score-grid" id="tr-legs-grid" style="margin-top:8px;">
        <button class="tr-score-btn tr-score-sel" data-legs="1">1</button>
        <button class="tr-score-btn" data-legs="3">3</button>
        <button class="tr-score-btn" data-legs="5">5</button>
        <button class="tr-score-btn" data-legs="7">7</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Number of Teams</label>
      <div class="tr-num-teams-grid" id="tr-num-teams-grid">
        <button class="tr-score-btn tr-score-sel" data-num-teams="2">2 Teams</button>
        <button class="tr-score-btn" data-num-teams="3">3 Teams</button>
        <button class="tr-score-btn" data-num-teams="4">4 Teams</button>
      </div>
    </div>

    <div id="tr-teams-container"></div>

    <div class="form-group" id="tr-throw-group" style="display:none;">
      <label class="form-label">Who Throws First?</label>
      <div class="tr-throw-grid" id="tr-throw-grid"></div>
    </div>

    <div class="mt-auto">
      <button class="btn btn-primary" id="tr-start-btn">
        &#127985;&nbsp; Start Training
      </button>
    </div>`;

  // Reset working state
  trNumTeams    = 2;
  trTeams       = [
    { name: 'Team 1', players: [] },
    { name: 'Team 2', players: [] },
    { name: 'Team 3', players: [] },
    { name: 'Team 4', players: [] },
  ];
  trFirstTeamIdx = null;
  trScore        = 501;
  trLegFormat    = 'bestof';
  trLegs         = 1;

  renderTeamsContainer();
  attachTrainingSetupListeners();
}

function attachTrainingSetupListeners() {
  // Score preset buttons
  const scoreGrid   = document.getElementById('tr-score-grid');
  const customInput = document.getElementById('tr-custom-score');
  if (scoreGrid) {
    scoreGrid.addEventListener('click', e => {
      const btn = e.target.closest('.tr-score-btn');
      if (!btn) return;
      scoreGrid.querySelectorAll('.tr-score-btn').forEach(b => b.classList.remove('tr-score-sel'));
      btn.classList.add('tr-score-sel');
      if (btn.dataset.score === 'custom') {
        customInput.style.display = '';
        customInput.focus();
        trScore = parseInt(customInput.value, 10) || 0;
      } else {
        customInput.style.display = 'none';
        trScore = parseInt(btn.dataset.score, 10);
      }
    });
    customInput.addEventListener('input', () => {
      trScore = parseInt(customInput.value, 10) || 0;
    });
  }

  // Number of teams buttons
  const numTeamsGrid = document.getElementById('tr-num-teams-grid');
  if (numTeamsGrid) {
    numTeamsGrid.addEventListener('click', e => {
      const btn = e.target.closest('[data-num-teams]');
      if (!btn) return;
      numTeamsGrid.querySelectorAll('[data-num-teams]').forEach(b => b.classList.remove('tr-score-sel'));
      btn.classList.add('tr-score-sel');
      trNumTeams = parseInt(btn.dataset.numTeams, 10);
      // Clamp trFirstTeamIdx to valid range
      if (trFirstTeamIdx !== null && trFirstTeamIdx >= trNumTeams) trFirstTeamIdx = null;
      renderTeamsContainer();
      updateThrowFirstSelector();
    });
  }

  // Leg format buttons (Best of / First to)
  const fmtGrid = document.getElementById('tr-fmt-grid');
  if (fmtGrid) {
    fmtGrid.addEventListener('click', e => {
      const btn = e.target.closest('[data-fmt]');
      if (!btn) return;
      fmtGrid.querySelectorAll('[data-fmt]').forEach(b => b.classList.remove('tr-score-sel'));
      btn.classList.add('tr-score-sel');
      trLegFormat = btn.dataset.fmt;
    });
  }

  // Legs number buttons (1, 3, 5, 7)
  const legsGrid = document.getElementById('tr-legs-grid');
  if (legsGrid) {
    legsGrid.addEventListener('click', e => {
      const btn = e.target.closest('[data-legs]');
      if (!btn) return;
      legsGrid.querySelectorAll('[data-legs]').forEach(b => b.classList.remove('tr-score-sel'));
      btn.classList.add('tr-score-sel');
      trLegs = parseInt(btn.dataset.legs, 10);
    });
  }

  // Start button
  document.getElementById('tr-start-btn').addEventListener('click', startTraining);
}

// ── Build HTML for one team card ──────────────────────
function buildTeamCardHtml(teamIdx) {
  const roster = getPlayers();

  // Names assigned to OTHER active teams (for greying out)
  const otherNames = new Set();
  for (let ti = 0; ti < trNumTeams; ti++) {
    if (ti !== teamIdx) trTeams[ti].players.forEach(n => otherNames.add(n));
  }

  const rosterHtml = roster.length
    ? `<div class="tr-roster-grid" id="tr-roster-grid-${teamIdx}">${
        roster.map(p => {
          const isSel = trTeams[teamIdx].players.includes(p.name);
          const isDis = !isSel && otherNames.has(p.name);
          return `<button class="tr-roster-btn${isSel ? ' tr-selected' : ''}${isDis ? ' disabled' : ''}"
                          data-tr-name="${escHtml(p.name)}"${isDis ? ' disabled' : ''}>
                    ${escHtml(p.name)}
                  </button>`;
        }).join('')
      }</div>`
    : `<p style="font-size:0.8rem;color:var(--text-muted);font-family:Arial,sans-serif;
               text-align:center;padding:4px 0;">No saved roster — add names below.</p>`;

  return `
    <div class="tr-team-card" id="tr-team-card-${teamIdx}">
      <div class="gs-section-label">Team ${teamIdx + 1}</div>
      <input class="form-input" id="tr-team-name-${teamIdx}" type="text"
             value="${escHtml(trTeams[teamIdx].name)}" maxlength="20"
             placeholder="Team name"
             style="min-height:40px;font-family:Arial,sans-serif;font-weight:400;"
             data-team-idx="${teamIdx}"/>
      ${rosterHtml}
      <div style="display:flex;gap:8px;margin-top:4px;">
        <input class="form-input" id="tr-name-input-${teamIdx}" type="text"
               placeholder="Type a name" maxlength="32"
               style="min-height:44px;padding:8px 12px;font-size:0.9rem;
                      font-family:Arial,sans-serif;font-weight:400;"/>
        <button class="btn btn-ghost" data-add-team="${teamIdx}"
                style="flex:0 0 auto;width:48px;min-height:44px;padding:0;
                       font-size:1.3rem;border-radius:var(--radius);">+</button>
      </div>
      <div class="tr-player-list" id="tr-player-list-${teamIdx}"></div>
    </div>`;
}

// ── Render all active team cards into #tr-teams-container ─
function renderTeamsContainer() {
  const container = document.getElementById('tr-teams-container');
  if (!container) return;
  container.innerHTML = Array.from({ length: trNumTeams }, (_, i) => buildTeamCardHtml(i)).join('');
  for (let i = 0; i < trNumTeams; i++) {
    refreshTeamPlayerList(i);
    attachTeamCardListeners(i);
  }
}

// ── Attach listeners to one team card ────────────────
function attachTeamCardListeners(teamIdx) {
  // Team name input
  const nameInp = document.getElementById(`tr-team-name-${teamIdx}`);
  if (nameInp) {
    nameInp.addEventListener('input', () => {
      trTeams[teamIdx].name = nameInp.value.trim() || `Team ${teamIdx + 1}`;
      updateThrowFirstSelector();
    });
  }

  // Roster grid taps
  const rGrid = document.getElementById(`tr-roster-grid-${teamIdx}`);
  if (rGrid) {
    rGrid.addEventListener('click', e => {
      const btn = e.target.closest('.tr-roster-btn');
      if (!btn || btn.disabled) return;
      const name = btn.dataset.trName;
      const idx  = trTeams[teamIdx].players.indexOf(name);
      if (idx !== -1) {
        trTeams[teamIdx].players.splice(idx, 1);
      } else {
        trTeams[teamIdx].players.push(name);
      }
      refreshTeamPlayerList(teamIdx);
      refreshAllRosterGrids();
      updateThrowFirstSelector();
    });
  }

  // Typed name add
  const nameTyped = document.getElementById(`tr-name-input-${teamIdx}`);
  const addBtn    = document.querySelector(`[data-add-team="${teamIdx}"]`);

  function addTypedPlayer() {
    if (!nameTyped) return;
    const name = nameTyped.value.trim();
    if (!name) return;
    if (!trTeams[teamIdx].players.includes(name)) trTeams[teamIdx].players.push(name);
    nameTyped.value = '';
    refreshTeamPlayerList(teamIdx);
    refreshAllRosterGrids();
    updateThrowFirstSelector();
    nameTyped.focus();
  }
  if (addBtn)    addBtn.addEventListener('click', addTypedPlayer);
  if (nameTyped) nameTyped.addEventListener('keydown', e => { if (e.key === 'Enter') addTypedPlayer(); });
}

// ── Refresh one team's player chip list ───────────────
function refreshTeamPlayerList(teamIdx) {
  const listEl = document.getElementById(`tr-player-list-${teamIdx}`);
  if (!listEl) return;
  const players = trTeams[teamIdx].players;
  listEl.innerHTML = players.length
    ? players.map((name, i) =>
        `<div class="tr-player-row">
          <span class="tr-num">${i + 1}.</span>
          <span style="flex:1;">${escHtml(name)}</span>
          <button class="tr-remove-btn" data-team-idx="${teamIdx}" data-rm-idx="${i}" title="Remove">&#10005;</button>
        </div>`
      ).join('')
    : `<p style="font-size:0.8rem;color:var(--text-muted);font-family:Arial,sans-serif;
               text-align:center;padding:4px 0;">No players yet</p>`;

  listEl.querySelectorAll('.tr-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ti = parseInt(btn.dataset.teamIdx, 10);
      const ri = parseInt(btn.dataset.rmIdx, 10);
      trTeams[ti].players.splice(ri, 1);
      refreshTeamPlayerList(ti);
      refreshAllRosterGrids();
      updateThrowFirstSelector();
    });
  });
}

// ── Sync all roster grid button states ────────────────
// Players assigned to a different team are greyed out and disabled.
function refreshAllRosterGrids() {
  for (let i = 0; i < trNumTeams; i++) {
    const grid = document.getElementById(`tr-roster-grid-${i}`);
    if (!grid) continue;
    const otherNames = new Set();
    for (let ti = 0; ti < trNumTeams; ti++) {
      if (ti !== i) trTeams[ti].players.forEach(n => otherNames.add(n));
    }
    grid.querySelectorAll('.tr-roster-btn').forEach(btn => {
      const name  = btn.dataset.trName;
      const isSel = trTeams[i].players.includes(name);
      const isDis = !isSel && otherNames.has(name);
      btn.classList.toggle('tr-selected', isSel);
      btn.classList.toggle('disabled', isDis);
      btn.disabled = isDis;
    });
  }
}

// ── Show/refresh the throw-first team selector ────────
function updateThrowFirstSelector() {
  const throwGroup = document.getElementById('tr-throw-group');
  const throwGrid  = document.getElementById('tr-throw-grid');
  if (!throwGroup || !throwGrid) return;

  // Only show when every active team has at least 1 player
  const allHavePlayers = trTeams.slice(0, trNumTeams).every(t => t.players.length >= 1);
  if (!allHavePlayers) {
    throwGroup.style.display = 'none';
    trFirstTeamIdx = null;
    return;
  }

  if (trFirstTeamIdx !== null && trFirstTeamIdx >= trNumTeams) trFirstTeamIdx = null;
  throwGroup.style.display = '';
  throwGrid.innerHTML = trTeams.slice(0, trNumTeams).map((team, i) =>
    `<button class="tr-throw-btn${trFirstTeamIdx === i ? ' tr-selected' : ''}"
             data-throw-team="${i}">${escHtml(team.name || ('Team ' + (i + 1)))}</button>`
  ).join('');
  throwGrid.querySelectorAll('.tr-throw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      trFirstTeamIdx = parseInt(btn.dataset.throwTeam, 10);
      throwGrid.querySelectorAll('.tr-throw-btn')
        .forEach(b => b.classList.toggle('tr-selected', b === btn));
    });
  });
}

function startTraining() {
  // Validate starting score
  const score = trScore;
  if (isNaN(score) || score < 101) {
    const grid = document.getElementById('tr-score-grid');
    if (grid) { grid.style.outline = '2px solid var(--danger)'; setTimeout(() => { grid.style.outline = ''; }, 1200); }
    return;
  }

  // Validate every active team has ≥1 player
  let allValid = true;
  for (let i = 0; i < trNumTeams; i++) {
    if (trTeams[i].players.length === 0) {
      const card = document.getElementById(`tr-team-card-${i}`);
      if (card) { card.style.outline = '2px solid var(--danger)'; setTimeout(() => { card.style.outline = ''; }, 1200); }
      allValid = false;
    }
  }
  if (!allValid) return;

  // Validate throw-first selection
  if (trFirstTeamIdx === null || trFirstTeamIdx >= trNumTeams) {
    const tg = document.getElementById('tr-throw-grid');
    if (tg) { tg.style.outline = '2px solid var(--danger)'; setTimeout(() => { tg.style.outline = ''; }, 1200); }
    return;
  }

  trainingState.startingScore = score;
  trainingState.legs          = trLegs;
  trainingState.legFormat     = trLegFormat;
  trainingState.teams         = trTeams.slice(0, trNumTeams).map(t => ({ name: t.name, players: t.players.slice() }));
  trainingState.firstTeamIdx  = trFirstTeamIdx;

  initTrainingScoring();
}

// ── Initialise scoring engine for training (N teams) ──
function initTrainingScoring() {
  const gs = gameState;
  if (gs.flashTimer) { clearTimeout(gs.flashTimer); gs.flashTimer = null; }

  const teams    = trainingState.teams;         // [{name, players:[]}]
  const numTeams = teams.length;
  const score    = trainingState.startingScore;
  const firstIdx = trainingState.firstTeamIdx;

  // Rotate so first-throwing team becomes index 0 → side 't0'
  const rotated = [...teams.slice(firstIdx), ...teams.slice(0, firstIdx)];

  // Build sideScores + legsWon keyed 't0'..'t(N-1)'
  const sideScores = {};
  const legsWon    = {};
  rotated.forEach((_, i) => { sideScores['t' + i] = score; legsWon['t' + i] = 0; });

  // Build player list grouped by team (T0 all players, then T1, …)
  // Turn rotation is handled separately via trTeamTurn / trTeamPlayerOffset.
  const allPlayers = [];
  rotated.forEach((team, ti) => {
    team.players.forEach(name => allPlayers.push({ name, side: 't' + ti }));
  });

  gs.mode           = 'training';
  gs.format         = { score, legs: trainingState.legs, legFormat: trainingState.legFormat, label: 'Training', throw: 't0' };
  gs.startingScore  = score;
  gs.whoThrowsFirst = 't0';
  gs.sideScores     = sideScores;
  gs.legsWon        = legsWon;
  gs.currentLeg     = 1;
  gs.visitSeq       = 0;
  gs.currentInput   = '';
  gs.bustActive     = false;
  gs.flashMsg       = null;
  gs.numTeams       = numTeams;
  gs.teams          = rotated.map((t, i) => ({ name: t.name, side: 't' + i }));
  gs.players        = allPlayers.map(p => ({ name: p.name, side: p.side, visits: [] }));

  // Per-team turn tracking ─────────────────────────────
  // trTeamPlayers[i] = array of gs.players indices belonging to team i
  gs.trTeamPlayers = rotated.map((_, ti) => {
    const idxs = [];
    gs.players.forEach((p, pi) => { if (p.side === 't' + ti) idxs.push(pi); });
    return idxs;
  });
  gs.trTeamTurn         = 0;                          // which team throws next
  gs.trTeamPlayerOffset = new Array(numTeams).fill(0); // which player within each team is up
  gs.currentPlayerIndex = gs.trTeamPlayers[0][0];      // first player of first team

  navigateTo('screen-scoring');
  renderScoringScreen();
}

// ── Wrap initScoringScreen to tag match mode ──────────
(function(){
  const _orig = initScoringScreen;
  window.initScoringScreen = function() {
    gameState.mode = 'match';
    _orig();
  };
}());

// ── Training turn advance (team-by-team rotation) ─────
// Always moves to the NEXT team, then picks that team's
// current player.  The team that just threw has its own
// within-team player offset incremented so the NEXT time
// they throw they use the following player.
function advanceTurnTraining() {
  const gs = gameState;
  const n  = gs.numTeams;
  // Rotate the player index for the team that just threw
  const cur      = gs.trTeamTurn;
  const curSize  = gs.trTeamPlayers[cur].length;
  gs.trTeamPlayerOffset[cur] = (gs.trTeamPlayerOffset[cur] + 1) % curSize;
  // Move to next team
  gs.trTeamTurn = (gs.trTeamTurn + 1) % n;
  const nxt     = gs.trTeamTurn;
  // Point currentPlayerIndex at that team's active player
  gs.currentPlayerIndex = gs.trTeamPlayers[nxt][gs.trTeamPlayerOffset[nxt]];
}

// ── Wrap advanceTurn to branch on mode ────────────────
(function(){
  const _orig = advanceTurn;
  window.advanceTurn = function() {
    if (gameState.mode === 'training' && gameState.trTeamPlayers) {
      advanceTurnTraining();
    } else {
      _orig();
    }
  };
}());

// ── Wrap startNewLeg for training (t0/t1/… sides, team rotation) ─
(function(){
  const _orig = startNewLeg;
  window.startNewLeg = function() {
    const gs = gameState;
    if (gs.mode !== 'training') { _orig(); return; }

    gs.currentLeg++;

    // Reset all team scores to starting score
    Object.keys(gs.sideScores).forEach(side => {
      gs.sideScores[side] = gs.startingScore;
    });

    // Rotate first team by leg number (leg 1 → team 0, leg 2 → team 1, etc.)
    const firstTeamIdx    = (gs.currentLeg - 1) % gs.numTeams;
    gs.trTeamTurn         = firstTeamIdx;
    gs.currentPlayerIndex = gs.trTeamPlayers[firstTeamIdx][gs.trTeamPlayerOffset[firstTeamIdx]];

    gs.flashMsg = { text: `LEG ${gs.currentLeg}`, cls: 'leg-flash' };
    renderScoringUI();

    if (gs.flashTimer) clearTimeout(gs.flashTimer);
    gs.flashTimer = setTimeout(() => {
      gs.flashMsg   = null;
      gs.flashTimer = null;
      renderScoringUI();
    }, 1800);
  };
}());

// ── Wrap handleLegWin to support training 'firstto' / 'bestof' ────
(function(){
  const _orig = handleLegWin;
  window.handleLegWin = function(winningSide) {
    const gs  = gameState;
    const fmt = gs.format;
    // Single leg or match mode: use original logic (match is always best-of)
    if (gs.mode !== 'training' || fmt.legs === 1) { _orig(winningSide); return; }

    gs.legsWon[winningSide]++;
    const won    = gs.legsWon[winningSide];
    const target = fmt.legFormat === 'firstto'
      ? fmt.legs                   // First to N: reach exactly N
      : Math.ceil(fmt.legs / 2);   // Best of N: majority
    if (won >= target) {
      recordGameWinner(winningSide);
    } else {
      startNewLeg();
    }
  };
}());

// ── Wrap recordGameWinner to branch on mode ───────────
(function(){
  const _orig = recordGameWinner;
  window.recordGameWinner = function(side) {
    if (gameState.mode === 'training') {
      renderTrainingStats(side);
      navigateTo('screen-training-stats');
    } else {
      _orig(side);
    }
  };
}());

// ── Checkout suggestion table (all valid finishes 2–170) ─────────────────────
const CHECKOUTS = {
  // Singles + doubles (2–40)
  2:'D1', 3:'1 D1', 4:'D2', 5:'1 D2', 6:'D3', 7:'3 D2', 8:'D4', 9:'1 D4',
  10:'D5', 11:'3 D4', 12:'D6', 13:'5 D4', 14:'D7', 15:'7 D4', 16:'D8',
  17:'1 D8', 18:'D9', 19:'3 D8', 20:'D10', 21:'1 D10', 22:'D11', 23:'3 D10',
  24:'D12', 25:'1 D12', 26:'D13', 27:'3 D12', 28:'D14', 29:'1 D14', 30:'D15',
  31:'3 D14', 32:'D16', 33:'1 D16', 34:'D17', 35:'3 D16', 36:'D18', 37:'5 D16',
  38:'D19', 39:'3 D18', 40:'D20',
  // Single + D20 (41–60); 50 = Bull
  41:'1 D20', 42:'2 D20', 43:'3 D20', 44:'4 D20', 45:'5 D20',
  46:'6 D20', 47:'7 D20', 48:'8 D20', 49:'9 D20', 50:'Bull',
  51:'11 D20', 52:'12 D20', 53:'13 D20', 54:'14 D20', 55:'15 D20',
  56:'16 D20', 57:'17 D20', 58:'18 D20', 59:'19 D20', 60:'20 D20',
  // Treble + double (61–100)
  61:'T15 D8', 62:'T10 D16', 63:'T13 D12', 64:'T16 D8', 65:'T15 D10',
  66:'T10 D18', 67:'T9 D20',  68:'T16 D10', 69:'T19 D6',  70:'T10 D20',
  71:'T13 D16', 72:'T16 D12', 73:'T19 D8',  74:'T14 D16', 75:'T17 D12',
  76:'T20 D8',  77:'T19 D10', 78:'T18 D12', 79:'T13 D20', 80:'T20 D10',
  81:'T19 D12', 82:'T14 D20', 83:'T17 D16', 84:'T20 D12', 85:'T15 D20',
  86:'T18 D16', 87:'T17 D18', 88:'T16 D20', 89:'T19 D16', 90:'T20 D15',
  91:'T17 D20', 92:'T20 D16', 93:'T19 D18', 94:'T18 D20', 95:'T19 D19',
  96:'T20 D18', 97:'T19 D20', 98:'T20 D19', 99:'T20 1 D19', 100:'T20 D20',
  // Bull combos (101–110)
  101:'T17 Bull', 102:'T20 2 D20', 103:'T20 3 D20', 104:'T18 Bull',
  105:'T20 5 D20', 106:'T20 6 D20', 107:'T19 Bull', 108:'T20 8 D20',
  109:'T20 9 D20', 110:'T20 Bull',
  // T20 + single + D20 (111–120)
  111:'T20 11 D20', 112:'T20 12 D20', 113:'T20 13 D20', 114:'T20 14 D20',
  115:'T20 15 D20', 116:'T20 16 D20', 117:'T20 17 D20', 118:'T20 18 D20',
  119:'T20 19 D20', 120:'T20 20 D20',
  // Treble + treble + double (121–170; 159/162/163/165/166/168/169 omitted — impossible)
  121:'T20 T11 D14', 122:'T18 T18 D7',  123:'T20 T13 D12', 124:'T20 T16 D8',
  125:'T20 T15 D10', 126:'T19 T19 D6',  127:'T20 T17 D8',  128:'T20 T16 D10',
  129:'T19 T16 D12', 130:'T20 T18 D8',  131:'T20 T13 D16', 132:'T20 T16 D12',
  133:'T20 T19 D8',  134:'T20 T14 D16', 135:'T20 T17 D12', 136:'T20 T20 D8',
  137:'T20 T19 D10', 138:'T20 T18 D12', 139:'T20 T13 D20', 140:'T20 T16 D16',
  141:'T20 T19 D12', 142:'T20 T18 D14', 143:'T20 T17 D16', 144:'T20 T20 D12',
  145:'T20 T19 D14', 146:'T20 T18 D16', 147:'T20 T17 D18', 148:'T20 T16 D20',
  149:'T20 T19 D16', 150:'T20 T18 D18', 151:'T20 T17 D20', 152:'T20 T20 D16',
  153:'T20 T19 D18', 154:'T20 T18 D20', 155:'T20 T19 D19', 156:'T20 T20 D18',
  157:'T20 T19 D20', 158:'T20 T20 D19', 160:'T20 T20 D20',
  161:'T20 T17 Bull', 164:'T20 T18 Bull', 167:'T20 T19 Bull', 170:'T20 T20 Bull',
};

let checkoutToggle = false;

function updateCheckoutHints() {
  const gs = gameState;
  if (gs.mode !== 'training') return;
  (gs.teams || []).forEach((team, i) => {
    const chEl = document.getElementById('sc-checkout-t' + i);
    if (!chEl) return;
    const rem = gs.sideScores['t' + i];
    chEl.textContent = (checkoutToggle && rem >= 2 && rem <= 170) ? (CHECKOUTS[rem] || '') : '';
  });
}

// ── Wrap renderScoringScreen: replace 2-panel bar with N-team bar in training ─
(function(){
  const _orig = renderScoringScreen;
  window.renderScoringScreen = function() {
    _orig();
    // Always sync multi-training class (handles match→training and training→match transitions)
    const scrEl = document.getElementById('screen-scoring');
    if (scrEl) scrEl.classList.toggle('sc-multi-training', gameState.mode === 'training' && gameState.numTeams > 2);
    if (gameState.mode !== 'training') return;
    const gs = gameState;

    // Patch top bar for training (replace 3-section bar with simple training info)
    const bar = document.querySelector('#screen-scoring .sc-topbar');
    if (bar) {
      const fmt       = gs.format;
      const multiLeg  = fmt && fmt.legs > 1;
      const fmtLabel  = multiLeg
        ? (fmt.legFormat === 'firstto' ? 'First to ' : 'Best of ') + fmt.legs
        : gs.numTeams + ' team' + (gs.numTeams > 1 ? 's' : '');
      const legsCenter = multiLeg
        ? `<span style="display:flex;flex-direction:column;align-items:center;justify-content:center;` +
          `min-width:60px;border-left:1px solid var(--border);border-right:1px solid var(--border);` +
          `padding:2px 6px;background:#111;align-self:stretch;">` +
          `<span id="tr-legs-display" style="font-size:14px;font-weight:900;color:var(--accent);` +
          `font-family:'Arial Black',Arial,sans-serif;line-height:1;">` +
          (gs.teams || []).map(t => gs.legsWon[t.side] || 0).join('–') +
          `</span>` +
          `<span style="font-size:7px;color:var(--text-muted);letter-spacing:1px;` +
          `text-transform:uppercase;font-family:Arial,sans-serif;">LEGS</span></span>`
        : '';
      const cp = gs.players[gs.currentPlayerIndex];
      bar.innerHTML =
        `<div id="tr-bar-left" class="sc-top-left">` +
        `<span class="sc-top-player${cp && cp.side === 't0' ? ' sc-top-player-active' : ''}">` +
        escHtml((gs.players || []).filter(p => p.side === 't0').map(p => p.name).join(' & ')) +
        `</span></div>` +
        `<div class="sc-top-center" style="width:auto;flex-shrink:0;padding:2px 8px;gap:3px;">` +
        (multiLeg ? `<span id="tr-legs-display" style="font-size:11px;font-weight:900;` +
          `color:var(--accent);font-family:'Arial Black',Arial,sans-serif;line-height:1;">` +
          (gs.teams || []).map(t => gs.legsWon[t.side] || 0).join('–') + `</span>` : '') +
        `<button id="tr-checkout-toggle" class="tr-checkout-toggle${checkoutToggle ? ' active' : ''}">` +
        `&#10003; Checkout</button></div>` +
        `<div id="tr-bar-right" class="sc-top-right">` +
        `<span class="sc-top-player${cp && cp.side === 't1' ? ' sc-top-player-active' : ''}">` +
        escHtml((gs.players || []).filter(p => p.side === 't1').map(p => p.name).join(' & ')) +
        `</span></div>`;
      const togBtn = document.getElementById('tr-checkout-toggle');
      if (togBtn) {
        togBtn.addEventListener('click', () => {
          checkoutToggle = !checkoutToggle;
          togBtn.classList.toggle('active', checkoutToggle);
          updateCheckoutHints();
        });
      }
    }

    // Replace fixed 2-panel score bar with N-panel training bar
    const scoreBar = document.getElementById('sc-score-bar');
    if (scoreBar) {
      scoreBar.className  = `sc-train-bar teams-${gs.numTeams}`;
      scoreBar.style.cssText = '';   // clear any match-mode inline styles
      scoreBar.innerHTML  = (gs.teams || []).map((team, i) =>
        `<div class="sc-train-panel" id="sc-panel-t${i}">
           <div class="score-team">${escHtml(team.name)}</div>
           <div class="score-remaining" id="sc-rem-t${i}">${gs.sideScores['t' + i]}</div>
           <div class="tr-checkout-hint" id="sc-checkout-t${i}"></div>
           <div class="score-players" id="sc-names-t${i}"></div>
         </div>`
      ).join('');
      updateCheckoutHints();
    }
  };
}());

// ── Training stats screen (N teams) ──────────────────
function renderTrainingStats(winningSide) {
  const gs  = gameState;
  const scr = document.getElementById('screen-training-stats');
  if (!scr) return;

  function playerStats(p) {
    const scored = p.visits.filter(v => !v.wasBust);
    const total  = scored.reduce((s, v) => s + v.scored, 0);
    const visits = scored.length;
    const avg    = visits > 0 ? (total / visits).toFixed(1) : '—';
    const high   = visits > 0 ? Math.max(...scored.map(v => v.scored)) : 0;
    const c90    = scored.filter(v => v.scored >= 90).length;
    const c180   = scored.filter(v => v.scored === 180).length;
    const darts  = visits * 3;
    const lastV  = scored[scored.length - 1];
    const checkout = (lastV && lastV.remaining === 0) ? lastV.scored : null;
    return { avg, high, c90, c180, darts, checkout };
  }

  // Winner team name
  const winningTeam = (gs.teams || []).find(t => t.side === winningSide);
  const winnerName  = winningTeam ? winningTeam.name : winningSide;

  // Best checkout among winning team's players
  let bestCheckout = null;
  gs.players.filter(p => p.side === winningSide).forEach(p => {
    const st = playerStats(p);
    if (st.checkout !== null && (bestCheckout === null || st.checkout > bestCheckout)) {
      bestCheckout = st.checkout;
    }
  });

  // Build table rows grouped by team
  const tableRows = (gs.teams || []).map(team => {
    const isWin      = team.side === winningSide;
    const teamHeader = `<tr style="background:rgba(255,255,255,0.05);">
      <td colspan="7" style="text-align:left;padding:6px 8px;font-size:0.68rem;
          color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;
          font-family:Arial,sans-serif;">
        ${escHtml(team.name)}${isWin ? ' &#127942;' : ''}
      </td>
    </tr>`;
    const playerRows = gs.players.filter(p => p.side === team.side).map(p => {
      const st = playerStats(p);
      return `<tr>
        <td style="text-align:left;font-size:0.85rem;color:var(--text-dim);">${escHtml(p.name)}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.avg}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.high || '—'}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.c90}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.c180}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.darts}</td>
        <td${isWin ? ' class="stat-winner"' : ''}>${st.checkout !== null ? st.checkout : '—'}</td>
      </tr>`;
    }).join('');
    return teamHeader + playerRows;
  }).join('');

  scr.innerHTML = `
    <div>
      <div class="page-title">Training</div>
      <div class="page-subtitle">Session complete</div>
    </div>

    <div class="stats-winner-banner">
      <div class="stats-winner-label">Winner</div>
      <div class="stats-winner-name">${escHtml(winnerName)}</div>
      <div class="stats-winner-sub">
        ${trainingState.startingScore} &bull; ${gs.numTeams} team${gs.numTeams > 1 ? 's' : ''}
      </div>
    </div>

    ${bestCheckout !== null ? `
    <div class="checkout-highlight">
      <div>
        <div class="checkout-label">WINNING CHECKOUT</div>
        <div class="checkout-value">${bestCheckout}</div>
      </div>
      <div style="font-size:2rem;">&#127919;</div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Player Statistics</div>
      <div style="overflow-x:auto;">
        <table class="stats-table" style="min-width:420px;">
          <thead>
            <tr>
              <th style="text-align:left;">Player</th>
              <th>Avg</th><th>High</th><th>90+</th>
              <th>180s</th><th>Darts</th><th>Checkout</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>

    <button class="btn btn-secondary" id="tr-save-btn">
      &#128190;&nbsp; Save Session
    </button>
    <button class="btn btn-ghost" id="tr-again-btn">
      &#8635;&nbsp; Play Again
    </button>
    <button class="btn btn-secondary" id="tr-home-btn">
      &#8962;&nbsp; Home
    </button>`;

  document.getElementById('tr-save-btn').addEventListener('click', function() {
    saveTrainingSession(winningSide);
    this.textContent = '✓ Saved!';
    this.disabled = true;
  });

  document.getElementById('tr-again-btn').addEventListener('click', () => {
    screenStack.length = 0;
    showScreen('screen-training');
    renderTrainingSetup();
  });

  document.getElementById('tr-home-btn').addEventListener('click', () => {
    screenStack.length = 0;
    showScreen('screen-home');
  });
}

// ── Save training session ─────────────────────────────
function saveTrainingSession(winningSide) {
  const gs     = gameState;
  const record = {
    id:           makeId(),
    date:         new Date().toISOString(),
    startingScore: trainingState.startingScore,
    numTeams:     gs.numTeams,
    teams:        (gs.teams || []).map(team => {
      const teamPlayers = gs.players.filter(p => p.side === team.side);
      return {
        name:   team.name,
        winner: team.side === winningSide,
        players: teamPlayers.map(p => {
          const scored = p.visits.filter(v => !v.wasBust);
          const total  = scored.reduce((s, v) => s + v.scored, 0);
          return {
            name:  p.name,
            avg:   scored.length > 0 ? (total / scored.length).toFixed(1) : 0,
            darts: scored.length * 3,
          };
        }),
      };
    }),
    winner: (gs.teams || []).find(t => t.side === winningSide)
              ? (gs.teams.find(t => t.side === winningSide).name) : winningSide,
  };
  try {
    const hist = JSON.parse(localStorage.getItem(TRAINING_HISTORY_KEY) || '[]');
    hist.unshift(record);
    localStorage.setItem(TRAINING_HISTORY_KEY, JSON.stringify(hist));
  } catch (e) {}
}

// ── Match history screen render ───────────────────────
function renderMatchHistory() {
  const listEl = document.getElementById('match-history-list');
  if (!listEl) return;

  let records = [];
  try { records = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '[]'); } catch (e) {}

  if (!records.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <div class="empty-text">
          No matches saved yet.<br>Complete a full match night to see results here.
        </div>
      </div>`;
    return;
  }

  listEl.innerHTML = records.map((r, ri) => {
    const homeWon = r.points.home > r.points.away;
    const awayWon = r.points.away > r.points.home;

    const gameRows = (r.games || []).map(g => {
      const winTeam = g.winner === 'home' ? r.homeTeam : r.awayTeam;
      const phdStr  = (g.phd || []).join(', ');
      const oppStr  = (g.opp || []).join(', ');
      return `
        <div class="hm-game-row">
          <span class="hm-game-label">G${g.gameNum || '?'} ${g.format ? escHtml(g.format.label) : ''}</span>
          <span class="hm-game-winner">${escHtml(winTeam)}</span>
          <span class="hm-game-players">${escHtml(phdStr)} vs ${escHtml(oppStr)}</span>
        </div>`;
    }).join('');

    return `
    <div class="history-match-card">
      <div class="history-match-header">
        <span class="history-match-date">${formatDate(r.date)}</span>
        <button class="hm-del-btn" data-del-idx="${ri}">&#128465;&nbsp;Delete</button>
      </div>
      <div class="history-match-teams" style="cursor:pointer;" data-expand-idx="${ri}">
        <div class="history-team">
          <div class="history-team-name${homeWon ? ' winner' : ''}">${escHtml(r.homeTeam)}</div>
        </div>
        <div class="history-score">${r.points.home}&ndash;${r.points.away}</div>
        <div class="history-team">
          <div class="history-team-name${awayWon ? ' winner' : ''}">${escHtml(r.awayTeam)}</div>
        </div>
      </div>
      ${gameRows ? `
      <div class="history-match-footer" style="cursor:pointer;" data-expand-idx="${ri}">
        <span class="history-high-score">Tap to see game results</span>
        <span style="color:var(--accent);">&#9660;</span>
      </div>
      <div class="hm-expand" id="hm-expand-${ri}">${gameRows}</div>` : ''}
    </div>`;
  }).join('');

  // Expand/collapse on row tap
  listEl.querySelectorAll('[data-expand-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const exp = document.getElementById(`hm-expand-${el.dataset.expandIdx}`);
      if (exp) exp.classList.toggle('open');
    });
  });

  // Delete individual record
  listEl.querySelectorAll('.hm-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      let recs = [];
      try { recs = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '[]'); } catch (e) {}
      recs.splice(parseInt(btn.dataset.delIdx, 10), 1);
      localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(recs));
      renderMatchHistory();
    });
  });
}

// ── Clear all match history ───────────────────────────
(function(){
  const btn = document.getElementById('btn-clear-history');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!confirm('Delete all match history? This cannot be undone.')) return;
    localStorage.removeItem(MATCH_HISTORY_KEY);
    renderMatchHistory();
  });
}());

// ── Match auto-save (after game 9 completes) ──────────
function saveMatchToHistory() {
  const record = {
    id:       makeId(),
    date:     new Date().toISOString(),
    homeTeam: matchState.homeTeam,
    awayTeam: matchState.awayTeam,
    points:   { home: matchState.points.home, away: matchState.points.away },
    games:    matchState.games.map(g => ({
      gameNum: g.gameNum,
      format:  g.format ? { label: g.format.label, score: g.format.score } : null,
      phd:     g.phd  || [],
      opp:     g.opp  || [],
      winner:  g.winner,
    })),
  };
  try {
    const hist = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '[]');
    hist.unshift(record);
    localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(hist));
  } catch (e) {}
}

// Add second listener on Next Game button — fires after Phase 4's listener
// (which already incremented currentGame), checks if match is complete
(function(){
  const nextBtn = document.getElementById('btn-next-game');
  if (!nextBtn) return;
  nextBtn.addEventListener('click', () => {
    // Phase 4 already incremented matchState.currentGame
    if (gameState.mode !== 'training' && matchState.currentGame > 9) {
      saveMatchToHistory();
    }
  });
}());

// Also auto-save if user taps "Finish Match" while on the last game
(function(){
  const finBtn = document.getElementById('btn-finish-match');
  if (!finBtn) return;
  finBtn.addEventListener('click', () => {
    if (gameState.mode !== 'training' && matchState.currentGame === 9 &&
        matchState.games[8] && matchState.games[8].winner) {
      saveMatchToHistory();
    }
  });
}());

/* ══════════════════════════════════════════════════════
   MATCH RESUME / LEAVE / FINISH
══════════════════════════════════════════════════════ */

const ACTIVE_MATCH_KEY = 'phd_active_match';

// ── Is a scorable match currently in progress? ────────
function isMatchActive() {
  if (gameState.mode === 'training') return false;
  if (matchState.currentGame < 1 || matchState.currentGame > 9) return false;
  const active = document.querySelector('.screen.active');
  const matchScreens = ['screen-game-setup', 'screen-scoring', 'screen-stats'];
  return !!(active && matchScreens.includes(active.id));
}

// ── Persist match snapshot to localStorage ────────────
function saveActiveMatch() {
  const active = document.querySelector('.screen.active');
  const savedScreen = (active && active.id === 'screen-scoring')
    ? 'screen-scoring' : 'screen-game-setup';
  const data = {
    matchState:  JSON.parse(JSON.stringify(matchState)),
    savedScreen,
  };
  if (savedScreen === 'screen-scoring') {
    data.gameState = {
      format:             gameState.format,
      startingScore:      gameState.startingScore,
      whoThrowsFirst:     gameState.whoThrowsFirst,
      sideScores:         Object.assign({}, gameState.sideScores),
      legsWon:            Object.assign({}, gameState.legsWon),
      currentLeg:         gameState.currentLeg,
      visitSeq:           gameState.visitSeq,
      currentInput:       '',
      bustActive:         false,
      players:            JSON.parse(JSON.stringify(gameState.players || [])),
      currentPlayerIndex: gameState.currentPlayerIndex || 0,
      mode:               gameState.mode,
    };
  }
  try { localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(data)); } catch(e) {}
}

// ── Restore saved match and navigate to correct screen ─
function resumeActiveMatch() {
  let data;
  try { data = JSON.parse(localStorage.getItem(ACTIVE_MATCH_KEY) || 'null'); } catch(e) {}
  if (!data) return;
  Object.assign(matchState, data.matchState);
  if (data.savedScreen === 'screen-scoring' && data.gameState) {
    Object.assign(gameState, data.gameState);
    gameState.flashTimer = null;
    screenStack.length = 0;
    showScreen('screen-scoring');
    renderScoringScreen();
    renderScoringUI();
  } else {
    phdSelected = [];
    renderGameSetup();
    screenStack.length = 0;
    showScreen('screen-game-setup');
  }
}

// ── Home-screen resume-match widget ──────────────────
function renderHomeResumeMatch() {
  const hasMatch = !!localStorage.getItem(ACTIVE_MATCH_KEY);
  let div = document.getElementById('home-resume-match');
  if (!hasMatch) {
    if (div) div.style.display = 'none';
    return;
  }
  if (!div) {
    div = document.createElement('div');
    div.id = 'home-resume-match';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
    div.innerHTML =
      `<button id="btn-resume-match" class="btn btn-ghost" style="flex:1;min-height:50px;gap:8px;">` +
      `&#9654; Resume Match in Progress</button>` +
      `<button id="btn-delete-resume" class="btn btn-danger btn-sm"` +
      ` style="width:auto;min-height:50px;padding:8px 16px;flex-shrink:0;">&#10005;</button>`;
    const ref = document.getElementById('btn-resume-tournament');
    if (ref) ref.insertAdjacentElement('afterend', div);
    else document.getElementById('screen-home').appendChild(div);
    document.getElementById('btn-resume-match').addEventListener('click', resumeActiveMatch);
    document.getElementById('btn-delete-resume').addEventListener('click', () => {
      localStorage.removeItem(ACTIVE_MATCH_KEY);
      renderHomeResumeMatch();
    });
  } else {
    div.style.display = 'flex';
  }
}

// ── Leave-match popup: Save & Leave / Abandon / Cancel ─
function showLeaveMatchPopup() {
  let popup = document.getElementById('leave-match-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'leave-match-popup';
    popup.className = 'undo-popup-overlay';
    popup.innerHTML =
      `<div class="undo-popup-box">` +
      `<div class="undo-popup-title">Leave this match?</div>` +
      `<div class="undo-popup-btns" style="flex-direction:column;gap:8px;">` +
      `<button id="lmp-save"    style="min-height:50px;background:var(--accent);color:#fff;` +
        `border:none;border-radius:9px;font-size:0.95rem;font-weight:700;cursor:pointer;` +
        `font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;">` +
      `&#128190; Save &amp; Leave</button>` +
      `<button id="lmp-abandon" style="min-height:50px;background:var(--danger);color:#fff;` +
        `border:none;border-radius:9px;font-size:0.95rem;font-weight:700;cursor:pointer;` +
        `font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;">` +
      `Abandon Match</button>` +
      `<button id="lmp-cancel"  style="min-height:50px;background:#2a2a2a;color:#bbb;` +
        `border:1px solid #555;border-radius:9px;font-size:0.95rem;font-weight:700;cursor:pointer;` +
        `font-family:Arial,sans-serif;-webkit-tap-highlight-color:transparent;">` +
      `Cancel</button>` +
      `</div></div>`;
    document.body.appendChild(popup);
    document.getElementById('lmp-save').addEventListener('click', () => {
      hideLeaveMatchPopup();
      saveActiveMatch();
      screenStack.length = 0;
      showScreen('screen-home');
    });
    document.getElementById('lmp-abandon').addEventListener('click', () => {
      hideLeaveMatchPopup();
      showAbandonConfirm();
    });
    document.getElementById('lmp-cancel').addEventListener('click', hideLeaveMatchPopup);
    popup.addEventListener('click', e => { if (e.target === popup) hideLeaveMatchPopup(); });
  }
  popup.style.display = 'flex';
}
function hideLeaveMatchPopup() {
  const p = document.getElementById('leave-match-popup');
  if (p) p.style.display = 'none';
}

// ── Abandon match — second confirmation ───────────────
function showAbandonConfirm() {
  let popup = document.getElementById('abandon-confirm-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'abandon-confirm-popup';
    popup.className = 'undo-popup-overlay';
    popup.innerHTML =
      `<div class="undo-popup-box">` +
      `<div class="undo-popup-title">Are you sure?<br>` +
      `<span style="font-size:0.8rem;font-weight:400;color:#888;">This cannot be undone.</span></div>` +
      `<div class="undo-popup-btns">` +
      `<button class="undo-popup-yes" id="abandon-yes" style="background:var(--danger);">Abandon</button>` +
      `<button class="undo-popup-no"  id="abandon-no">Cancel</button>` +
      `</div></div>`;
    document.body.appendChild(popup);
    document.getElementById('abandon-yes').addEventListener('click', () => {
      hideAbandonConfirm();
      try { localStorage.removeItem(ACTIVE_MATCH_KEY); } catch(e) {}
      screenStack.length = 0;
      showScreen('screen-home');
    });
    document.getElementById('abandon-no').addEventListener('click', hideAbandonConfirm);
    popup.addEventListener('click', e => { if (e.target === popup) hideAbandonConfirm(); });
  }
  popup.style.display = 'flex';
}
function hideAbandonConfirm() {
  const p = document.getElementById('abandon-confirm-popup');
  if (p) p.style.display = 'none';
}

// ── Finish match confirmation popup ───────────────────
function showFinishMatchPopup() {
  const home = escHtml(matchState.homeTeam || 'PHD');
  const away = escHtml(matchState.awayTeam || 'Opponents');
  const hp   = matchState.points.home;
  const ap   = matchState.points.away;
  let popup = document.getElementById('finish-match-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'finish-match-popup';
    popup.className = 'undo-popup-overlay';
    popup.innerHTML =
      `<div class="undo-popup-box">` +
      `<div class="undo-popup-title" id="fmp-title"></div>` +
      `<div class="undo-popup-btns">` +
      `<button class="undo-popup-yes" id="fmp-confirm">Confirm</button>` +
      `<button class="undo-popup-no"  id="fmp-cancel">Cancel</button>` +
      `</div></div>`;
    document.body.appendChild(popup);
    document.getElementById('fmp-confirm').addEventListener('click', () => {
      hideFinishMatchPopup();
      saveMatchToHistory();
      try { localStorage.removeItem(ACTIVE_MATCH_KEY); } catch(e) {}
      screenStack.length = 0;
      showScreen('screen-home');
    });
    document.getElementById('fmp-cancel').addEventListener('click', hideFinishMatchPopup);
    popup.addEventListener('click', e => { if (e.target === popup) hideFinishMatchPopup(); });
  }
  document.getElementById('fmp-title').innerHTML =
    `End match?<br><span style="font-size:1rem;color:var(--accent);">${home} ${hp} &ndash; ${ap} ${away}</span>`;
  popup.style.display = 'flex';
}
function hideFinishMatchPopup() {
  const p = document.getElementById('finish-match-popup');
  if (p) p.style.display = 'none';
}

// ── Replace btn-back with match-aware version ─────────
(function(){
  const btn = document.getElementById('btn-back');
  if (!btn) return;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    if (isMatchActive()) { showLeaveMatchPopup(); return; }
    if (!screenStack.length) return;
    showScreen(screenStack.pop());
    document.getElementById('btn-back').style.display =
      screenStack.length ? 'block' : 'none';
  });
}());

// ── Replace btn-home with match-aware version ─────────
(function(){
  const btn = document.getElementById('btn-home');
  if (!btn) return;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    if (isMatchActive()) { showLeaveMatchPopup(); return; }
    screenStack.length = 0;
    showScreen('screen-home');
  });
}());

// ── Replace btn-finish-match with confirmation version ─
(function(){
  const btn = document.getElementById('btn-finish-match');
  if (!btn) return;
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    if (gameState.mode !== 'training' && matchState.currentGame === 9 &&
        matchState.games[8] && matchState.games[8].winner) {
      showFinishMatchPopup();
    } else {
      screenStack.length = 0;
      showScreen('screen-home');
    }
  });
}());

// ── Show resume button on load if a saved match exists ─
renderHomeResumeMatch();

/* ══════════════════════════════════════════════════════
   TOURNAMENT MODE
══════════════════════════════════════════════════════ */

// ── CSS injection ──────────────────────────────────────
(function(){
  const s = document.createElement('style');
  s.textContent = [
    '.trn-roster-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
    '.trn-roster-btn{background:var(--bg-raised);border:2px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:Arial,sans-serif;font-weight:700;font-size:0.85rem;padding:8px 4px;cursor:pointer;text-align:center;min-height:48px;-webkit-tap-highlight-color:transparent;transition:background 0.12s,border-color 0.12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.trn-roster-btn.trn-sel{background:var(--accent);border-color:var(--accent);color:#fff;}',
    '.trn-selected-list{display:flex;flex-direction:column;gap:6px;}',
    '.trn-selected-item{display:flex;align-items:center;justify-content:space-between;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;min-height:48px;}',
    '.trn-selected-name{font-size:0.9rem;font-family:Arial,sans-serif;flex:1;}',
    '.trn-remove-btn{background:none;border:1px solid var(--danger);color:var(--danger);border-radius:6px;padding:4px 10px;font-size:0.9rem;cursor:pointer;min-height:36px;min-width:36px;-webkit-tap-highlight-color:transparent;}',
    '.bracket-scroll{overflow-x:auto;overflow-y:visible;flex:1;}',
    '.bracket-container{display:flex;gap:0;min-width:max-content;padding:4px 4px 16px;}',
    '.bracket-connector{width:10px;flex-shrink:0;}',
    '.bracket-round{display:flex;flex-direction:column;width:165px;flex-shrink:0;}',
    '.bracket-round-active .bracket-round-label{color:var(--accent);}',
    '.bracket-round-label{font-size:0.6rem;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;text-align:center;padding:6px 0 8px;border-bottom:1px solid var(--border);flex-shrink:0;}',
    '.bracket-round-matches{display:flex;flex-direction:column;}',
    '.bracket-slot{display:flex;align-items:center;justify-content:center;padding:4px 0;}',
    '.bracket-match{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;width:155px;}',
    '.bracket-match.bm-active{border-color:var(--accent);}',
    '.bracket-match.bm-done{opacity:0.8;}',
    '.bracket-player{display:block;width:100%;padding:10px 10px;background:none;border:none;color:var(--text);font-family:Arial,sans-serif;font-size:0.85rem;font-weight:600;text-align:left;cursor:pointer;min-height:44px;-webkit-tap-highlight-color:transparent;transition:background 0.1s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bracket-player:not([disabled]):not(.bp-bye):hover{background:var(--bg-raised);}',
    '.bracket-player.bp-win{background:rgba(232,82,10,0.18);color:var(--accent);font-weight:700;}',
    '.bracket-player.bp-bye{color:var(--text-muted);font-style:italic;cursor:default;font-size:0.8rem;}',
    '.bracket-player.bp-tbd{color:#555;font-style:italic;cursor:default;font-size:0.8rem;}',
    '.bracket-player.bp-out{color:#444;cursor:default;text-decoration:line-through;}',
    '.bracket-vs{text-align:center;font-size:0.55rem;color:var(--border);font-family:Arial,sans-serif;padding:2px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);letter-spacing:2px;}',
    '.trn-champ-banner{background:linear-gradient(135deg,var(--accent),var(--accent-dim));border-radius:var(--radius-lg);padding:20px 16px;text-align:center;flex-shrink:0;}',
    '.trn-champ-icon{font-size:2.2rem;margin-bottom:6px;}',
    '.trn-champ-label{font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;opacity:0.85;margin-bottom:4px;}',
    '.trn-champ-name{font-size:1.8rem;letter-spacing:2px;text-transform:uppercase;font-weight:900;margin-bottom:2px;}',
    '.trn-champ-sub{font-size:0.7rem;font-family:Arial,sans-serif;opacity:0.75;}',
    '.trn-undo-btn{display:block;width:100%;padding:5px 0;background:rgba(80,80,80,0.15);border:none;border-top:1px solid var(--border);color:#888;font-family:Arial,sans-serif;font-size:0.68rem;letter-spacing:1px;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent;}',
    '.trn-undo-btn:active{background:rgba(80,80,80,0.35);color:#bbb;}',
  ].join('');
  document.head.appendChild(s);
}());

// ── Storage ────────────────────────────────────────────
const TOURNAMENT_KEY = 'phd_tournament';
let tournamentState = null;

function loadTournamentState() {
  try { return JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || 'null'); }
  catch { return null; }
}
function saveTournamentState() {
  if (tournamentState) localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournamentState));
}
function clearTournamentState() {
  localStorage.removeItem(TOURNAMENT_KEY);
  tournamentState = null;
}

// ── Bracket logic ──────────────────────────────────────
function trnShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBracket(players) {
  const shuffled = trnShuffle(players);
  const N = shuffled.length;
  let size = 1;
  while (size < N) size *= 2;

  // Distribute players evenly across all slots; unfilled slots become BYE (null).
  // Player i lands at floor(i × size / N) — guarantees even spread, no consecutive byes.
  // e.g. 5 players, 8 slots → [P1,P2,BYE,P3,P4,BYE,P5,BYE]
  const slots = new Array(size).fill(null); // null = BYE
  for (let i = 0; i < N; i++) {
    slots[Math.floor(i * size / N)] = shuffled[i];
  }

  // Build ALL rounds upfront as empty shells — full bracket visible from the start
  const numRounds = Math.round(Math.log2(size));
  const rounds = [];
  for (let r = 0; r < numRounds; r++) {
    const matchCount = size >> (r + 1); // size / 2^(r+1)
    const round = [];
    for (let i = 0; i < matchCount; i++) {
      if (r === 0) {
        // Round 0: real players or BYE (null) — read from evenly-distributed slots
        round.push({ p1: slots[i * 2], p2: slots[i * 2 + 1], winner: null, resolved: false });
      } else {
        // Later rounds: sides unknown (undefined = TBD) until upstream resolves
        round.push({ p1: undefined, p2: undefined, winner: null, resolved: false });
      }
    }
    rounds.push(round);
  }

  tournamentState = {
    players,
    rounds,
    currentRound: 0,
    champion: null,
    createdAt: new Date().toISOString()
  };

  // Auto-resolve any BYE matches in round 0 and propagate into later rounds
  rounds[0].forEach((_, mi) => trnTryResolve(0, mi));
  trnUpdateCurrentRound();
  saveTournamentState();
}

// Try to auto-resolve a match when both sides are known (BYE logic, not user picks)
function trnTryResolve(ri, mi) {
  const match = tournamentState.rounds[ri] && tournamentState.rounds[ri][mi];
  if (!match || match.resolved) return;
  if (match.p1 === undefined || match.p2 === undefined) return; // sides not yet known
  // BYE vs BYE — neither side is a real player; propagate null (bye) forward
  if (match.p1 === null && match.p2 === null) {
    match.resolved = true;
    trnPropagate(ri, mi, null);
  // BYE on left — right player auto-advances
  } else if (match.p1 === null) {
    match.winner = match.p2;
    match.resolved = true;
    trnPropagate(ri, mi, match.winner);
  // BYE on right — left player auto-advances
  } else if (match.p2 === null) {
    match.winner = match.p1;
    match.resolved = true;
    trnPropagate(ri, mi, match.winner);
  }
  // else: two real players — needs a user tap
}

// Feed a result (player name or null for BYE) into the correct slot of the next round
function trnPropagate(ri, mi, winner) {
  const nextRound = tournamentState.rounds[ri + 1];
  if (!nextRound) return; // this was the final — champion set by trnUpdateCurrentRound
  const nextMi    = Math.floor(mi / 2);
  const nextMatch = nextRound[nextMi];
  if (!nextMatch) return;
  if (mi % 2 === 0) nextMatch.p1 = winner; // even index → feeds p1 slot
  else              nextMatch.p2 = winner; // odd  index → feeds p2 slot
  trnTryResolve(ri + 1, nextMi); // both sides now known? try to auto-resolve
}

// Detect champion from the final match directly (supports free-order play)
function trnUpdateCurrentRound() {
  const ts = tournamentState;
  const finalMatch = ts.rounds[ts.rounds.length - 1][0];
  if (finalMatch && finalMatch.resolved && finalMatch.winner) {
    ts.champion = finalMatch.winner;
  }
}

function pickTrnWinner(roundIdx, matchIdx, playerKey) {
  const ts = tournamentState;
  if (!ts) return;
  const match = ts.rounds[roundIdx] && ts.rounds[roundIdx][matchIdx];
  if (!match || match.resolved) return;
  const winner = match[playerKey];
  if (!winner) return; // guard: can't pick a BYE or undefined slot
  match.winner   = winner;
  match.resolved = true;
  trnPropagate(roundIdx, matchIdx, winner);
  trnUpdateCurrentRound();
  saveTournamentState();
  renderTournamentBracket();
}

// Recursively un-propagate a winner back out of downstream rounds (used by undo)
function trnUnpropagate(ri, mi, winnerToClear) {
  const nextRound = tournamentState.rounds[ri + 1];
  if (!nextRound) return;
  const nextMi    = Math.floor(mi / 2);
  const nextMatch = nextRound[nextMi];
  if (!nextMatch) return;
  const slot = mi % 2 === 0 ? 'p1' : 'p2';
  if (nextMatch[slot] !== winnerToClear) return; // safety: only clear what we put there
  nextMatch[slot] = undefined;
  if (nextMatch.resolved) {
    const cascadedWinner = nextMatch.winner;
    nextMatch.winner   = null;
    nextMatch.resolved = false;
    if (cascadedWinner) trnUnpropagate(ri + 1, nextMi, cascadedWinner);
  }
}

function undoTrnMatch(ri, mi) {
  const ts = tournamentState;
  if (!ts) return;
  const match = ts.rounds[ri] && ts.rounds[ri][mi];
  if (!match || !match.resolved) return;
  // Only undo user-picked matches — BYE auto-resolutions are not undoable
  if (match.p1 === null || match.p2 === null) return;
  const winner = match.winner;
  // Clear this match
  match.winner   = null;
  match.resolved = false;
  // Un-propagate the winner out of downstream rounds recursively
  trnUnpropagate(ri, mi, winner);
  // Clear champion (re-detected below if final is still somehow resolved)
  ts.champion = null;
  trnUpdateCurrentRound();
  saveTournamentState();
  renderTournamentBracket();
}

// ── Home resume button ─────────────────────────────────
function updateHomeResumeButton() {
  const btn = document.getElementById('btn-resume-tournament');
  if (!btn) return;
  const ts = loadTournamentState();
  btn.style.display = (ts && !ts.champion) ? 'flex' : 'none';
}

// ── Setup screen ───────────────────────────────────────
let trnPlayers = [];

function renderTournamentSetup() {
  const scr = document.getElementById('screen-tournament-setup');
  if (!scr) return;

  const roster = getPlayers();
  trnPlayers = [];

  scr.innerHTML = `
    <div>
      <div class="page-title">Tournament</div>
      <div class="page-subtitle">2–20 players &middot; Knockout bracket</div>
    </div>

    ${roster.length ? `
    <div class="form-group">
      <label class="form-label">PHD Players &mdash; tap to add</label>
      <div class="trn-roster-grid" id="trn-roster-grid">
        ${roster.map(p =>
          `<button class="trn-roster-btn" data-trn-name="${escHtml(p.name)}">${escHtml(p.name)}</button>`
        ).join('')}
      </div>
    </div>` : ''}

    <div class="form-group">
      <label class="form-label">Add Guest Player</label>
      <div style="display:flex;gap:8px;">
        <input class="form-input" id="trn-guest-inp" type="text"
               placeholder="Guest name" maxlength="32"
               style="flex:1;min-height:48px;font-family:Arial,sans-serif;font-weight:400;"/>
        <button class="btn btn-secondary" id="trn-add-guest"
                style="width:auto;min-width:72px;min-height:48px;font-size:0.85rem;">Add</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Selected &mdash; <span id="trn-count">0</span> player(s)</label>
      <div class="trn-selected-list" id="trn-selected-list">
        <div class="empty-state" style="padding:16px 0;">
          <div class="empty-text">No players selected yet</div>
        </div>
      </div>
    </div>

    <div style="margin-top:auto;">
      <button class="btn btn-primary" id="trn-generate" disabled>Generate Bracket</button>
    </div>
  `;

  bindTournamentSetup();
}

function updateTrnSetupUI() {
  const countEl = document.getElementById('trn-count');
  if (countEl) countEl.textContent = trnPlayers.length;

  const gen = document.getElementById('trn-generate');
  if (gen) {
    const ok = trnPlayers.length >= 2 && trnPlayers.length <= 20;
    gen.disabled = !ok;
    gen.textContent = trnPlayers.length > 20
      ? 'Too many players (max 20)'
      : ('Generate Bracket' + (ok ? ' (' + trnPlayers.length + ' players)' : ''));
  }

  const list = document.getElementById('trn-selected-list');
  if (list) {
    list.innerHTML = trnPlayers.length
      ? trnPlayers.map((name, i) => `
          <div class="trn-selected-item">
            <span class="trn-selected-name">${escHtml(name)}</span>
            <button class="trn-remove-btn" data-trn-rm="${i}">&#10005;</button>
          </div>`).join('')
      : '<div class="empty-state" style="padding:16px 0;"><div class="empty-text">No players selected yet</div></div>';
  }

  const grid = document.getElementById('trn-roster-grid');
  if (grid) {
    grid.querySelectorAll('.trn-roster-btn').forEach(btn => {
      btn.classList.toggle('trn-sel', trnPlayers.includes(btn.dataset.trnName));
    });
  }
}

function bindTournamentSetup() {
  const grid = document.getElementById('trn-roster-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.trn-roster-btn');
      if (!btn) return;
      const name = btn.dataset.trnName;
      const idx  = trnPlayers.indexOf(name);
      if (idx !== -1) trnPlayers.splice(idx, 1);
      else if (trnPlayers.length < 20) trnPlayers.push(name);
      updateTrnSetupUI();
    });
  }

  const guestInp = document.getElementById('trn-guest-inp');
  const addBtn   = document.getElementById('trn-add-guest');
  const doAdd = () => {
    const name = (guestInp ? guestInp.value : '').trim();
    if (!name || trnPlayers.includes(name) || trnPlayers.length >= 20) return;
    trnPlayers.push(name);
    if (guestInp) guestInp.value = '';
    updateTrnSetupUI();
  };
  if (addBtn)   addBtn.addEventListener('click', doAdd);
  if (guestInp) guestInp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

  const list = document.getElementById('trn-selected-list');
  if (list) {
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-trn-rm]');
      if (btn) { trnPlayers.splice(parseInt(btn.dataset.trnRm, 10), 1); updateTrnSetupUI(); }
    });
  }

  const gen = document.getElementById('trn-generate');
  if (gen) {
    gen.addEventListener('click', () => {
      if (trnPlayers.length < 2) return;
      buildBracket([...trnPlayers]);
      updateHomeResumeButton();
      navigateTo('screen-tournament-bracket');
    });
  }
}

// ── Bracket screen ─────────────────────────────────────
const TRN_SLOT_H = 100; // px height per round-0 match slot

function trnRoundLabel(idx, total) {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Final';
  if (fromEnd === 2) return 'Quarter-Final';
  return 'Round ' + (idx + 1);
}

function renderTournamentBracket() {
  const scr = document.getElementById('screen-tournament-bracket');
  if (!scr) return;

  const ts = tournamentState;
  if (!ts) {
    scr.innerHTML = '<div class="empty-state"><div class="empty-text">No tournament in progress.</div></div>';
    if (!scr._trnBound) { scr._trnBound = true; scr.addEventListener('click', trnBracketClick); }
    return;
  }

  const r0 = ts.rounds[0];
  const totalH = r0.length * TRN_SLOT_H;
  const totalRounds = ts.rounds.length;

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:10px;">
      <div>
        <div class="page-title" style="margin-bottom:0;text-align:left;font-size:1.3rem;">Tournament</div>
        <div class="page-subtitle" style="margin-bottom:0;text-align:left;">${ts.players.length} players</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" id="trn-home-btn"
                style="width:auto;min-width:68px;">&#127968; Home</button>
        <button class="btn btn-danger btn-sm" id="trn-new-btn"
                style="width:auto;min-width:68px;">New &#10005;</button>
      </div>
    </div>
  `;

  if (ts.champion) {
    html += `
      <div class="trn-champ-banner">
        <div class="trn-champ-icon">&#127942;</div>
        <div class="trn-champ-label">Tournament Champion</div>
        <div class="trn-champ-name">${escHtml(ts.champion)}</div>
        <div class="trn-champ-sub">Congratulations!</div>
      </div>
    `;
  }

  html += `<div class="bracket-scroll"><div class="bracket-container">`;

  ts.rounds.forEach((round, ri) => {
    const slotFlex = r0.length / round.length;
    const label    = trnRoundLabel(ri, totalRounds);
    // A round is "active" (highlighted) if it has at least one match ready to play
    const isActive = !ts.champion && round.some(m =>
      !m.resolved && m.p1 !== undefined && m.p2 !== undefined && m.p1 !== null && m.p2 !== null
    );

    html += `
      <div class="bracket-round${isActive ? ' bracket-round-active' : ''}">
        <div class="bracket-round-label">${label}</div>
        <div class="bracket-round-matches" style="height:${totalH}px;">
    `;

    round.forEach((match, mi) => {
      // p1/p2 can be: string (player), null (BYE), undefined (TBD — not yet known)
      const p1Tbd  = match.p1 === undefined;
      const p2Tbd  = match.p2 === undefined;
      const p1Null = match.p1 === null;
      const p2Null = match.p2 === null;
      const p1Name = p1Tbd ? 'TBD' : (p1Null ? 'BYE' : match.p1);
      const p2Name = p2Tbd ? 'TBD' : (p2Null ? 'BYE' : match.p2);
      const p1Win  = !!(match.winner && match.winner === match.p1);
      const p2Win  = !!(match.winner && match.winner === match.p2);
      const p1cls  = p1Tbd ? ' bp-tbd' : p1Null ? ' bp-bye' : p1Win ? ' bp-win' : (match.winner ? ' bp-out' : '');
      const p2cls  = p2Tbd ? ' bp-tbd' : p2Null ? ' bp-bye' : p2Win ? ' bp-win' : (match.winner ? ' bp-out' : '');
      // Pickable: both players are real and known, match not yet resolved, no champion yet
      const canPick      = !ts.champion && !match.resolved && !p1Tbd && !p2Tbd && !p1Null && !p2Null;
      // Undoable: user-resolved match (both sides were real players, not a BYE auto-resolve)
      const isUserResolved = match.resolved && !p1Null && !p2Null && !p1Tbd && !p2Tbd;
      const p1attr       = canPick ? `data-pick-r="${ri}" data-pick-m="${mi}" data-pick-p="p1"` : 'disabled';
      const p2attr       = canPick ? `data-pick-r="${ri}" data-pick-m="${mi}" data-pick-p="p2"` : 'disabled';

      html += `
        <div class="bracket-slot" style="flex:${slotFlex};">
          <div class="bracket-match${canPick ? ' bm-active' : ''}${match.resolved ? ' bm-done' : ''}">
            <button class="bracket-player${p1cls}" ${p1attr}>${escHtml(p1Name)}</button>
            <div class="bracket-vs">vs</div>
            <button class="bracket-player${p2cls}" ${p2attr}>${escHtml(p2Name)}</button>
            ${isUserResolved ? `<button class="trn-undo-btn" data-trn-undo-r="${ri}" data-trn-undo-m="${mi}">&#8617; Undo</button>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`; // close bracket-round-matches + bracket-round
    if (ri < ts.rounds.length - 1) html += `<div class="bracket-connector"></div>`;
  });

  html += `</div></div>`; // close bracket-container + bracket-scroll

  scr.innerHTML = html;

  // Bind click delegation once — persists across innerHTML replacements
  if (!scr._trnBound) { scr._trnBound = true; scr.addEventListener('click', trnBracketClick); }
}

function trnBracketClick(e) {
  const pickBtn = e.target.closest('[data-pick-r]');
  if (pickBtn) {
    const ri = parseInt(pickBtn.dataset.pickR, 10);
    const mi = parseInt(pickBtn.dataset.pickM, 10);
    const pk = pickBtn.dataset.pickP;
    pickTrnWinner(ri, mi, pk);
    return;
  }
  const undoBtn = e.target.closest('[data-trn-undo-r]');
  if (undoBtn) {
    undoTrnMatch(parseInt(undoBtn.dataset.trnUndoR, 10), parseInt(undoBtn.dataset.trnUndoM, 10));
    return;
  }
  if (e.target.closest('#trn-home-btn')) {
    navigateTo('screen-home');
    return;
  }
  if (e.target.closest('#trn-new-btn')) {
    if (confirm('Start a new tournament? The current bracket will be cleared.')) {
      clearTournamentState();
      updateHomeResumeButton();
      navigateTo('screen-tournament-setup');
    }
  }
}

// ── Initial renders (direct calls, no navigateTo involved) ───
renderTrainingSetup();
renderMatchHistory();

// ── Boot: show home screen as the definitive last act ────────
showScreen('screen-home');
screenStack.length = 0;
console.log('[boot] showScreen(screen-home) complete — active:',
  document.querySelector('.screen.active') && document.querySelector('.screen.active').id);

// ── Tournament init ────────────────────────────────────
renderTournamentSetup();
tournamentState = loadTournamentState();
updateHomeResumeButton();
document.getElementById('btn-resume-tournament').addEventListener('click', () => {
  tournamentState = loadTournamentState();
  navigateTo('screen-tournament-bracket');
});

// ── Wrap navigateTo AFTER boot so it cannot fire during init ─
// Any navigateTo('screen-training') or ('screen-history') call
// that happened before this point would have used the raw Phase 2
// navigateTo and NOT triggered the re-render side effects.
(function(){
  const _orig = navigateTo;
  window.navigateTo = function(id) {
    _orig(id);
    if (id === 'screen-history')  renderMatchHistory();
    if (id === 'screen-training') renderTrainingSetup();
  };
}());

// ── Tournament navigate wrapper ────────────────────────
(function(){
  const _orig = window.navigateTo;
  window.navigateTo = function(id) {
    _orig(id);
    if (id === 'screen-tournament-setup')   renderTournamentSetup();
    if (id === 'screen-tournament-bracket') renderTournamentBracket();
    if (id === 'screen-home')               updateHomeResumeButton();
  };
}());

console.log('All scripts complete');
