(function () {
  const { audio, fx } = window.Arcade;

  // =========================================================
  // GAME 17: QUANTUM IDLE FACTORY (Clicker & Prestige Tycoon)
  // =========================================================
  window.Arcade.registerGame({
    id: 'quantum-factory',
    title: 'Quantum Idle Factory',
    category: 'Sim & Word',
    icon: '🏭',
    genre: 'Idle Clicker & Prestige Tycoon',
    description: 'Harvest Quanta by clicking the Core, automating 8 generator tiers, unlocking Tech multipliers, timing Reactor Overclocks, and Prestiging for Dark Matter.',
    mechanics: ['8 Automated Generators', 'Tech Tree Upgrades', 'Reactor Timing Mini-Game', 'Dark Matter Prestige'],
    controls: 'Click the Quantum Core | Catch Golden Anomalies | Hit Overclock in the Green Zone',
    stars: [500, 3000, 15000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="qf-quanta">QUANTA: 0</span>
          <span class="g-badge" id="qf-qps">QPS: 0/s</span>
          <span class="g-badge" id="qf-dm">DARK MATTER: 0 (+0%)</span>
          <button class="g-btn g-btn-gold" id="qf-prestige">✦ Prestige (Need 5,000 Total)</button>
        </div>
        <div class="g-row" style="width:100%;max-width:940px;align-items:flex-start;">
          <div class="g-panel" style="flex:1;min-width:280px;text-align:center;position:relative;">
            <button id="qf-core" style="width:150px;height:150px;border-radius:50%;border:3px solid #00f0ff;background:radial-gradient(circle,#00f0ff,#1d4ed8,#090d16);color:#fff;font-size:20px;font-weight:900;cursor:pointer;box-shadow:0 0 32px rgba(0,240,255,0.45);margin:10px 0;">
              ⚛ HARVEST<br><small id="qf-cpc" style="font-size:12px;">+1 / click</small>
            </button>
            <button id="qf-anomaly" class="g-btn g-btn-gold hidden" style="position:absolute;top:14px;right:14px;">✨ Golden Anomaly!</button>
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #243258;">
              <div style="font-size:12px;font-weight:700;margin-bottom:6px;">⚡ REACTOR OVERCLOCK MINI-GAME (2x Output 10s)</div>
              <div style="position:relative;height:20px;background:#0a0f1f;border-radius:999px;border:1px solid #304270;overflow:hidden;margin-bottom:8px;">
                <div style="position:absolute;left:40%;width:20%;height:100%;background:rgba(46,229,157,0.35);"></div>
                <div id="qf-needle" style="position:absolute;left:0%;width:6px;height:100%;background:#ffd166;"></div>
              </div>
              <button class="g-btn g-btn-primary" id="qf-overclock">Hit Overclock!</button>
              <div id="qf-buff" style="font-size:12px;color:#2ee59d;margin-top:4px;"></div>
            </div>
            <div style="margin-top:12px;text-align:left;">
              <strong style="font-size:12px;color:#00f0ff;">TECH RESEARCH</strong>
              <div id="qf-tech" class="g-row" style="justify-content:flex-start;margin-top:6px;"></div>
            </div>
          </div>
          <div class="g-panel" style="flex:1.2;min-width:300px;max-height:430px;overflow-y:auto;">
            <strong style="font-size:13px;color:#ffd166;">AUTOMATED GENERATORS (8 TIERS)</strong>
            <div id="qf-gens" style="display:flex;flex-direction:column;gap:8px;margin-top:8px;"></div>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const GENS = [
        { name: 'Micro-Capacitor', baseCost: 15, qps: 1 },
        { name: 'Flux Assembler', baseCost: 90, qps: 6 },
        { name: 'Neutrino Tap', baseCost: 420, qps: 24 },
        { name: 'Plasma Foundry', baseCost: 1800, qps: 95 },
        { name: 'Singularity Core', baseCost: 7500, qps: 360 },
        { name: 'Quark Forge', baseCost: 28000, qps: 1250 },
        { name: 'Dyson Lattice', baseCost: 110000, qps: 4500 },
        { name: 'Omega Synthesizer', baseCost: 450000, qps: 16000 }
      ];
      const TECHS = [
        { id: 't1', name: 'Click Gloves (+2x Click)', cost: 80 },
        { id: 't2', name: 'Cryo Coils (+50% QPS)', cost: 350 },
        { id: 't3', name: 'Laser Focus (+3x Click)', cost: 1200 },
        { id: 't4', name: 'Quantum Harmony (2x All)', cost: 4500 }
      ];

      let quanta = 0, totalEarned = 0, darkMatter = 0;
      let counts = GENS.map(() => 0);
      let boughtTech = new Set();
      let frenzyTimer = 0, overclockTimer = 0, anomalyCd = 10;
      let needlePos = 0, needleDir = 1;
      let rafId = 0;

      try {
        const saved = JSON.parse(localStorage.getItem('qf_save_v1') || 'null');
        if (saved) {
          quanta = saved.quanta || 0;
          totalEarned = saved.totalEarned || 0;
          darkMatter = saved.darkMatter || 0;
          if (Array.isArray(saved.counts)) counts = saved.counts;
          if (Array.isArray(saved.tech)) boughtTech = new Set(saved.tech);
        }
      } catch (_) {}

      function persist() {
        try {
          localStorage.setItem('qf_save_v1', JSON.stringify({
            quanta, totalEarned, darkMatter, counts, tech: [...boughtTech]
          }));
        } catch (_) {}
      }

      function getMult() {
        let m = 1 + darkMatter * 0.25;
        if (boughtTech.has('t2')) m *= 1.5;
        if (boughtTech.has('t4')) m *= 2;
        if (frenzyTimer > 0) m *= 10;
        if (overclockTimer > 0) m *= 2;
        return m;
      }

      function getQPS() {
        let sum = 0;
        GENS.forEach((g, i) => sum += g.qps * counts[i]);
        return sum * getMult();
      }

      function getClickPower() {
        let base = 1 + getQPS() * 0.04;
        if (boughtTech.has('t1')) base *= 2;
        if (boughtTech.has('t3')) base *= 3;
        return Math.max(1, Math.round(base * (1 + darkMatter * 0.25) * (frenzyTimer > 0 ? 10 : 1)));
      }

      function genCost(i) {
        return Math.floor(GENS[i].baseCost * Math.pow(1.16, counts[i]));
      }

      const quantaEl = wrap.querySelector('#qf-quanta');
      const qpsEl = wrap.querySelector('#qf-qps');
      const dmEl = wrap.querySelector('#qf-dm');
      const cpcEl = wrap.querySelector('#qf-cpc');
      const buffEl = wrap.querySelector('#qf-buff');
      const needleEl = wrap.querySelector('#qf-needle');
      const anomalyBtn = wrap.querySelector('#qf-anomaly');
      const prestigeBtn = wrap.querySelector('#qf-prestige');
      const gensEl = wrap.querySelector('#qf-gens');
      const techEl = wrap.querySelector('#qf-tech');

      function renderLists() {
        gensEl.innerHTML = '';
        GENS.forEach((g, i) => {
          const cost = genCost(i);
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#0a1021;padding:8px 10px;border-radius:8px;border:1px solid #223055;';
          row.innerHTML = `
            <div>
              <strong style="font-size:13px;">${g.name} (${counts[i]})</strong>
              <div style="font-size:11px;color:#94a3b8;">+${g.qps} base QPS each</div>
            </div>
            <button class="g-btn g-btn-primary" ${quanta < cost ? 'disabled' : ''}>Buy (${cost.toLocaleString()})</button>
          `;
          row.querySelector('button').onclick = () => {
            if (quanta < cost) return;
            quanta -= cost;
            counts[i]++;
            audio.playCoin();
            persist();
            renderLists();
          };
          gensEl.appendChild(row);
        });

        techEl.innerHTML = '';
        TECHS.forEach(t => {
          const owned = boughtTech.has(t.id);
          const b = document.createElement('button');
          b.className = 'g-btn' + (owned ? ' g-btn-gold' : '');
          b.disabled = owned || quanta < t.cost;
          b.textContent = owned ? `✓ ${t.name}` : `${t.name} (${t.cost})`;
          b.onclick = () => {
            if (owned || quanta < t.cost) return;
            quanta -= t.cost;
            boughtTech.add(t.id);
            audio.playPowerup();
            persist();
            renderLists();
          };
          techEl.appendChild(b);
        });
      }

      wrap.querySelector('#qf-core').onclick = () => {
        const gain = getClickPower();
        quanta += gain;
        totalEarned += gain;
        audio.playClick();
        api.setScore(Math.floor(Math.sqrt(totalEarned) * 15));
      };

      anomalyBtn.onclick = () => {
        anomalyBtn.classList.add('hidden');
        frenzyTimer = 8;
        api.addCredits(12);
        audio.playPowerup();
      };

      wrap.querySelector('#qf-overclock').onclick = () => {
        if (needlePos >= 38 && needlePos <= 62) {
          overclockTimer = 10;
          audio.playPowerup();
        } else {
          audio.playHit();
        }
      };

      prestigeBtn.onclick = () => {
        const reward = Math.floor(Math.sqrt(totalEarned / 5000));
        if (reward < 1) return;
        darkMatter += reward;
        quanta = 0;
        totalEarned = 0;
        counts = GENS.map(() => 0);
        boughtTech.clear();
        api.addCredits(reward * 25);
        api.addXP(reward * 40);
        audio.playUnlock();
        persist();
        renderLists();
      };

      let saveAcc = 0, listAcc = 0, last = performance.now();
      function loop(now) {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        if (!api.isPaused()) {
          const gain = getQPS() * dt;
          quanta += gain;
          totalEarned += gain;
          api.setScore(Math.floor(Math.sqrt(totalEarned) * 15));

          if (frenzyTimer > 0) frenzyTimer = Math.max(0, frenzyTimer - dt);
          if (overclockTimer > 0) overclockTimer = Math.max(0, overclockTimer - dt);

          anomalyCd -= dt;
          if (anomalyCd <= 0) {
            anomalyCd = 18 + Math.random() * 12;
            anomalyBtn.classList.remove('hidden');
            setTimeout(() => anomalyBtn.classList.add('hidden'), 5000);
          }

          needlePos += needleDir * 135 * dt;
          if (needlePos >= 98) { needlePos = 98; needleDir = -1; }
          if (needlePos <= 0) { needlePos = 0; needleDir = 1; }
          needleEl.style.left = needlePos + '%';
        }

        quantaEl.textContent = `QUANTA: ${Math.floor(quanta).toLocaleString()}`;
        qpsEl.textContent = `QPS: ${getQPS().toFixed(1)}/s`;
        dmEl.textContent = `DARK MATTER: ${darkMatter} (+${darkMatter * 25}%)`;
        cpcEl.textContent = `+${getClickPower().toLocaleString()} / click`;
        const buffs = [
          frenzyTimer > 0 && `10x ANOMALY (${frenzyTimer.toFixed(1)}s)`,
          overclockTimer > 0 && `2x OVERCLOCK (${overclockTimer.toFixed(1)}s)`
        ].filter(Boolean);
        buffEl.textContent = buffs.join(' | ');
        const dmGain = Math.floor(Math.sqrt(totalEarned / 5000));
        prestigeBtn.textContent = dmGain >= 1 ? `✦ Prestige (+${dmGain} Dark Matter)` : '✦ Prestige (Need 5,000 Total)';
        prestigeBtn.disabled = dmGain < 1;

        listAcc += dt;
        if (listAcc > 0.35) { listAcc = 0; renderLists(); }
        saveAcc += dt;
        if (saveAcc > 3) { saveAcc = 0; persist(); }

        rafId = requestAnimationFrame(loop);
      }

      renderLists();
      rafId = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(rafId); persist(); };
    }
  });

  // =========================================================
  // GAME 18: MINESWEEPER: ROGUE PROTOCOL
  // =========================================================
  window.Arcade.registerGame({
    id: 'minesweeper-rogue',
    title: 'MineSweeper: Rogue Protocol',
    category: 'Sim & Word',
    icon: '💣',
    genre: 'Roguelite Minesweeper',
    description: 'Classic chord-clearing Minesweeper upgraded with RPG HP/Shields, Radar Drones (safe 3x3 reveal), Defuse Kits, and hidden treasure chests!',
    mechanics: ['Safe First Click + Chording', 'RPG HP & Shields', 'Radar Drone (3x3 Safe Scan)', 'Hidden Treasure Chests'],
    controls: 'Left Click: Reveal / Chord | Right Click: Flag Mine | Use Radar / Defuse buttons',
    stars: [800, 2500, 6000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="ms-lvl">SECTOR 1 (10x10)</span>
          <span class="g-badge" id="ms-hp">HP: 3/3</span>
          <span class="g-badge" id="ms-mines">MINES: 14</span>
          <button class="g-btn g-btn-primary" id="ms-radar">📡 Radar 3x3 (<span id="ms-rc">2</span>)</button>
          <button class="g-btn g-btn-gold" id="ms-defuse">🛠 Defuse Kit (<span id="ms-dc">1</span>)</button>
        </div>
        <div id="ms-board" style="display:grid;gap:3px;background:#0c1326;padding:10px;border-radius:12px;border:2px solid #2b3c6e;"></div>
        <div id="ms-msg" style="font-size:13px;color:#2ee59d;font-weight:700;">First click is always safe!</div>
      `;
      container.appendChild(wrap);

      const boardEl = wrap.querySelector('#ms-board');
      const lvlEl = wrap.querySelector('#ms-lvl');
      const hpEl = wrap.querySelector('#ms-hp');
      const minesEl = wrap.querySelector('#ms-mines');
      const rcEl = wrap.querySelector('#ms-rc');
      const dcEl = wrap.querySelector('#ms-dc');
      const msgEl = wrap.querySelector('#ms-msg');
      const radarBtn = wrap.querySelector('#ms-radar');
      const defuseBtn = wrap.querySelector('#ms-defuse');

      let sector = 1, rows = 10, cols = 10, mineCount = 14;
      let grid, firstClick, hp = 3 + api.getStartingShields(), maxHp = hp, radars = 2, defuses = 1, score = 0;
      let radarMode = false, defuseMode = false, dead = false;

      function initSector(sec) {
        sector = sec;
        rows = Math.min(14, 9 + sec);
        cols = Math.min(16, 9 + sec);
        mineCount = Math.round(rows * cols * 0.16);
        firstClick = true;
        radarMode = false;
        defuseMode = false;
        dead = false;
        grid = Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => ({ mine: false, rev: false, flag: false, adj: 0, chest: false }))
        );
        boardEl.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
        render();
      }

      function placeMines(safeR, safeC) {
        let placed = 0;
        while (placed < mineCount) {
          const r = Math.floor(Math.random() * rows);
          const c = Math.floor(Math.random() * cols);
          if (grid[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue;
          grid[r][c].mine = true;
          placed++;
        }
        // Compute adjacency & place 2 treasure chests
        let chests = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c].mine) continue;
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
              if (grid[r + dr]?.[c + dc]?.mine) count++;
            }
            grid[r][c].adj = count;
            if (chests < 2 && count > 0 && Math.random() < 0.08) {
              grid[r][c].chest = true; chests++;
            }
          }
        }
      }

      function revealCell(r, c) {
        const cell = grid[r]?.[c];
        if (!cell || cell.rev || cell.flag) return;
        cell.rev = true;
        if (cell.mine) {
          hp--;
          audio.playExplosion();
          if (hp <= 0) {
            dead = true;
            grid.forEach(row => row.forEach(x => { if (x.mine) x.rev = true; }));
            api.gameOver(score);
            api.addCredits(Math.floor(score / 80));
            msgEl.textContent = 'SYSTEM DESTROYED! Click Restart in top bar to try again.';
            msgEl.style.color = '#ff4d6d';
          } else {
            msgEl.textContent = `Mine triggered! Armor absorbed blast (${hp} HP left).`;
            msgEl.style.color = '#ffd166';
          }
          return;
        }
        score += 15;
        if (cell.chest) {
          cell.chest = false;
          api.addCredits(12);
          radars++;
          score += 100;
          audio.playPowerup();
          msgEl.textContent = 'Found Loot Chest! +12 CR & +1 Radar Drone!';
        }
        api.setScore(score);
        if (cell.adj === 0) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            revealCell(r + dr, c + dc);
          }
        }
      }

      function checkWin() {
        let safeLeft = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (!grid[r][c].mine && !grid[r][c].rev) safeLeft++;
        }
        if (safeLeft === 0 && !dead) {
          score += 300 * sector;
          api.setScore(score);
          api.addCredits(20 + sector * 5);
          api.addXP(30);
          audio.playPowerup();
          msgEl.textContent = `SECTOR ${sector} CLEARED! Loading next board...`;
          setTimeout(() => initSector(sector + 1), 1100);
        }
      }

      radarBtn.onclick = () => {
        if (radars <= 0 || dead) return;
        radarMode = !radarMode; defuseMode = false;
        msgEl.textContent = radarMode ? 'Radar Active: Click any tile to safely scan 3x3!' : 'Radar cancelled.';
      };
      defuseBtn.onclick = () => {
        if (defuses <= 0 || dead) return;
        defuseMode = !defuseMode; radarMode = false;
        msgEl.textContent = defuseMode ? 'Defuse Kit: Click a hidden tile to disarm & flag!' : 'Defuse cancelled.';
      };

      const NUM_COLS = ['', '#38bdf8', '#2ee59d', '#ff4d6d', '#a855f7', '#ffd166', '#00f0ff', '#fff', '#94a3b8'];

      function render() {
        lvlEl.textContent = `SECTOR ${sector} (${cols}x${rows})`;
        hpEl.textContent = `HP: ${hp}/${maxHp}`;
        const flagged = grid.flat().filter(x => x.flag).length;
        minesEl.textContent = `MINES: ${mineCount - flagged}`;
        rcEl.textContent = radars;
        dcEl.textContent = defuses;

        boardEl.innerHTML = '';
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            const btn = document.createElement('button');
            btn.style.cssText = `width:30px;height:30px;border-radius:5px;border:1px solid #2b3c6e;font-weight:800;font-size:13px;cursor:pointer;padding:0;` +
              (cell.rev
                ? cell.mine ? 'background:#991b1b;color:#fff;' : 'background:#0d152a;color:' + (NUM_COLS[cell.adj] || '#fff') + ';'
                : 'background:#1c294f;color:#ffd166;');
            if (cell.rev) btn.textContent = cell.mine ? '💣' : (cell.adj > 0 ? cell.adj : '');
            else if (cell.flag) btn.textContent = '🚩';
            else if (cell.chest) btn.textContent = '';

            btn.onclick = () => {
              if (dead || api.isPaused()) return;
              if (firstClick) { firstClick = false; placeMines(r, c); }
              if (radarMode) {
                radarMode = false; radars--;
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                  const t = grid[r + dr]?.[c + dc];
                  if (t) {
                    if (t.mine) t.flag = true;
                    else revealCell(r + dr, c + dc);
                  }
                }
                audio.playPowerup();
                checkWin(); render(); return;
              }
              if (defuseMode) {
                defuseMode = false; defuses--;
                if (cell.mine) { cell.flag = true; msgEl.textContent = 'Mine safely disarmed!'; }
                else { revealCell(r, c); msgEl.textContent = 'Area clear.'; }
                audio.playCoin();
                checkWin(); render(); return;
              }

              // Chord clear if clicking revealed number with matching flags
              if (cell.rev && cell.adj > 0) {
                let adjFlags = 0;
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                  if (grid[r + dr]?.[c + dc]?.flag) adjFlags++;
                }
                if (adjFlags === cell.adj) {
                  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                    revealCell(r + dr, c + dc);
                  }
                }
              } else {
                revealCell(r, c);
              }
              audio.playClick();
              checkWin();
              render();
            };

            btn.oncontextmenu = e => {
              e.preventDefault();
              if (dead || cell.rev) return;
              cell.flag = !cell.flag;
              audio.playClick();
              render();
            };
            boardEl.appendChild(btn);
          }
        }
      }

      api.setScore(0);
      initSector(1);
      return () => {};
    }
  });

  // =========================================================
  // GAME 19: LEXICRYPT: WORD BATTLER
  // =========================================================
  window.Arcade.registerGame({
    id: 'lexi-crypt',
    title: 'LexiCrypt: Word Battler',
    category: 'Sim & Word',
    icon: '🔤',
    genre: 'Codebreaker + Spellblade RPG',
    description: 'Two addicting word modes in one: crack 5-letter cyber-codes with hint power-ups OR forge words from a 12-tile rack to slay Firewall Bosses!',
    mechanics: ['Codebreaker (Wordle+)', 'Spellblade Word RPG', '2x/3x Multiplier Tiles', 'Hint & Shuffle Abilities'],
    controls: 'Codebreaker: Type 5-letter guess + Enter | Spellblade: Click tiles to build words and Attack!',
    stars: [800, 2200, 5000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <button class="g-btn g-btn-primary" id="lc-mode-code">🔐 Codebreaker Mode</button>
          <button class="g-btn" id="lc-mode-spell">⚔️ Spellblade RPG Mode</button>
          <span class="g-badge" id="lc-streak">STREAK: 0</span>
        </div>
        <div id="lc-stage" class="g-panel" style="width:100%;max-width:680px;"></div>
      `;
      container.appendChild(wrap);

      const WORDS5 = [
        'LASER','CYBER','NEXUS','PRISM','PULSE','ORBIT','VAULT','BLITZ','HYPER','REACT',
        'STACK','CRYPT','FORGE','SPARK','DRONE','ALPHA','OMEGA','LOGIC','QUEST','SHIFT',
        'FLAME','STORM','BLADE','PIXEL','GHOST','AUDIO','TURBO','TITAN','MAGIC','SOLAR'
      ];
      const DICT = new Set([
        ...WORDS5, 'CAT','DOG','BAT','RAT','HAT','SAT','MAT','CAR','BAR','FAR','JAR','STAR','WAR',
        'CODE','NODE','BYTE','DATA','GAME','PLAY','FIRE','ICE','WIND','RAIN','SUN','MOON','GOLD',
        'IRON','GEM','RING','KING','STAR','SHIP','HERO','SWORD','CAST','WORD','TIME','FAST','HARD',
        'HEAT','WAVE','BEAM','GLOW','NEON','DARK','VOID','MIND','SOUL','LIFE','GATE','LOCK','KEY',
        'CORE','FLUX','GRID','SYNC','LINK','PORT','TASK','PLAN','TEST','READ','WRITE','RUN','WIN',
        'ACE','ACT','ADD','AGE','AID','AIM','AIR','ALL','AND','ANT','ANY','APE','ARC','ARE','ARK',
        'ARM','ART','ASH','ASK','ATE','AWE','AXE','BAD','BAG','BAN','BAT','BAY','BED','BEE','BEG',
        'BET','BID','BIG','BIN','BIT','BOG','BOW','BOX','BOY','BUD','BUG','BUN','BUS','BUT','BUY',
        'CAB','CAD','CAM','CAN','CAP','CAR','CAT','COB','COD','COG','COP','COT','COW','COX','COY',
        'CRY','CUB','CUD','CUE','CUP','CUR','CUT','DAB','DAD','DAM','DAN','DAY','DEN','DEW','DID',
        'DIE','DIG','DIM','DIN','DIP','DOC','DOE','DOG','DON','DOT','DRY','DUB','DUD','DUE','DUG',
        'DUN','DUO','DYE','EAR','EAT','EBB','EEL','EGG','EGO','ELK','ELM','END','ERA','EVE','EWE',
        'EYE','FAB','FAD','FAN','FAR','FAT','FAX','FED','FEE','FEN','FEW','FIB','FIG','FIN','FIR',
        'FIT','FIX','FLU','FLY','FOB','FOE','FOG','FOR','FOX','FRY','FUN','FUR','GAB','GAD','GAG',
        'GAL','GAP','GAS','GAY','GEL','GEM','GET','GIG','GIN','GOD','GOT','GUM','GUN','GUT','GUY',
        'GYM','HAD','HAG','HAM','HAS','HAT','HAY','HEM','HEN','HER','HEW','HEX','HEY','HID','HIM',
        'HIP','HIS','HIT','HOB','HOD','HOE','HOG','HOP','HOT','HOW','HUB','HUE','HUG','HUM','HUT',
        'ICE','ICY','ILL','IMP','INK','INN','ION','IRE','IRK','ITS','IVY','JAB','JAG','JAM','JAR',
        'JAW','JAY','JET','JIG','JOB','JOG','JOT','JOY','JUG','JUT','KEG','KEN','KEY','KID','KIN',
        'KIT','LAB','LAC','LAD','LAG','LAP','LAW','LAX','LAY','LEA','LED','LEG','LET','LID','LIE',
        'LIP','LIT','LOB','LOG','LOP','LOT','LOW','LUG','LYE','MAD','MAG','MAN','MAP','MAR','MAT',
        'MAW','MAX','MAY','MEN','MET','MEW','MID','MIX','MOB','MOD','MOM','MOP','MOW','MUD','MUG',
        'MUM','NAB','NAG','NAP','NAY','NET','NEW','NIB','NIL','NIP','NIT','NOD','NOR','NOT','NOW',
        'NUB','NUN','NUT','OAK','OAR','OAT','ODD','ODE','OFF','OFT','OHM','OIL','OLD','ONE','OPT',
        'ORB','ORE','OUR','OUT','OVA','OWE','OWL','OWN','PAD','PAL','PAN','PAP','PAR','PAT','PAW',
        'PAY','PEA','PEG','PEN','PEP','PER','PET','PEW','PIE','PIG','PIN','PIT','PLY','POD','POP',
        'POT','POW','PRO','PRY','PUB','PUG','PUN','PUP','PUS','PUT','RAD','RAG','RAM','RAN','RAP',
        'RAT','RAW','RAY','RED','REF','REP','RIB','RID','RIG','RIM','RIP','ROB','ROD','ROE','ROT',
        'ROW','RUB','RUG','RUM','RUN','RUT','RYE','SAC','SAD','SAG','SAP','SAT','SAW','SAX','SAY',
        'SEA','SEE','SET','SEW','SHE','SHY','SIN','SIP','SIR','SIS','SIT','SIX','SKI','SKY','SLY',
        'SOB','SOD','SON','SOP','SOT','SOW','SOX','SOY','SPA','SPY','STY','SUB','SUE','SUM','SUN',
        'SUP','TAB','TAD','TAG','TAN','TAP','TAR','TAT','TAX','TEA','TED','TEE','TEN','THE','THY',
        'TIC','TIE','TIN','TIP','TOE','TON','TOO','TOP','TOT','TOW','TOY','TRY','TUB','TUG','TUN',
        'TWO','URN','USE','VAN','VAT','VET','VEX','VIA','VIE','VOW','WAD','WAG','WAN','WAR','WAS',
        'WAX','WAY','WEB','WED','WEE','WET','WHO','WHY','WIG','WIN','WIT','WOE','WOG','WOK','WON',
        'WOO','WOW','WRY','YAK','YAM','YAP','YAW','YEA','YES','YET','YEW','YIN','YIP','YOU','YOW',
        'ZAP','ZED','ZEE','ZEN','ZIG','ZIP','ZIT','ZOO','TEAM','GAME','HERO','FAST','CARD','WORD',
        'BLUE','GOLD','LIME','PINK','STAR','FIRE','WALL','DOOR','MINE','SHIP','RAIL','BOLT','SYNC'
      ]);

      const stage = wrap.querySelector('#lc-stage');
      const streakEl = wrap.querySelector('#lc-streak');
      const btnCode = wrap.querySelector('#lc-mode-code');
      const btnSpell = wrap.querySelector('#lc-mode-spell');

      let mode = 'code', score = 0, streak = 0;

      // Mode 1: Codebreaker state
      let targetWord = '', guesses = [], curGuess = '', hintsLeft = 2, eliminated = new Set();

      function startCodebreaker() {
        targetWord = WORDS5[Math.floor(Math.random() * WORDS5.length)];
        guesses = [];
        curGuess = '';
        hintsLeft = 2;
        eliminated = new Set();
        renderCodebreaker();
      }

      function renderCodebreaker() {
        const won = guesses.includes(targetWord);
        const lost = !won && guesses.length >= 6;
        let html = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong>Crack the 5-Letter Cyber-Code (6 tries)</strong>
            <div class="g-row">
              <button class="g-btn g-btn-gold" id="cb-hint" ${hintsLeft <= 0 || won || lost ? 'disabled' : ''}>💡 Reveal Letter (${hintsLeft})</button>
              <button class="g-btn g-btn-primary" id="cb-next">New Word</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-bottom:12px;">
        `;
        for (let r = 0; r < 6; r++) {
          const g = guesses[r] || (r === guesses.length && !won && !lost ? curGuess.padEnd(5, ' ') : '     ');
          const evaluated = r < guesses.length;
          html += `<div style="display:flex;gap:6px;">`;
          for (let c = 0; c < 5; c++) {
            const ch = g[c] || ' ';
            let bg = '#0b1224', brd = '#2b3c6e';
            if (evaluated) {
              if (targetWord[c] === ch) { bg = '#15803d'; brd = '#2ee59d'; }
              else if (targetWord.includes(ch)) { bg = '#a16207'; brd = '#ffd166'; }
              else { bg = '#1e293b'; brd = '#334155'; }
            }
            html += `<div style="width:46px;height:46px;border:2px solid ${brd};background:${bg};border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;">${ch.trim()}</div>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
        if (won) html += `<div style="text-align:center;color:#2ee59d;font-weight:800;">CRACKED! +${(7 - guesses.length) * 100} pts</div>`;
        else if (lost) html += `<div style="text-align:center;color:#ff4d6d;font-weight:800;">LOCKED OUT! Code was ${targetWord}</div>`;
        else html += `<div class="g-row"><input id="cb-input" maxlength="5" placeholder="Type 5 letters" style="padding:8px 12px;border-radius:8px;border:1px solid #354c88;background:#080e1d;color:#fff;text-transform:uppercase;font-weight:800;width:150px;" value="${curGuess}"/><button class="g-btn g-btn-primary" id="cb-submit">Submit</button></div>`;
        stage.innerHTML = html;

        const inp = stage.querySelector('#cb-input');
        if (inp) {
          inp.focus();
          inp.oninput = () => { curGuess = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); };
          inp.onkeydown = e => { if (e.key === 'Enter') submitCodeGuess(); };
          stage.querySelector('#cb-submit').onclick = submitCodeGuess;
        }
        stage.querySelector('#cb-next').onclick = startCodebreaker;
        stage.querySelector('#cb-hint').onclick = () => {
          if (hintsLeft <= 0) return;
          hintsLeft--;
          const idx = Math.floor(Math.random() * 5);
          alert(`Scanner Hint: Position #${idx + 1} is "${targetWord[idx]}"`);
          renderCodebreaker();
        };
      }

      function submitCodeGuess() {
        if (curGuess.length !== 5) return;
        guesses.push(curGuess);
        if (curGuess === targetWord) {
          streak++;
          const pts = (7 - guesses.length) * 100 + streak * 40;
          score += pts;
          api.setScore(score);
          api.addCredits(18);
          api.addXP(20);
          audio.playPowerup();
        } else if (guesses.length >= 6) {
          streak = 0;
          audio.playGameOver();
        } else {
          audio.playClick();
        }
        curGuess = '';
        streakEl.textContent = `STREAK: ${streak}`;
        renderCodebreaker();
      }

      // Mode 2: Spellblade RPG
      let rack = [], chosenIdx = [], boss = { hp: 80, maxHp: 80, atk: 12, lvl: 1 }, playerHp = 60 + api.getStartingShields() * 10;

      function refillRack() {
        const vowels = 'AEIOU';
        const cons = 'BCDFGHJKLMNPQRSTVWXYZ';
        rack = [];
        for (let i = 0; i < 12; i++) {
          const ch = i < 4 ? vowels[Math.floor(Math.random() * vowels.length)] : cons[Math.floor(Math.random() * cons.length)];
          const mult = Math.random() < 0.18 ? 2 : 1;
          rack.push({ ch, mult });
        }
        chosenIdx = [];
      }

      function renderSpellblade() {
        const word = chosenIdx.map(i => rack[i].ch).join('');
        stage.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <div><strong style="color:#00f0ff;">SPELLBLADE HP: ${playerHp}</strong></div>
            <div><strong style="color:#ff2a85;">FIREWALL BOSS Lv.${boss.lvl} HP: ${boss.hp}/${boss.maxHp}</strong></div>
          </div>
          <div style="text-align:center;font-size:24px;font-weight:900;letter-spacing:4px;min-height:36px;color:#ffd166;margin-bottom:10px;">
            ${word || '...'}
          </div>
          <div id="sb-rack" class="g-row" style="margin-bottom:12px;"></div>
          <div class="g-row">
            <button class="g-btn g-btn-primary" id="sb-cast" ${word.length < 2 || playerHp <= 0 ? 'disabled' : ''}>⚔️ Cast Word</button>
            <button class="g-btn" id="sb-clear">Clear</button>
            <button class="g-btn g-btn-gold" id="sb-shuffle">↻ New Tiles (Boss Hits)</button>
          </div>
          <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:8px;">Build 2+ letter English words (longer words &amp; 2x gold tiles deal huge damage!).</p>
        `;
        const rackEl = stage.querySelector('#sb-rack');
        rack.forEach((tile, i) => {
          const used = chosenIdx.includes(i);
          const b = document.createElement('button');
          b.className = 'g-btn' + (tile.mult > 1 ? ' g-btn-gold' : '');
          b.style.cssText = 'width:46px;height:46px;font-size:18px;font-weight:900;' + (used ? 'opacity:0.35;' : '');
          b.textContent = tile.ch + (tile.mult > 1 ? '²' : '');
          b.onclick = () => {
            if (used) chosenIdx = chosenIdx.filter(x => x !== i);
            else chosenIdx.push(i);
            audio.playClick();
            renderSpellblade();
          };
          rackEl.appendChild(b);
        });

        stage.querySelector('#sb-clear').onclick = () => { chosenIdx = []; renderSpellblade(); };
        stage.querySelector('#sb-shuffle').onclick = () => {
          playerHp = Math.max(0, playerHp - boss.atk);
          audio.playHit();
          refillRack();
          if (playerHp <= 0) api.gameOver(score);
          renderSpellblade();
        };
        stage.querySelector('#sb-cast').onclick = () => {
          const w = word.toUpperCase();
          if (w.length < 2) return;
          const validBonus = DICT.has(w) ? 1.8 : 0.7;
          const tileMult = chosenIdx.reduce((acc, idx) => acc * rack[idx].mult, 1);
          const dmg = Math.round(w.length * 7 * validBonus * tileMult);
          boss.hp = Math.max(0, boss.hp - dmg);
          score += dmg * 10;
          api.setScore(score);
          audio.playLaser();
          if (boss.hp <= 0) {
            boss.lvl++;
            boss.maxHp = 80 + boss.lvl * 30;
            boss.hp = boss.maxHp;
            playerHp = Math.min(80, playerHp + 15);
            streak++;
            api.addCredits(22);
            audio.playPowerup();
          } else {
            playerHp = Math.max(0, playerHp - Math.round(boss.atk * 0.6));
            if (playerHp <= 0) api.gameOver(score);
          }
          streakEl.textContent = `STREAK: ${streak}`;
          refillRack();
          renderSpellblade();
        };
      }

      btnCode.onclick = () => {
        mode = 'code';
        btnCode.classList.add('g-btn-primary');
        btnSpell.classList.remove('g-btn-primary');
        startCodebreaker();
      };
      btnSpell.onclick = () => {
        mode = 'spell';
        btnSpell.classList.add('g-btn-primary');
        btnCode.classList.remove('g-btn-primary');
        refillRack();
        renderSpellblade();
      };

      startCodebreaker();
      return () => {};
    }
  });

  // =========================================================
  // GAME 20: NEON DRIFT: MICRO RACERS
  // =========================================================
  window.Arcade.registerGame({
    id: 'neon-drift',
    title: 'Neon Drift: Micro Racers',
    category: 'Sim & Word',
    icon: '🏎️',
    genre: 'Top-Down Drift Racer',
    description: 'Master slip-angle drifting, leave glowing skid marks, charge Nitro by drifting around corners, race AI rivals, and tune your car in the Garage!',
    mechanics: ['Drift Slip-Angle Physics', 'Drift-Charged Nitro', 'AI Rival Racers', 'Garage Stat Tuning'],
    controls: 'Steer & Drive: WASD / Arrows | Nitro Boost: Space or Shift | Tune Car in Garage!',
    stars: [1000, 2800, 6500],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="nd-lap">LAP: 1/3</span>
          <span class="g-badge" id="nd-nitro">NITRO: 40%</span>
          <span class="g-badge" id="nd-pos">POS: 1st</span>
          <button class="g-btn g-btn-gold" id="nd-tune-spd">+Speed (<span id="nd-pts">2</span> pts)</button>
          <button class="g-btn g-btn-gold" id="nd-tune-grip">+Drift Grip</button>
          <button class="g-btn g-btn-primary" id="nd-track">Switch Track</button>
        </div>
        <div style="position:relative;">
          <canvas id="nd-canvas" class="g-canvas" width="840" height="480"></canvas>
          <div id="nd-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#00f0ff;">RACE COMPLETE!</h3>
            <p id="nd-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="nd-retry">Next Race</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#nd-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const lapEl = wrap.querySelector('#nd-lap');
      const nitroEl = wrap.querySelector('#nd-nitro');
      const posEl = wrap.querySelector('#nd-pos');
      const ptsEl = wrap.querySelector('#nd-pts');
      const overEl = wrap.querySelector('#nd-over');
      const overTxt = wrap.querySelector('#nd-over-txt');

      const TRACKS = [
        [
          { x: 180, y: 110 }, { x: 660, y: 110 }, { x: 730, y: 240 },
          { x: 660, y: 380 }, { x: 180, y: 380 }, { x: 110, y: 240 }
        ],
        [
          { x: 150, y: 95 }, { x: 420, y: 95 }, { x: 520, y: 195 },
          { x: 700, y: 110 }, { x: 740, y: 360 }, { x: 430, y: 390 },
          { x: 150, y: 360 }, { x: 100, y: 220 }
        ]
      ];

      const keys = {};
      let trackIdx = 0, tunePts = 2, topSpeedBonus = 0, gripBonus = 0;
      let car, rivals, skids, lap, totalLaps = 3, wpIdx, raceTime, score, finished, rafId;

      function initRace() {
        const wps = TRACKS[trackIdx];
        car = {
          x: wps[0].x, y: wps[0].y + 12, vx: 0, vy: 0,
          angle: 0, nitro: 45, driftScore: 0
        };
        rivals = [
          { x: wps[0].x - 24, y: wps[0].y - 16, angle: 0, wp: 1, lap: 1, spd: 215, color: '#ff2a85' },
          { x: wps[0].x - 42, y: wps[0].y + 18, angle: 0, wp: 1, lap: 1, spd: 195, color: '#ffd166' }
        ];
        skids = [];
        lap = 1;
        wpIdx = 1;
        raceTime = 0;
        score = 0;
        finished = false;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      wrap.querySelector('#nd-tune-spd').onclick = () => {
        if (tunePts <= 0) return;
        tunePts--; topSpeedBonus += 25; audio.playPowerup(); ptsEl.textContent = tunePts;
      };
      wrap.querySelector('#nd-tune-grip').onclick = () => {
        if (tunePts <= 0) return;
        tunePts--; gripBonus += 0.04; audio.playPowerup(); ptsEl.textContent = tunePts;
      };
      wrap.querySelector('#nd-track').onclick = () => {
        trackIdx = (trackIdx + 1) % TRACKS.length;
        initRace();
      };
      wrap.querySelector('#nd-retry').onclick = initRace;

      function onKeyDown(e) { keys[e.code] = true; }
      function onKeyUp(e) { keys[e.code] = false; }
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      function update(dt) {
        if (finished || api.isPaused()) return;
        raceTime += dt;
        const wps = TRACKS[trackIdx];

        const accel = (keys.KeyW || keys.ArrowUp) ? 1 : (keys.KeyS || keys.ArrowDown) ? -0.6 : 0;
        const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        const boosting = (keys.Space || keys.ShiftLeft || keys.ShiftRight) && car.nitro > 1;

        if (boosting) {
          car.nitro = Math.max(0, car.nitro - 38 * dt);
        }

        const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
        const speedMag = Math.hypot(car.vx, car.vy);
        car.angle += steer * (2.6 + Math.min(1.2, speedMag / 220)) * dt * (accel < 0 ? -1 : 1);

        const maxForce = (boosting ? 560 : 380) + topSpeedBonus;
        car.vx += fwdX * accel * maxForce * dt;
        car.vy += fwdY * accel * maxForce * dt;

        // Lateral slip friction (drift!)
        const rightX = -fwdY, rightY = fwdX;
        const forwardVel = car.vx * fwdX + car.vy * fwdY;
        const lateralVel = car.vx * rightX + car.vy * rightY;
        const lateralGrip = Math.min(0.95, 0.88 + gripBonus);
        const newLat = lateralVel * lateralGrip;

        car.vx = fwdX * forwardVel + rightX * newLat;
        car.vy = fwdY * forwardVel + rightY * newLat;
        car.vx *= 0.985;
        car.vy *= 0.985;

        car.x = Math.max(25, Math.min(W - 25, car.x + car.vx * dt));
        car.y = Math.max(25, Math.min(H - 25, car.y + car.vy * dt));

        // Drift detection -> skid marks + Nitro charge + Score
        if (Math.abs(lateralVel) > 55 && speedMag > 110) {
          car.nitro = Math.min(100, car.nitro + 18 * dt);
          score += Math.round(140 * dt);
          api.setScore(score);
          skids.push({ x: car.x, y: car.y, life: 3.5 });
        }

        // Waypoint progression
        const targetWp = wps[wpIdx];
        if (Math.hypot(car.x - targetWp.x, car.y - targetWp.y) < 75) {
          wpIdx = (wpIdx + 1) % wps.length;
          score += 120;
          api.setScore(score);
          audio.playCoin();
          if (wpIdx === 0) {
            lap++;
            if (lap > totalLaps) {
              finished = true;
              const timeBonus = Math.max(200, Math.round(2000 - raceTime * 35));
              score += timeBonus;
              api.setScore(score);
              tunePts++;
              ptsEl.textContent = tunePts;
              api.addCredits(Math.floor(score / 80));
              api.addXP(Math.floor(score / 60));
              api.gameOver(score);
              audio.playPowerup();
              overTxt.textContent = `Finish Score: ${score} | Time: ${raceTime.toFixed(1)}s | +1 Garage Tune Pt!`;
              overEl.classList.remove('hidden');
            }
          }
        }

        // Rivals
        for (const r of rivals) {
          const rw = wps[r.wp];
          const ang = Math.atan2(rw.y - r.y, rw.x - r.x);
          r.angle = ang;
          r.x += Math.cos(ang) * r.spd * dt;
          r.y += Math.sin(ang) * r.spd * dt;
          if (Math.hypot(rw.x - r.x, rw.y - r.y) < 40) {
            r.wp = (r.wp + 1) % wps.length;
            if (r.wp === 0) r.lap++;
          }
        }

        for (let i = skids.length - 1; i >= 0; i--) {
          skids[i].life -= dt;
          if (skids[i].life <= 0) skids.splice(i, 1);
        }

        const myProg = lap * 100 + wpIdx;
        const ahead = rivals.filter(r => r.lap * 100 + r.wp > myProg).length;
        lapEl.textContent = `LAP: ${Math.min(lap, totalLaps)}/${totalLaps}`;
        nitroEl.textContent = `NITRO: ${Math.round(car.nitro)}%`;
        posEl.textContent = `POS: ${['1st', '2nd', '3rd'][ahead] || '3rd'}`;
        fxSys.update(dt);
      }

      function draw() {
        ctx.fillStyle = '#060a15';
        ctx.fillRect(0, 0, W, H);
        const wps = TRACKS[trackIdx];

        // Track asphalt ribbon
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1b2646';
        ctx.lineWidth = 84;
        ctx.beginPath();
        wps.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();

        // Track neon edge
        ctx.strokeStyle = '#00f0ff44';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Active next checkpoint
        const nw = wps[wpIdx];
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(nw.x, nw.y, 26, 0, Math.PI * 2); ctx.stroke();

        // Skid marks
        for (const s of skids) {
          ctx.fillStyle = `rgba(0, 240, 255, ${Math.min(0.6, s.life / 3)})`;
          ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        }

        // Draw cars
        function drawCar(c, color) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.angle);
          ctx.fillStyle = color;
          ctx.fillRect(-13, -8, 26, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(5, -5, 5, 10);
          ctx.restore();
        }
        rivals.forEach(r => drawCar(r, r.color));
        drawCar(car, '#00f0ff');

        fxSys.draw(ctx);
      }

      let last = performance.now();
      function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        draw();
        rafId = requestAnimationFrame(loop);
      }

      initRace();
      rafId = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }
  });
})();
