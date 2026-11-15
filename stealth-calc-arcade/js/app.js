(function () {
  const A = window.Arcade;
  const { state, audio, calc } = A;

  // DOM Elements - Calculator
  const calcView = document.getElementById('calc-view');
  const calcExpr = document.getElementById('calc-expr');
  const calcResult = document.getElementById('calc-result');
  const lcdAnsBadge = document.getElementById('lcd-ans-badge');
  const calcTape = document.getElementById('calc-tape');
  const calcTapeList = document.getElementById('calc-tape-list');
  const calcSkinLabel = document.getElementById('calc-skin-label');
  const calibrationCode = document.getElementById('calibration-code');

  // DOM Elements - Hub & Stage
  const unlockOverlay = document.getElementById('unlock-overlay');
  const hubView = document.getElementById('hub-view');
  const gameGrid = document.getElementById('game-grid');
  const hubLevel = document.getElementById('hub-level');
  const hubXpFill = document.getElementById('hub-xp-fill');
  const hubXpText = document.getElementById('hub-xp-text');
  const hubCredits = document.getElementById('hub-credits');
  const hubStars = document.getElementById('hub-stars');
  const categoryTabs = document.getElementById('category-tabs');
  const hubSearch = document.getElementById('hub-search');
  const btnSound = document.getElementById('btn-sound');

  const gameStage = document.getElementById('game-stage');
  const stageTitle = document.getElementById('stage-title');
  const stageGenre = document.getElementById('stage-genre');
  const stageScore = document.getElementById('stage-score');
  const stageBest = document.getElementById('stage-best');
  const stageCredits = document.getElementById('stage-credits');
  const stageStars = document.getElementById('stage-stars');
  const stageHelpBanner = document.getElementById('stage-help-banner');
  const btnStagePause = document.getElementById('btn-stage-pause');
  const gameMount = document.getElementById('game-mount');

  // Shop & Settings Elements
  const shopItemsEl = document.getElementById('shop-items');
  const inputCustomEq = document.getElementById('input-custom-eq');
  const eqStatusMsg = document.getElementById('eq-status-msg');

  let lastAns = 0;
  let justEvaluated = false;
  let activeCategory = 'All';
  let activeGame = null;
  let activeCleanup = null;
  let stagePaused = false;
  let currentScore = 0;

  // =========================================================
  // SKIN & THEME APPLICATION
  // =========================================================
  function applySkin() {
    document.body.classList.remove('theme-classic', 'theme-amber', 'theme-cyber', 'theme-gold');
    document.body.classList.add('theme-' + (state.activeSkin || 'classic'));
    const names = {
      classic: 'Standard Chassis',
      amber: 'Amber Lab Skin',
      cyber: 'Cyber Indigo Skin',
      gold: 'Executive Gold Skin'
    };
    calcSkinLabel.textContent = names[state.activeSkin] || 'Standard Chassis';
  }

  // =========================================================
  // CALCULATOR LOGIC
  // =========================================================
  function insertAtCursor(str) {
    if (justEvaluated && /^[0-9.(a-zπ√]/i.test(str) && !'+-*/^!'.includes(str)) {
      calcExpr.value = '';
    }
    justEvaluated = false;
    const start = calcExpr.selectionStart ?? calcExpr.value.length;
    const end = calcExpr.selectionEnd ?? calcExpr.value.length;
    const val = calcExpr.value;
    calcExpr.value = val.slice(0, start) + str + val.slice(end);
    const nextPos = start + str.length;
    calcExpr.setSelectionRange(nextPos, nextPos);
    calcExpr.focus();
  }

  function addTapeRow(expr, resText) {
    const row = document.createElement('div');
    row.className = 'tape-item';
    row.innerHTML = `<span>${expr}</span><strong>= ${resText}</strong>`;
    row.onclick = () => {
      calcExpr.value = expr;
      calcExpr.focus();
    };
    calcTapeList.prepend(row);
    while (calcTapeList.children.length > 20) {
      calcTapeList.removeChild(calcTapeList.lastChild);
    }
  }

  function evaluateCalculator() {
    const raw = calcExpr.value.trim();
    if (!raw) return;
    audio.playClick();
    try {
      const val = calc.evaluate(raw, lastAns);
      const formatted = calc.formatNumber(val);
      lastAns = val;
      calcResult.textContent = formatted;
      lcdAnsBadge.classList.add('active');
      justEvaluated = true;
      addTapeRow(raw, formatted);

      if (calc.checkUnlock(raw, val)) {
        triggerVaultUnlock();
      }
    } catch (err) {
      calcResult.textContent = 'Syntax Error';
    }
  }

  function triggerVaultUnlock() {
    closeAllModals();
    audio.playUnlock();
    unlockOverlay.classList.remove('hidden');
    setTimeout(() => {
      unlockOverlay.classList.add('hidden');
      calcView.classList.add('hidden');
      hubView.classList.remove('hidden');
      document.title = 'NEON VAULT // 20-Game Arcade';
      refreshHubStats();
      renderGameGrid();
    }, 900);
  }

  function activateBossKey() {
    teardownActiveGame();
    closeAllModals();
    hubView.classList.add('hidden');
    unlockOverlay.classList.add('hidden');
    calcView.classList.remove('hidden');
    document.title = 'CASIO fx-1337EX // Scientific Calculator';
    // Put an innocent math formula on display
    const decoyExpr = 'sin(45)*cos(30)+sqrt(2)';
    calcExpr.value = decoyExpr;
    try {
      const v = calc.evaluate(decoyExpr, 0);
      calcResult.textContent = calc.formatNumber(v);
      lastAns = v;
    } catch (_) {
      calcResult.textContent = '2.0265772';
    }
    justEvaluated = true;
    calcExpr.focus();
  }

  document.querySelectorAll('.calc-keypad .key').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.playClick();
      const ins = btn.dataset.insert;
      const act = btn.dataset.action;
      if (ins) {
        insertAtCursor(ins);
      } else if (act === 'ans') {
        insertAtCursor('ANS');
      } else if (act === 'del') {
        const start = calcExpr.selectionStart ?? calcExpr.value.length;
        const end = calcExpr.selectionEnd ?? calcExpr.value.length;
        if (start !== end) {
          calcExpr.value = calcExpr.value.slice(0, start) + calcExpr.value.slice(end);
          calcExpr.setSelectionRange(start, start);
        } else if (start > 0) {
          calcExpr.value = calcExpr.value.slice(0, start - 1) + calcExpr.value.slice(start);
          calcExpr.setSelectionRange(start - 1, start - 1);
        }
        calcExpr.focus();
      } else if (act === 'ac') {
        calcExpr.value = '';
        calcResult.textContent = '0';
        justEvaluated = false;
        calcExpr.focus();
      }
    });
  });

  document.getElementById('btn-calc-equals').addEventListener('click', evaluateCalculator);
  calcExpr.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      evaluateCalculator();
    }
  });

  document.getElementById('btn-history-toggle').addEventListener('click', () => {
    calcTape.classList.toggle('hidden');
  });
  document.getElementById('btn-clear-tape').addEventListener('click', () => {
    calcTapeList.innerHTML = '';
  });
  document.getElementById('btn-formulas').addEventListener('click', () => {
    calibrationCode.textContent = state.customEquation || A.DEFAULT_EQUATION;
    document.getElementById('formula-modal').classList.remove('hidden');
  });
  document.getElementById('btn-fill-calibration').addEventListener('click', () => {
    calcExpr.value = state.customEquation || A.DEFAULT_EQUATION;
    document.getElementById('formula-modal').classList.add('hidden');
    calcExpr.focus();
  });

  // =========================================================
  // MODALS & GLOBAL CONTROLS
  // =========================================================
  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close)?.classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => {
      if (e.target === bd) bd.classList.add('hidden');
    });
  });

  // Boss Key global shortcuts & prevent game key scroll
  window.addEventListener('keydown', e => {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';

    if (e.key === 'Escape' || e.key === '~' || (e.code === 'Backquote' && e.shiftKey)) {
      if (!hubView.classList.contains('hidden')) {
        e.preventDefault();
        activateBossKey();
        return;
      }
    }

    if (!gameStage.classList.contains('hidden') && !typing) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    }
  });

  document.getElementById('btn-boss-key').addEventListener('click', activateBossKey);
  document.getElementById('btn-stage-boss').addEventListener('click', activateBossKey);

  // =========================================================
  // HUB RENDERING & FILTERING
  // =========================================================
  function refreshHubStats() {
    hubLevel.textContent = state.level;
    const req = A.xpForNextLevel(state.level);
    const pct = Math.min(100, Math.round((state.xp / req) * 100));
    hubXpFill.style.width = pct + '%';
    hubXpText.textContent = `${state.xp} / ${req} XP`;
    hubCredits.textContent = state.credits;
    hubStars.textContent = A.totalStars();
    stageCredits.textContent = state.credits;
    btnSound.textContent = state.soundOn ? '🔊 SFX: ON' : '🔇 SFX: OFF';
  }

  function renderStarsText(count) {
    return '★'.repeat(count) + '☆'.repeat(3 - count);
  }

  function renderGameGrid() {
    const q = hubSearch.value.trim().toLowerCase();
    const list = A.games.filter(g => {
      if (activeCategory === 'Favorites' && !state.favorites.includes(g.id)) return false;
      if (activeCategory !== 'All' && activeCategory !== 'Favorites' && g.category !== activeCategory) return false;
      if (q) {
        const hay = `${g.title} ${g.genre} ${g.description} ${g.mechanics.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    gameGrid.innerHTML = '';
    if (list.length === 0) {
      gameGrid.innerHTML = `<div class="g-panel" style="grid-column:1/-1;text-align:center;">No matching games found. Try clearing your filter!</div>`;
      return;
    }

    list.forEach(g => {
      const card = document.createElement('article');
      card.className = 'game-card';
      const isFav = state.favorites.includes(g.id);
      const best = state.highScores[g.id] || 0;
      const stars = state.stars[g.id] || 0;

      card.innerHTML = `
        <div class="card-top">
          <div style="display:flex;gap:12px;align-items:center;">
            <div class="card-icon">${g.icon}</div>
            <div class="card-title-block">
              <h3>${g.title}</h3>
              <span class="card-cat">${g.category} • ${g.genre}</span>
            </div>
          </div>
          <button class="card-fav-btn ${isFav ? 'active' : ''}" type="button" title="Toggle Favorite">★</button>
        </div>
        <p class="card-desc">${g.description}</p>
        <div class="card-tags">
          ${g.mechanics.map(m => `<span class="card-tag">${m}</span>`).join('')}
        </div>
        <div class="card-footer">
          <span class="card-stars">${renderStarsText(stars)}</span>
          <span class="card-best">BEST: ${best.toLocaleString()}</span>
        </div>
      `;

      card.querySelector('.card-fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        const idx = state.favorites.indexOf(g.id);
        if (idx >= 0) state.favorites.splice(idx, 1);
        else state.favorites.push(g.id);
        A.save();
        audio.playClick();
        renderGameGrid();
      });

      card.addEventListener('click', () => launchGame(g));
      gameGrid.appendChild(card);
    });
  }

  categoryTabs.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      audio.playClick();
      renderGameGrid();
    });
  });

  hubSearch.addEventListener('input', renderGameGrid);

  document.getElementById('btn-random-game').addEventListener('click', () => {
    if (A.games.length === 0) return;
    const pick = A.games[Math.floor(Math.random() * A.games.length)];
    launchGame(pick);
  });

  btnSound.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    A.save();
    refreshHubStats();
  });

  // =========================================================
  // META SHOP & VAULT SETTINGS
  // =========================================================
  function renderShop() {
    shopItemsEl.innerHTML = '';
    A.shopItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'shop-item';

      if (item.type === 'upgrade') {
        const lvl = state.upgrades[item.id] || 0;
        const maxed = lvl >= item.maxLevel;
        const cost = Math.round(item.baseCost * Math.pow(1.6, lvl));
        card.innerHTML = `
          <div>
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            <div style="margin-top:6px;font-size:11px;color:#ffd166;">Level: ${lvl} / ${item.maxLevel}</div>
          </div>
          <button class="g-btn g-btn-primary" ${maxed || state.credits < cost ? 'disabled' : ''}>
            ${maxed ? 'MAXED' : `Upgrade (${cost} CR)`}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (maxed || state.credits < cost) return;
          state.credits -= cost;
          state.upgrades[item.id] = lvl + 1;
          A.save();
          audio.playPowerup();
          refreshHubStats();
          renderShop();
        };
      } else {
        const owned = state.unlockedSkins.includes(item.skinKey);
        const equipped = state.activeSkin === item.skinKey;
        card.innerHTML = `
          <div>
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
          </div>
          <button class="g-btn ${equipped ? 'g-btn-gold' : 'g-btn-primary'}" ${!owned && state.credits < item.cost ? 'disabled' : ''}>
            ${equipped ? '✓ Equipped' : owned ? 'Equip Skin' : `Unlock (${item.cost} CR)`}
          </button>
        `;
        card.querySelector('button').onclick = () => {
          if (owned) {
            state.activeSkin = item.skinKey;
          } else if (state.credits >= item.cost) {
            state.credits -= item.cost;
            state.unlockedSkins.push(item.skinKey);
            state.activeSkin = item.skinKey;
            audio.playPowerup();
          }
          A.save();
          applySkin();
          refreshHubStats();
          renderShop();
        };
      }
      shopItemsEl.appendChild(card);
    });
  }

  document.getElementById('btn-shop').addEventListener('click', () => {
    renderShop();
    document.getElementById('shop-modal').classList.remove('hidden');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    inputCustomEq.value = state.customEquation || A.DEFAULT_EQUATION;
    eqStatusMsg.textContent = '';
    document.getElementById('settings-modal').classList.remove('hidden');
  });

  document.getElementById('btn-save-eq').addEventListener('click', () => {
    const raw = inputCustomEq.value.trim();
    try {
      const val = calc.evaluate(raw, 0);
      const ops = calc.countDistinctOperators(raw);
      if (ops < 3) {
        eqStatusMsg.textContent = 'Equation must use at least 3 distinct operators/functions for stealth security.';
        eqStatusMsg.style.color = '#ff4d6d';
        return;
      }
      state.customEquation = raw;
      A.save();
      eqStatusMsg.textContent = `Saved! Equation evaluates to ${calc.formatNumber(val)}.`;
      eqStatusMsg.style.color = '#2ee59d';
      audio.playPowerup();
    } catch (err) {
      eqStatusMsg.textContent = 'Invalid math syntax: ' + err.message;
      eqStatusMsg.style.color = '#ff4d6d';
    }
  });

  document.getElementById('btn-reset-save').addEventListener('click', () => {
    if (confirm('Reset all high scores, stars, credits, and upgrades?')) {
      A.resetSave();
      applySkin();
      refreshHubStats();
      renderGameGrid();
      closeAllModals();
    }
  });

  // =========================================================
  // ACTIVE GAME STAGE LIFECYCLE
  // =========================================================
  function teardownActiveGame() {
    if (typeof activeCleanup === 'function') {
      try { activeCleanup(); } catch (_) {}
      activeCleanup = null;
    }
    gameMount.innerHTML = '';
    activeGame = null;
    stagePaused = false;
    btnStagePause.textContent = '⏸ Pause';
    gameStage.classList.add('hidden');
  }

  function updateStageHUD(score) {
    currentScore = Math.max(0, Math.floor(score));
    stageScore.textContent = currentScore.toLocaleString();
    if (!activeGame) return;
    const res = A.reportScore(activeGame.id, currentScore, activeGame.stars);
    stageBest.textContent = res.best.toLocaleString();
    stageStars.textContent = renderStarsText(res.stars);
    stageCredits.textContent = state.credits;
  }

  function launchGame(game) {
    teardownActiveGame();
    activeGame = game;
    currentScore = 0;
    stagePaused = false;

    stageTitle.textContent = `${game.icon} ${game.title}`;
    stageGenre.textContent = `${game.category} • ${game.genre}`;
    stageScore.textContent = '0';
    stageBest.textContent = (state.highScores[game.id] || 0).toLocaleString();
    stageCredits.textContent = state.credits;
    stageStars.textContent = renderStarsText(state.stars[game.id] || 0);
    stageHelpBanner.textContent = `Controls: ${game.controls} | Star Targets: ${game.stars.join(' / ')}`;
    stageHelpBanner.classList.add('hidden');
    gameStage.classList.remove('hidden');

    const extraCleanups = [];
    const api = {
      setScore(val) {
        updateStageHUD(val);
      },
      addCredits(amount) {
        A.addCredits(amount);
        refreshHubStats();
      },
      addXP(amount) {
        A.addXP(amount);
        refreshHubStats();
      },
      gameOver(finalScore) {
        updateStageHUD(finalScore);
        A.addXP(15);
        refreshHubStats();
      },
      isPaused() {
        return stagePaused;
      },
      getStartingShields() {
        return state.upgrades.startShield || 0;
      },
      registerCleanup(fn) {
        if (typeof fn === 'function') extraCleanups.push(fn);
      }
    };

    const retCleanup = game.mount(gameMount, api);
    activeCleanup = () => {
      if (typeof retCleanup === 'function') retCleanup();
      extraCleanups.forEach(fn => { try { fn(); } catch (_) {} });
    };
  }

  document.getElementById('btn-back-hub').addEventListener('click', () => {
    teardownActiveGame();
    refreshHubStats();
    renderGameGrid();
  });

  document.getElementById('btn-stage-help').addEventListener('click', () => {
    stageHelpBanner.classList.toggle('hidden');
  });

  btnStagePause.addEventListener('click', () => {
    stagePaused = !stagePaused;
    btnStagePause.textContent = stagePaused ? '▶ Resume' : '⏸ Pause';
  });

  document.getElementById('btn-stage-restart').addEventListener('click', () => {
    if (activeGame) launchGame(activeGame);
  });

  // Init
  applySkin();
  refreshHubStats();
  renderGameGrid();
})();
