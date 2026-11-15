(function () {
  const { audio } = window.Arcade;

  // =========================================================
  // GAME 9: 2048: QUANTUM FUSION
  // =========================================================
  window.Arcade.registerGame({
    id: 'quantum-2048',
    title: '2048: Quantum Fusion',
    category: 'Puzzle',
    icon: '⚛️',
    genre: 'Ability-Powered Number Puzzle',
    description: 'Merge quantum tiles with rapid-merge combos and charge 4 Quantum Abilities: Undo, Quantum Swap, Vaporize 2s/4s, and Supernova Double!',
    mechanics: ['4 Quantum Abilities', 'Rapid Combo Timer', 'Energy Bar System', 'Infinite Post-2048'],
    controls: 'Slide Tiles: WASD / Arrow Keys | Click an Ability button then click target tile(s)',
    stars: [1500, 4500, 12000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="q2-energy">⚡ QUANTUM ENERGY: 40/100</span>
          <span class="g-badge" id="q2-combo">COMBO: x1</span>
          <span class="g-badge" id="q2-max">MAX TILE: 2</span>
        </div>
        <div class="g-row">
          <button class="g-btn" id="q2-undo">↩ Undo (25⚡)</button>
          <button class="g-btn" id="q2-swap">⇄ Swap 2 (35⚡)</button>
          <button class="g-btn" id="q2-vap">💥 Vaporize 2&amp;4 (45⚡)</button>
          <button class="g-btn g-btn-gold" id="q2-nova">🌟 Supernova 2x (60⚡)</button>
        </div>
        <div id="q2-hint" style="font-size:12px;color:#00f0ff;min-height:16px;">Use Arrow Keys or WASD to merge tiles.</div>
        <div id="q2-board" style="display:grid;grid-template-columns:repeat(4,82px);gap:8px;background:#101830;padding:12px;border-radius:14px;border:2px solid #2b3c6e;"></div>
      `;
      container.appendChild(wrap);

      const boardEl = wrap.querySelector('#q2-board');
      const enEl = wrap.querySelector('#q2-energy');
      const comboEl = wrap.querySelector('#q2-combo');
      const maxEl = wrap.querySelector('#q2-max');
      const hintEl = wrap.querySelector('#q2-hint');

      const TILE_COLORS = {
        0: ['#17213e', '#475569'],
        2: ['#1e293b', '#e2e8f0'],
        4: ['#1e3a5f', '#7dd3fc'],
        8: ['#0f766e', '#99f6e4'],
        16: ['#0369a1', '#e0f2fe'],
        32: ['#4338ca', '#e0e7ff'],
        64: ['#7e22ce', '#f3e8ff'],
        128: ['#be185d', '#fce7f3'],
        256: ['#b45309', '#fef3c7'],
        512: ['#047857', '#d1fae5'],
        1024: ['#c2410c', '#ffedd5'],
        2048: ['#eab308', '#090d16']
      };

      let grid, score, energy, history, mode, swapFirst, lastMergeAt, combo, dead, timerId;

      function spawnTile() {
        const empty = [];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (grid[r][c] === 0) empty.push([r, c]);
        if (empty.length === 0) return false;
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        grid[r][c] = Math.random() < 0.88 ? 2 : 4;
        return true;
      }

      function initGame() {
        grid = Array.from({ length: 4 }, () => Array(4).fill(0));
        score = 0;
        energy = 40;
        history = [];
        mode = null;
        swapFirst = null;
        lastMergeAt = 0;
        combo = 1;
        dead = false;
        spawnTile();
        spawnTile();
        api.setScore(0);
        render();
      }

      function cloneGrid(g) { return g.map(r => [...r]); }

      function hasMoves() {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (grid[r][c] === 0) return true;
            if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
            if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
          }
        }
        return false;
      }

      function slideLine(line) {
        const arr = line.filter(v => v !== 0);
        let mergedPts = 0;
        let merges = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === arr[i + 1]) {
            arr[i] *= 2;
            mergedPts += arr[i];
            merges++;
            arr.splice(i + 1, 1);
          }
        }
        while (arr.length < 4) arr.push(0);
        return { arr, mergedPts, merges };
      }

      function move(dir) {
        if (dead || mode || api.isPaused()) return;
        const prev = cloneGrid(grid);
        const prevScore = score;
        let changed = false;
        let totalPts = 0;
        let totalMerges = 0;

        for (let i = 0; i < 4; i++) {
          let line = [];
          for (let j = 0; j < 4; j++) {
            if (dir === 'left') line.push(grid[i][j]);
            if (dir === 'right') line.push(grid[i][3 - j]);
            if (dir === 'up') line.push(grid[j][i]);
            if (dir === 'down') line.push(grid[3 - j][i]);
          }
          const res = slideLine(line);
          totalPts += res.mergedPts;
          totalMerges += res.merges;
          for (let j = 0; j < 4; j++) {
            const v = res.arr[j];
            if (dir === 'left') { if (grid[i][j] !== v) changed = true; grid[i][j] = v; }
            if (dir === 'right') { if (grid[i][3 - j] !== v) changed = true; grid[i][3 - j] = v; }
            if (dir === 'up') { if (grid[j][i] !== v) changed = true; grid[j][i] = v; }
            if (dir === 'down') { if (grid[3 - j][i] !== v) changed = true; grid[3 - j][i] = v; }
          }
        }

        if (!changed) return;
        history.push({ grid: prev, score: prevScore });
        if (history.length > 15) history.shift();

        if (totalMerges > 0) {
          const now = Date.now();
          combo = now - lastMergeAt < 2200 ? Math.min(5, combo + 1) : 1;
          lastMergeAt = now;
          score += totalPts * combo;
          energy = Math.min(100, energy + totalMerges * 6);
          api.setScore(score);
          audio.playCoin();
        } else {
          audio.playClick();
        }

        spawnTile();
        if (!hasMoves() && energy < 35) {
          dead = true;
          api.gameOver(score);
          api.addCredits(Math.floor(score / 120));
          api.addXP(Math.floor(score / 70));
          hintEl.textContent = 'No moves left! Use Restart or an Ability.';
        }
        render();
      }

      wrap.querySelector('#q2-undo').onclick = () => {
        if (history.length === 0 || energy < 25) return;
        energy -= 25;
        const prev = history.pop();
        grid = prev.grid;
        score = prev.score;
        dead = false;
        audio.playPowerup();
        render();
      };
      wrap.querySelector('#q2-swap').onclick = () => {
        if (energy < 35) return;
        mode = mode === 'swap' ? null : 'swap';
        swapFirst = null;
        hintEl.textContent = mode ? 'Select FIRST tile to swap...' : 'Cancelled.';
        render();
      };
      wrap.querySelector('#q2-vap').onclick = () => {
        if (energy < 45) return;
        energy -= 45;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (grid[r][c] === 2 || grid[r][c] === 4) grid[r][c] = 0;
        dead = false;
        audio.playExplosion();
        hintEl.textContent = 'Vaporized all 2s & 4s!';
        render();
      };
      wrap.querySelector('#q2-nova').onclick = () => {
        if (energy < 60) return;
        mode = mode === 'nova' ? null : 'nova';
        hintEl.textContent = mode ? 'Click any non-zero tile to DOUBLE it!' : 'Cancelled.';
        render();
      };

      function onKeyDown(e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') move('left');
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') move('right');
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') move('up');
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') move('down');
      }
      window.addEventListener('keydown', onKeyDown);

      function render() {
        let maxTile = 2;
        boardEl.innerHTML = '';
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const val = grid[r][c];
            if (val > maxTile) maxTile = val;
            const [bg, fg] = TILE_COLORS[val] || ['#ff2a85', '#ffffff'];
            const cell = document.createElement('button');
            cell.style.cssText = `width:82px;height:82px;border-radius:10px;border:2px solid ${
              swapFirst && swapFirst[0] === r && swapFirst[1] === c ? '#00f0ff' : 'rgba(255,255,255,0.08)'
            };background:${bg};color:${fg};font-size:${val >= 1024 ? 20 : 24}px;font-weight:900;cursor:pointer;`;
            cell.textContent = val > 0 ? val : '';
            cell.onclick = () => {
              if (mode === 'swap') {
                if (!swapFirst) {
                  swapFirst = [r, c];
                  hintEl.textContent = 'Now select SECOND tile to swap...';
                  render();
                } else {
                  const [r1, c1] = swapFirst;
                  [grid[r1][c1], grid[r][c]] = [grid[r][c], grid[r1][c1]];
                  energy -= 35;
                  mode = null; swapFirst = null;
                  audio.playPowerup();
                  hintEl.textContent = 'Quantum Swap executed!';
                  render();
                }
              } else if (mode === 'nova' && val > 0) {
                grid[r][c] *= 2;
                score += grid[r][c];
                energy -= 60;
                mode = null;
                api.setScore(score);
                audio.playPowerup();
                hintEl.textContent = 'Supernova doubled tile!';
                render();
              }
            };
            boardEl.appendChild(cell);
          }
        }
        enEl.textContent = `⚡ QUANTUM ENERGY: ${energy}/100`;
        comboEl.textContent = `COMBO: x${combo}`;
        maxEl.textContent = `MAX TILE: ${maxTile}`;
      }

      timerId = setInterval(() => {
        if (combo > 1 && Date.now() - lastMergeAt > 2400) {
          combo = 1;
          comboEl.textContent = 'COMBO: x1';
        }
      }, 400);

      initGame();
      return () => {
        clearInterval(timerId);
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  });

  // =========================================================
  // GAME 10: TETRAFLUX (Fever Block Stacker)
  // =========================================================
  window.Arcade.registerGame({
    id: 'tetra-flux',
    title: 'TetraFlux',
    category: 'Puzzle',
    icon: '🟦',
    genre: 'Fever Block Stacker',
    description: '10x20 Neon Tetris with 7-Bag RNG, Ghost piece, Hold queue, Back-to-Back combos, and Fever Mode cascading explosive clears.',
    mechanics: ['7-Bag + Ghost Piece', 'Hold Queue (C/Shift)', 'Fever Cascade Mode', 'Hard Drop + Combos'],
    controls: 'Move: Left/Right | Rotate: Up / X | Soft Drop: Down | Hard Drop: Space | Hold: C / Shift',
    stars: [1000, 3500, 8000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="tf-lines">LINES: 0</span>
          <span class="g-badge" id="tf-lvl">LEVEL: 1</span>
          <span class="g-badge" id="tf-fever">FEVER: 0%</span>
        </div>
        <div class="g-row" style="align-items:flex-start;">
          <div class="g-panel" style="width:120px;text-align:center;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">HOLD [C]</div>
            <canvas id="tf-hold" width="90" height="72"></canvas>
          </div>
          <div style="position:relative;">
            <canvas id="tf-canvas" class="g-canvas" width="280" height="560"></canvas>
            <div id="tf-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
              <h3 style="margin:0 0 8px;color:#ff4d6d;">STACK OVERFLOW</h3>
              <p id="tf-over-txt" style="margin:0 0 12px;"></p>
              <button class="g-btn g-btn-primary" id="tf-retry">Restart Matrix</button>
            </div>
          </div>
          <div class="g-panel" style="width:120px;text-align:center;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">NEXT</div>
            <canvas id="tf-next" width="90" height="140"></canvas>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#tf-canvas');
      const ctx = canvas.getContext('2d');
      const holdCtx = wrap.querySelector('#tf-hold').getContext('2d');
      const nextCtx = wrap.querySelector('#tf-next').getContext('2d');
      const COLS = 10, ROWS = 20, SZ = 28;

      const SHAPES = {
        I: { m: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], c: '#00f0ff' },
        O: { m: [[1,1],[1,1]], c: '#ffd166' },
        T: { m: [[0,1,0],[1,1,1],[0,0,0]], c: '#a855f7' },
        S: { m: [[0,1,1],[1,1,0],[0,0,0]], c: '#2ee59d' },
        Z: { m: [[1,1,0],[0,1,1],[0,0,0]], c: '#ff4d6d' },
        J: { m: [[1,0,0],[1,1,1],[0,0,0]], c: '#3b82f6' },
        L: { m: [[0,0,1],[1,1,1],[0,0,0]], c: '#f97316' }
      };

      const linesEl = wrap.querySelector('#tf-lines');
      const lvlEl = wrap.querySelector('#tf-lvl');
      const feverEl = wrap.querySelector('#tf-fever');
      const overEl = wrap.querySelector('#tf-over');
      const overTxt = wrap.querySelector('#tf-over-txt');

      let board, bag, cur, nextQueue, holdType, canHold, score, lines, level, fever, combo, dropAcc, dead, rafId;

      function refillBag() {
        const keys = Object.keys(SHAPES);
        for (let i = keys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        bag.push(...keys);
      }

      function spawnPiece(typeOverride = null) {
        if (!typeOverride && nextQueue.length < 3) {
          if (bag.length < 4) refillBag();
          while (nextQueue.length < 3) nextQueue.push(bag.shift());
        }
        const type = typeOverride || nextQueue.shift();
        if (bag.length < 4) refillBag();
        while (nextQueue.length < 3) nextQueue.push(bag.shift());

        const def = SHAPES[type];
        cur = {
          type,
          m: def.m.map(r => [...r]),
          c: def.c,
          x: Math.floor((COLS - def.m[0].length) / 2),
          y: 0
        };
        if (collides(cur.x, cur.y, cur.m)) {
          dead = true;
          audio.playGameOver();
          api.gameOver(score);
          api.addCredits(Math.floor(score / 100));
          api.addXP(Math.floor(score / 60));
          overTxt.textContent = `Score: ${score} | Lines: ${lines}`;
          overEl.classList.remove('hidden');
        }
      }

      function collides(px, py, mat) {
        for (let r = 0; r < mat.length; r++) {
          for (let c = 0; c < mat[r].length; c++) {
            if (!mat[r][c]) continue;
            const nx = px + c, ny = py + r;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && board[ny][nx]) return true;
          }
        }
        return false;
      }

      function rotateMat(m) {
        const N = m.length;
        const out = Array.from({ length: N }, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) out[c][N - 1 - r] = m[r][c];
        return out;
      }

      function tryRotate() {
        const rot = rotateMat(cur.m);
        for (const kick of [0, -1, 1, -2, 2]) {
          if (!collides(cur.x + kick, cur.y, rot)) {
            cur.m = rot; cur.x += kick; audio.playClick(); return;
          }
        }
      }

      function lockPiece() {
        for (let r = 0; r < cur.m.length; r++) {
          for (let c = 0; c < cur.m[r].length; c++) {
            if (cur.m[r][c] && cur.y + r >= 0) board[cur.y + r][cur.x + c] = cur.c;
          }
        }
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r].every(cell => cell !== null)) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(null));
            cleared++;
            r++;
          }
        }
        if (cleared > 0) {
          combo++;
          lines += cleared;
          level = 1 + Math.floor(lines / 8);
          fever = Math.min(100, fever + cleared * 25);
          const base = [0, 100, 300, 500, 800][cleared] || 1000;
          score += base * level + combo * 50;
          if (fever >= 100) {
            fever = 0;
            // Fever cascade clears bottom 2 rows!
            board.splice(ROWS - 2, 2);
            board.unshift(Array(COLS).fill(null), Array(COLS).fill(null));
            score += 600 * level;
            audio.playExplosion();
          } else {
            audio.playCoin();
          }
          api.setScore(score);
        } else {
          combo = 0;
          audio.playClick();
        }
        canHold = true;
        spawnPiece();
      }

      function hardDrop() {
        while (!collides(cur.x, cur.y + 1, cur.m)) cur.y++;
        score += 15;
        api.setScore(score);
        lockPiece();
      }

      function holdPiece() {
        if (!canHold) return;
        canHold = false;
        const old = holdType;
        holdType = cur.type;
        spawnPiece(old || null);
        audio.playClick();
      }

      function initGame() {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        bag = [];
        nextQueue = [];
        holdType = null;
        canHold = true;
        score = 0;
        lines = 0;
        level = 1;
        fever = 0;
        combo = 0;
        dropAcc = 0;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
        refillBag();
        spawnPiece();
      }

      function onKeyDown(e) {
        if (dead || api.isPaused()) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          if (!collides(cur.x - 1, cur.y, cur.m)) cur.x--;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          if (!collides(cur.x + 1, cur.y, cur.m)) cur.x++;
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          if (!collides(cur.x, cur.y + 1, cur.m)) { cur.y++; score += 1; api.setScore(score); }
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyX') {
          tryRotate();
        } else if (e.code === 'Space') {
          hardDrop();
        } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          holdPiece();
        }
      }
      window.addEventListener('keydown', onKeyDown);
      wrap.querySelector('#tf-retry').onclick = initGame;

      function drawMini(c2d, type, yOff) {
        const def = SHAPES[type];
        if (!def) return;
        c2d.fillStyle = def.c;
        def.m.forEach((row, r) => row.forEach((v, c) => {
          if (v) c2d.fillRect(14 + c * 16, yOff + r * 16, 14, 14);
        }));
      }

      function update(dt) {
        if (dead || api.isPaused()) return;
        const speed = Math.max(0.11, 0.72 - (level - 1) * 0.06);
        dropAcc += dt;
        if (dropAcc >= speed) {
          dropAcc = 0;
          if (!collides(cur.x, cur.y + 1, cur.m)) cur.y++;
          else lockPiece();
        }
        linesEl.textContent = `LINES: ${lines}`;
        lvlEl.textContent = `LEVEL: ${level}`;
        feverEl.textContent = `FEVER: ${fever}%`;
      }

      function draw() {
        ctx.fillStyle = '#060914';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * SZ, 0); ctx.lineTo(x * SZ, canvas.height); ctx.stroke(); }
        for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * SZ); ctx.lineTo(canvas.width, y * SZ); ctx.stroke(); }

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (board[r][c]) {
              ctx.fillStyle = board[r][c];
              ctx.fillRect(c * SZ + 1, r * SZ + 1, SZ - 2, SZ - 2);
            }
          }
        }

        if (cur && !dead) {
          // Ghost
          let gy = cur.y;
          while (!collides(cur.x, gy + 1, cur.m)) gy++;
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          cur.m.forEach((row, r) => row.forEach((v, c) => {
            if (v) ctx.fillRect((cur.x + c) * SZ + 1, (gy + r) * SZ + 1, SZ - 2, SZ - 2);
          }));
          // Active piece
          ctx.fillStyle = cur.c;
          cur.m.forEach((row, r) => row.forEach((v, c) => {
            if (v) ctx.fillRect((cur.x + c) * SZ + 1, (cur.y + r) * SZ + 1, SZ - 2, SZ - 2);
          }));
        }

        holdCtx.clearRect(0, 0, 90, 72);
        if (holdType) drawMini(holdCtx, holdType, 10);
        nextCtx.clearRect(0, 0, 90, 140);
        if (nextQueue[0]) drawMini(nextCtx, nextQueue[0], 10);
        if (nextQueue[1]) drawMini(nextCtx, nextQueue[1], 76);
      }

      let last = performance.now();
      function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        draw();
        rafId = requestAnimationFrame(loop);
      }

      initGame();
      rafId = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  });

  // =========================================================
  // GAME 11: CHROMA CASCADE (Match-3 RPG Battler)
  // =========================================================
  window.Arcade.registerGame({
    id: 'chroma-cascade',
    title: 'Chroma Cascade',
    category: 'Puzzle',
    icon: '💎',
    genre: 'Match-3 RPG Battler',
    description: 'Swap 7x7 elemental gems to cast live RPG spells! Match Red (Attack), Blue (Shield), Green (Heal), Purple (Poison), Yellow (Crit), Gold (Credits).',
    mechanics: ['Match-3 RPG Combat', '6 Gem Elements', '4-Match Bombs & 5-Match Hypercubes', 'Monster Waves'],
    controls: 'Click a Gem then click an Adjacent Gem to swap and match 3+',
    stars: [1200, 3500, 8500],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-panel" style="width:100%;max-width:600px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <strong style="color:#00f0ff;">YOU</strong>
            <div id="cc3-php">HP: 100/100 | Shield: 0</div>
            <div id="cc3-crit" style="font-size:12px;color:#ffd166;">Crit Charge: 0%</div>
          </div>
          <div style="text-align:center;">
            <span class="g-badge" id="cc3-stage">WAVE 1</span>
            <div id="cc3-msg" style="font-size:11px;color:#cbd5e1;margin-top:4px;">Match gems to attack!</div>
          </div>
          <div style="text-align:right;">
            <strong id="cc3-ename" style="color:#ff2a85;">Prism Beast</strong>
            <div id="cc3-ehp">HP: 90/90</div>
            <div id="cc3-eturn" style="font-size:12px;color:#fb7185;">Attacks in: 3 moves</div>
          </div>
        </div>
        <div id="cc3-board" style="display:grid;grid-template-columns:repeat(7,52px);gap:5px;background:#0e162c;padding:10px;border-radius:14px;border:2px solid #2b3c6e;"></div>
        <div id="cc3-over" class="g-overlay-card hidden">
          <h3 style="margin:0 0 8px;color:#ff4d6d;">SHATTERED</h3>
          <p id="cc3-over-txt" style="margin:0 0 12px;"></p>
          <button class="g-btn g-btn-primary" id="cc3-retry">New Battle</button>
        </div>
      `;
      container.appendChild(wrap);

      const TYPES = [
        { id: 0, icon: '🔥', color: '#ef4444', name: 'Attack' },
        { id: 1, icon: '🛡️', color: '#3b82f6', name: 'Shield' },
        { id: 2, icon: '💚', color: '#22c55e', name: 'Heal' },
        { id: 3, icon: '⚡', color: '#eab308', name: 'Crit' },
        { id: 4, icon: '☠️', color: '#a855f7', name: 'Poison' },
        { id: 5, icon: '🪙', color: '#f59e0b', name: 'Gold' }
      ];

      const boardEl = wrap.querySelector('#cc3-board');
      const phpEl = wrap.querySelector('#cc3-php');
      const critEl = wrap.querySelector('#cc3-crit');
      const stageEl = wrap.querySelector('#cc3-stage');
      const msgEl = wrap.querySelector('#cc3-msg');
      const enameEl = wrap.querySelector('#cc3-ename');
      const ehpEl = wrap.querySelector('#cc3-ehp');
      const eturnEl = wrap.querySelector('#cc3-eturn');
      const overEl = wrap.querySelector('#cc3-over');
      const overTxt = wrap.querySelector('#cc3-over-txt');

      const N = 7;
      let board, selected, player, enemy, wave, score, dead, busy;

      function randGem(special = null) {
        return { t: Math.floor(Math.random() * TYPES.length), sp: special };
      }

      function spawnMonster(w) {
        const names = ['Prism Beast', 'Ruby Golem', 'Void Sphinx', 'Chroma Titan'];
        const hp = 85 + (w - 1) * 45;
        enemy = { name: names[(w - 1) % names.length] + ` Lv.${w}`, hp, maxHp: hp, atk: 12 + w * 4, poison: 0, cd: 3 };
      }

      function findMatches() {
        const matched = Array.from({ length: N }, () => Array(N).fill(false));
        let any = false;
        let maxRun = 0;
        for (let r = 0; r < N; r++) {
          let run = 1;
          for (let c = 1; c <= N; c++) {
            if (c < N && board[r][c] && board[r][c - 1] && board[r][c].t === board[r][c - 1].t) run++;
            else {
              if (run >= 3) {
                any = true; maxRun = Math.max(maxRun, run);
                for (let k = c - run; k < c; k++) matched[r][k] = true;
              }
              run = 1;
            }
          }
        }
        for (let c = 0; c < N; c++) {
          let run = 1;
          for (let r = 1; r <= N; r++) {
            if (r < N && board[r][c] && board[r - 1][c] && board[r][c].t === board[r - 1][c].t) run++;
            else {
              if (run >= 3) {
                any = true; maxRun = Math.max(maxRun, run);
                for (let k = r - run; k < r; k++) matched[k][c] = true;
              }
              run = 1;
            }
          }
        }
        return { matched, any, maxRun };
      }

      function initBoardNoMatches() {
        board = Array.from({ length: N }, () => Array.from({ length: N }, () => randGem()));
        while (findMatches().any) {
          for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c] = randGem();
        }
      }

      function initGame() {
        wave = 1;
        score = 0;
        dead = false;
        busy = false;
        selected = null;
        player = { hp: 100 + api.getStartingShields() * 15, maxHp: 100 + api.getStartingShields() * 15, shield: 0, crit: 0 };
        overEl.classList.add('hidden');
        initBoardNoMatches();
        spawnMonster(1);
        api.setScore(0);
        render();
      }

      function resolveCascade(depth = 1) {
        const { matched, any, maxRun } = findMatches();
        if (!any) {
          busy = false;
          afterPlayerMove();
          return;
        }
        let counts = [0, 0, 0, 0, 0, 0];
        let total = 0;
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            if (matched[r][c] && board[r][c]) {
              const g = board[r][c];
              counts[g.t]++;
              total++;
              if (g.sp === 'bomb') {
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                  if (board[r + dr]?.[c + dc]) {
                    counts[board[r + dr][c + dc].t]++;
                    board[r + dr][c + dc] = null;
                    total++;
                  }
                }
              } else if (g.sp === 'hyper') {
                for (let rr = 0; rr < N; rr++) {
                  if (board[rr][c]) { counts[board[rr][c].t]++; board[rr][c] = null; total++; }
                }
              }
              board[r][c] = null;
            }
          }
        }

        // Apply RPG effects
        const critMult = player.crit >= 100 ? 2 : 1;
        if (critMult === 2) player.crit = 0;
        const dmg = (counts[0] * 7 + counts[3] * 3 + (maxRun >= 4 ? 10 : 0)) * depth * critMult;
        if (dmg > 0) enemy.hp = Math.max(0, enemy.hp - dmg);
        player.shield += counts[1] * 4;
        player.hp = Math.min(player.maxHp, player.hp + counts[2] * 4);
        player.crit = Math.min(100, player.crit + counts[3] * 12);
        enemy.poison += counts[4] * 2;
        if (counts[5] > 0) api.addCredits(counts[5]);

        score += total * 25 * depth;
        api.setScore(score);
        msgEl.textContent = `Combo x${depth}! Dealt ${dmg} DMG!`;
        audio.playCoin();

        // Gravity & refill
        for (let c = 0; c < N; c++) {
          let writeR = N - 1;
          for (let r = N - 1; r >= 0; r--) {
            if (board[r][c]) {
              board[writeR][c] = board[r][c];
              if (writeR !== r) board[r][c] = null;
              writeR--;
            }
          }
          while (writeR >= 0) {
            const sp = maxRun >= 5 && writeR === 0 ? 'hyper' : maxRun === 4 && writeR === 0 ? 'bomb' : null;
            board[writeR][c] = randGem(sp);
            writeR--;
          }
        }

        render();
        setTimeout(() => resolveCascade(depth + 1), 260);
      }

      function afterPlayerMove() {
        if (enemy.poison > 0) {
          enemy.hp = Math.max(0, enemy.hp - enemy.poison);
        }
        if (enemy.hp <= 0) {
          wave++;
          score += 350;
          api.setScore(score);
          api.addCredits(20);
          api.addXP(25);
          audio.playPowerup();
          spawnMonster(wave);
          msgEl.textContent = `Defeated! ${enemy.name} enters!`;
          render();
          return;
        }
        enemy.cd--;
        if (enemy.cd <= 0) {
          enemy.cd = 3;
          let dmg = enemy.atk;
          const ab = Math.min(player.shield, dmg);
          player.shield -= ab;
          dmg -= ab;
          player.hp = Math.max(0, player.hp - dmg);
          audio.playHit();
          msgEl.textContent = `${enemy.name} hits for ${enemy.atk} (${dmg} unblocked)!`;
          if (player.hp <= 0) {
            dead = true;
            audio.playGameOver();
            api.gameOver(score);
            overTxt.textContent = `Final Score: ${score} | Wave ${wave}`;
            overEl.classList.remove('hidden');
          }
        }
        render();
      }

      function trySwap(r1, c1, r2, c2) {
        busy = true;
        [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
        if (!findMatches().any) {
          [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
          busy = false;
          audio.playClick();
          render();
          return;
        }
        resolveCascade(1);
      }

      wrap.querySelector('#cc3-retry').onclick = initGame;

      function render() {
        phpEl.textContent = `HP: ${player.hp}/${player.maxHp} | Shield: ${player.shield}`;
        critEl.textContent = `Crit Charge: ${player.crit}%`;
        stageEl.textContent = `WAVE ${wave}`;
        enameEl.textContent = enemy.name;
        ehpEl.textContent = `HP: ${enemy.hp}/${enemy.maxHp}` + (enemy.poison > 0 ? ` (Poison ${enemy.poison})` : '');
        eturnEl.textContent = `Attacks in: ${enemy.cd} moves`;

        boardEl.innerHTML = '';
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            const g = board[r][c];
            const info = TYPES[g.t];
            const btn = document.createElement('button');
            const isSel = selected && selected[0] === r && selected[1] === c;
            btn.style.cssText = `width:52px;height:52px;border-radius:10px;border:2px solid ${
              isSel ? '#ffffff' : g.sp ? '#ffd166' : info.color + '88'
            };background:${info.color}28;font-size:22px;cursor:pointer;position:relative;`;
            btn.textContent = info.icon;
            if (g.sp) {
              btn.title = g.sp === 'bomb' ? 'Bomb Gem (3x3)' : 'Hyper Gem (Column)';
              btn.style.boxShadow = '0 0 10px #ffd166';
            }
            btn.onclick = () => {
              if (dead || busy || api.isPaused()) return;
              if (!selected) {
                selected = [r, c];
                render();
              } else {
                const [sr, sc] = selected;
                selected = null;
                if (Math.abs(sr - r) + Math.abs(sc - c) === 1) {
                  trySwap(sr, sc, r, c);
                } else {
                  selected = [r, c];
                  render();
                }
              }
            };
            boardEl.appendChild(btn);
          }
        }
      }

      initGame();
      return () => {};
    }
  });

  // =========================================================
  // GAME 12: LASER LOGIC LAB (Optics & Prism Puzzle)
  // =========================================================
  window.Arcade.registerGame({
    id: 'laser-logic',
    title: 'Laser Logic Lab',
    category: 'Puzzle',
    icon: '🔦',
    genre: 'Optics & Prism Puzzle',
    description: 'Route RGB laser beams using Mirrors, Splitters, Color Mixers, and Portals so every Target Node receives its required wavelength.',
    mechanics: ['Mirrors & Splitters', 'RGB Color Mixing', 'Quantum Portals', 'Curated + Procedural Levels'],
    controls: 'Click placed optics to Rotate | Select a tool and Click empty cells to Place/Remove',
    stars: [600, 1800, 4000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="ll-lvl">PUZZLE 1</span>
          <span class="g-badge" id="ll-targets">TARGETS: 0/1</span>
          <button class="g-btn" id="ll-tool-m1">Mirror /</button>
          <button class="g-btn" id="ll-tool-m2">Mirror \\</button>
          <button class="g-btn" id="ll-tool-sp">Splitter +</button>
          <button class="g-btn" id="ll-tool-er">Eraser</button>
          <button class="g-btn g-btn-primary" id="ll-new">Procedural Level</button>
        </div>
        <canvas id="ll-canvas" class="g-canvas" width="630" height="450"></canvas>
        <div id="ll-status" style="font-size:13px;color:#2ee59d;font-weight:700;"></div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#ll-canvas');
      const ctx = canvas.getContext('2d');
      const COLS = 9, ROWS = 6, SZ = 70;

      const lvlEl = wrap.querySelector('#ll-lvl');
      const targetsEl = wrap.querySelector('#ll-targets');
      const statusEl = wrap.querySelector('#ll-status');

      let levelNum = 1, score = 0, tool = 'm1', grid, emitters, targets, portals, beamSegments, cleared;

      const DIRS = {
        R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1]
      };

      const LEVELS = [
        {
          emitters: [{ x: 0, y: 1, dir: 'R', color: 'R' }],
          targets: [{ x: 6, y: 4, req: 'R' }],
          walls: [[3, 1], [3, 2]],
          portals: [],
          fixed: []
        },
        {
          emitters: [
            { x: 0, y: 1, dir: 'R', color: 'R' },
            { x: 0, y: 4, dir: 'R', color: 'B' }
          ],
          targets: [{ x: 8, y: 2, req: 'M' }], // R + B = Magenta!
          walls: [[4, 0], [4, 5]],
          portals: [],
          fixed: [{ x: 5, y: 2, type: 'mixer' }]
        },
        {
          emitters: [{ x: 0, y: 0, dir: 'R', color: 'G' }],
          targets: [{ x: 8, y: 5, req: 'G' }, { x: 2, y: 5, req: 'G' }],
          walls: [[4, 1], [4, 2], [4, 3]],
          portals: [{ ax: 3, ay: 0, bx: 6, by: 2 }],
          fixed: []
        }
      ];

      function loadLevel(idx, procedural = false) {
        cleared = false;
        statusEl.textContent = 'Route lasers to light every target node! (R+G=Yellow, R+B=Magenta, G+B=Cyan)';
        grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        if (!procedural && LEVELS[idx - 1]) {
          const L = LEVELS[idx - 1];
          emitters = L.emitters.map(e => ({ ...e }));
          targets = L.targets.map(t => ({ ...t, lit: '' }));
          portals = L.portals.map(p => ({ ...p }));
          L.walls.forEach(([x, y]) => { grid[y][x] = { type: 'wall', locked: true }; });
          L.fixed.forEach(f => { grid[f.y][f.x] = { type: f.type, locked: true }; });
        } else {
          const colors = ['R', 'G', 'B'];
          const c = colors[Math.floor(Math.random() * 3)];
          const ey = Math.floor(Math.random() * ROWS);
          const ty = (ey + 2 + Math.floor(Math.random() * 3)) % ROWS;
          emitters = [{ x: 0, y: ey, dir: 'R', color: c }];
          targets = [{ x: COLS - 1, y: ty, req: c, lit: '' }];
          portals = [{ ax: 3, ay: ey, bx: 5, by: ty }];
          for (let w = 0; w < 4; w++) {
            const wx = 1 + Math.floor(Math.random() * (COLS - 2));
            const wy = Math.floor(Math.random() * ROWS);
            if (!emitters.some(e => e.x === wx && e.y === wy) && !targets.some(t => t.x === wx && t.y === wy)) {
              grid[wy][wx] = { type: 'wall', locked: true };
            }
          }
        }
        traceBeams();
        draw();
      }

      function mixColor(cur, add) {
        const set = new Set((cur || '').split('').concat(add.split('')));
        const r = set.has('R'), g = set.has('G'), b = set.has('B');
        if (r && g && b) return 'W';
        if (r && g) return 'Y';
        if (r && b) return 'M';
        if (g && b) return 'C';
        if (r) return 'R';
        if (g) return 'G';
        if (b) return 'B';
        return '';
      }

      function colorHex(c) {
        return { R: '#ff4d6d', G: '#2ee59d', B: '#38bdf8', Y: '#ffd166', M: '#e879f9', C: '#00f0ff', W: '#ffffff' }[c] || '#94a3b8';
      }

      function traceBeams() {
        beamSegments = [];
        targets.forEach(t => t.lit = '');
        const mixerHits = new Map();
        const visited = new Set();

        function cast(x, y, dir, color, depth = 0) {
          if (depth > 45) return;
          let cx = x, cy = y;
          let [dx, dy] = DIRS[dir];
          for (let step = 0; step < 30; step++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
              beamSegments.push({ x1: cx, y1: cy, x2: cx + dx * 0.5, y2: cy + dy * 0.5, color });
              return;
            }
            const stateKey = `${nx},${ny},${dir},${color}`;
            if (visited.has(stateKey)) return;
            visited.add(stateKey);
            beamSegments.push({ x1: cx, y1: cy, x2: nx, y2: ny, color });
            cx = nx; cy = ny;

            // Target?
            const tgt = targets.find(t => t.x === cx && t.y === cy);
            if (tgt) {
              tgt.lit = mixColor(tgt.lit, color);
              return;
            }

            // Portal?
            const p = portals.find(pt => (pt.ax === cx && pt.ay === cy) || (pt.bx === cx && pt.by === cy));
            if (p) {
              const ox = p.ax === cx && p.ay === cy ? p.bx : p.ax;
              const oy = p.ax === cx && p.ay === cy ? p.by : p.ay;
              cast(ox, oy, dir, color, depth + 1);
              return;
            }

            const cell = grid[cy][cx];
            if (!cell) continue;
            if (cell.type === 'wall') return;
            if (cell.type === 'm1') { // '/'
              const mapDir = { R: 'U', U: 'R', L: 'D', D: 'L' };
              dir = mapDir[dir];
              [dx, dy] = DIRS[dir];
            } else if (cell.type === 'm2') { // '\'
              const mapDir = { R: 'D', D: 'R', L: 'U', U: 'L' };
              dir = mapDir[dir];
              [dx, dy] = DIRS[dir];
            } else if (cell.type === 'sp') {
              if (dir === 'R' || dir === 'L') {
                cast(cx, cy, 'U', color, depth + 1);
                cast(cx, cy, 'D', color, depth + 1);
              } else {
                cast(cx, cy, 'L', color, depth + 1);
                cast(cx, cy, 'R', color, depth + 1);
              }
              return;
            } else if (cell.type === 'mixer') {
              const key = `${cx},${cy}`;
              const prev = mixerHits.get(key) || '';
              const nextCol = mixColor(prev, color);
              mixerHits.set(key, nextCol);
              cast(cx, cy, 'R', nextCol, depth + 1);
              return;
            }
          }
        }

        emitters.forEach(em => cast(em.x, em.y, em.dir, em.color));

        const litCount = targets.filter(t => t.lit === t.req).length;
        targetsEl.textContent = `TARGETS: ${litCount}/${targets.length}`;
        lvlEl.textContent = `PUZZLE ${levelNum}`;

        if (!cleared && litCount === targets.length) {
          cleared = true;
          score += 300 + levelNum * 100;
          api.setScore(score);
          api.addCredits(20);
          api.addXP(20);
          audio.playPowerup();
          statusEl.textContent = '★ ALL OPTIC NODES ALIGNED! Advancing in 1.2s...';
          setTimeout(() => {
            levelNum++;
            loadLevel(levelNum, levelNum > LEVELS.length);
          }, 1200);
        }
      }

      wrap.querySelector('#ll-tool-m1').onclick = () => tool = 'm1';
      wrap.querySelector('#ll-tool-m2').onclick = () => tool = 'm2';
      wrap.querySelector('#ll-tool-sp').onclick = () => tool = 'sp';
      wrap.querySelector('#ll-tool-er').onclick = () => tool = 'er';
      wrap.querySelector('#ll-new').onclick = () => { levelNum++; loadLevel(levelNum, true); };

      function onClick(e) {
        if (cleared) return;
        const rect = canvas.getBoundingClientRect();
        const gx = Math.floor((((e.clientX - rect.left) / rect.width) * canvas.width) / SZ);
        const gy = Math.floor((((e.clientY - rect.top) / rect.height) * canvas.height) / SZ);
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
        if (emitters.some(em => em.x === gx && em.y === gy)) return;
        if (targets.some(t => t.x === gx && t.y === gy)) return;
        if (portals.some(p => (p.ax === gx && p.ay === gy) || (p.bx === gx && p.by === gy))) return;

        const cur = grid[gy][gx];
        if (cur && cur.locked) return;

        if (tool === 'er') {
          grid[gy][gx] = null;
        } else if (cur && cur.type === 'm1' && tool === 'm1') {
          grid[gy][gx] = { type: 'm2', locked: false };
        } else if (cur && cur.type === 'm2' && tool === 'm2') {
          grid[gy][gx] = { type: 'm1', locked: false };
        } else if (cur) {
          grid[gy][gx] = { type: tool, locked: false };
        } else {
          grid[gy][gx] = { type: tool, locked: false };
        }
        audio.playClick();
        traceBeams();
        draw();
      }

      canvas.addEventListener('click', onClick);

      function draw() {
        ctx.fillStyle = '#060a15';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            ctx.strokeStyle = '#1b2847';
            ctx.strokeRect(c * SZ, r * SZ, SZ, SZ);
            const cell = grid[r][c];
            if (!cell) continue;
            const cx = c * SZ + SZ / 2, cy = r * SZ + SZ / 2;
            if (cell.type === 'wall') {
              ctx.fillStyle = '#24345a';
              ctx.fillRect(c * SZ + 6, r * SZ + 6, SZ - 12, SZ - 12);
            } else if (cell.type === 'm1' || cell.type === 'm2') {
              ctx.strokeStyle = '#00f0ff';
              ctx.lineWidth = 4;
              ctx.beginPath();
              if (cell.type === 'm1') { ctx.moveTo(c * SZ + 14, r * SZ + SZ - 14); ctx.lineTo(c * SZ + SZ - 14, r * SZ + 14); }
              else { ctx.moveTo(c * SZ + 14, r * SZ + 14); ctx.lineTo(c * SZ + SZ - 14, r * SZ + SZ - 14); }
              ctx.stroke();
              ctx.lineWidth = 1;
            } else if (cell.type === 'sp') {
              ctx.strokeStyle = '#ffd166';
              ctx.lineWidth = 3;
              ctx.strokeRect(cx - 12, cy - 12, 24, 24);
              ctx.lineWidth = 1;
            } else if (cell.type === 'mixer') {
              ctx.fillStyle = '#a855f7';
              ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
              ctx.fillText('MIX', cx, cy + 4);
            }
          }
        }

        // Portals
        for (const p of portals) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.ax * SZ + SZ / 2, p.ay * SZ + SZ / 2, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(p.bx * SZ + SZ / 2, p.by * SZ + SZ / 2, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Beams
        for (const seg of beamSegments) {
          ctx.strokeStyle = colorHex(seg.color);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(seg.x1 * SZ + SZ / 2, seg.y1 * SZ + SZ / 2);
          ctx.lineTo(seg.x2 * SZ + SZ / 2, seg.y2 * SZ + SZ / 2);
          ctx.stroke();
        }
        ctx.lineWidth = 1;

        // Emitters
        for (const em of emitters) {
          ctx.fillStyle = colorHex(em.color);
          ctx.fillRect(em.x * SZ + 12, em.y * SZ + 12, SZ - 24, SZ - 24);
          ctx.fillStyle = '#050812';
          ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
          ctx.fillText('EM', em.x * SZ + SZ / 2, em.y * SZ + SZ / 2 + 4);
        }

        // Targets
        for (const t of targets) {
          const ok = t.lit === t.req;
          ctx.fillStyle = ok ? colorHex(t.req) : '#121a30';
          ctx.strokeStyle = colorHex(t.req);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(t.x * SZ + SZ / 2, t.y * SZ + SZ / 2, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = ok ? '#050812' : '#ffffff';
          ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
          ctx.fillText(t.req, t.x * SZ + SZ / 2, t.y * SZ + SZ / 2 + 4);
        }
        ctx.lineWidth = 1;
      }

      loadLevel(1);
      return () => canvas.removeEventListener('click', onClick);
    }
  });
})();
