(function () {
  const { audio, fx } = window.Arcade;

  // =========================================================
  // GAME 5: HEXACORE TOWER DEFENSE
  // =========================================================
  window.Arcade.registerGame({
    id: 'hexacore-td',
    title: 'HexaCore Tower Defense',
    category: 'Strategy & RPG',
    icon: '🏰',
    genre: 'Tactical Tower Defense',
    description: 'Defend the Core along a winding neon circuit. Build & upgrade 5 tower classes, deploy Orbital Strikes, and crush 6 enemy archetypes.',
    mechanics: ['5 Tower Types + Upgrades', 'Orbital Strike Cooldown', '6 Enemy Classes', 'Wave Speed Control'],
    controls: 'Select Tower -> Click Grid to Build | Click Tower to Upgrade | Orbital Strike -> Click Map',
    stars: [1500, 4500, 10000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="td-gold">GOLD: 220</span>
          <span class="g-badge" id="td-lives">CORE HP: 20</span>
          <span class="g-badge" id="td-wave">WAVE: 0</span>
          <button class="g-btn g-btn-primary" id="td-send">Next Wave</button>
          <button class="g-btn" id="td-speed">Speed: 1x</button>
          <button class="g-btn g-btn-gold" id="td-orbital">☄ Orbital Strike (READY)</button>
        </div>
        <div class="g-row" id="td-shop"></div>
        <div class="g-row" style="align-items:flex-start;">
          <div style="position:relative;">
            <canvas id="td-canvas" class="g-canvas" width="760" height="440"></canvas>
            <div id="td-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
              <h3 style="margin:0 0 8px;color:#ff4d6d;">HEXACORE BREACHED</h3>
              <p id="td-over-txt" style="margin:0 0 12px;"></p>
              <button class="g-btn g-btn-primary" id="td-retry">Rebuild Defense</button>
            </div>
          </div>
          <div id="td-inspector" class="g-panel" style="width:210px;font-size:12px;">
            <strong>Inspector</strong>
            <p style="color:#94a3b8;margin:6px 0 0;">Select a build card and click an empty tile, or click a placed tower to upgrade/sell.</p>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#td-canvas');
      const ctx = canvas.getContext('2d');
      const TILE = 40;
      const COLS = 19, ROWS = 11;
      const fxSys = fx.createFX();

      const PATH = [
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7],
        [5, 7], [6, 7], [7, 7], [8, 7], [8, 6], [8, 5], [8, 4], [8, 3], [8, 2],
        [9, 2], [10, 2], [11, 2], [12, 2], [12, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8],
        [13, 8], [14, 8], [15, 8], [15, 7], [15, 6], [15, 5], [16, 5], [17, 5], [18, 5]
      ];
      const pathSet = new Set(PATH.map(p => `${p[0]},${p[1]}`));

      const TOWERS = [
        { id: 'pulse', name: 'Pulse Turret', cost: 60, color: '#00f0ff', range: 115, dmg: 18, rate: 0.45, desc: 'Fast balanced blaster.' },
        { id: 'cryo', name: 'Cryo Emitter', cost: 80, color: '#38bdf8', range: 105, dmg: 9, rate: 0.75, slow: 0.45, desc: 'Slows targets in AoE.' },
        { id: 'tesla', name: 'Tesla Coil', cost: 115, color: '#a855f7', range: 120, dmg: 26, rate: 0.9, chain: 3, desc: 'Arcs across 3 enemies.' },
        { id: 'rail', name: 'Rail Sniper', cost: 140, color: '#ff2a85', range: 230, dmg: 85, rate: 1.85, desc: 'Long range armor-piercing.' },
        { id: 'miner', name: 'Credit Extractor', cost: 100, color: '#ffd166', range: 0, dmg: 0, rate: 3.5, income: 16, desc: 'Generates +Gold periodically.' }
      ];

      const goldEl = wrap.querySelector('#td-gold');
      const livesEl = wrap.querySelector('#td-lives');
      const waveEl = wrap.querySelector('#td-wave');
      const sendBtn = wrap.querySelector('#td-send');
      const speedBtn = wrap.querySelector('#td-speed');
      const orbitalBtn = wrap.querySelector('#td-orbital');
      const shopRow = wrap.querySelector('#td-shop');
      const inspEl = wrap.querySelector('#td-inspector');
      const overEl = wrap.querySelector('#td-over');
      const overTxt = wrap.querySelector('#td-over-txt');

      let gold, lives, wave, score, towers, enemies, projectiles, spawnQueue, spawnCd;
      let selectedBuild = 'pulse';
      let selectedTower = null;
      let orbitalMode = false;
      let orbitalCd = 0;
      let speedMult = 1;
      let dead = false;
      let rafId = 0;

      function renderShop() {
        shopRow.innerHTML = '';
        TOWERS.forEach(t => {
          const b = document.createElement('button');
          b.className = 'g-btn' + (selectedBuild === t.id && !orbitalMode ? ' g-btn-primary' : '');
          b.textContent = `${t.name} (${t.cost}g)`;
          b.title = t.desc;
          b.onclick = () => {
            selectedBuild = t.id;
            orbitalMode = false;
            renderShop();
          };
          shopRow.appendChild(b);
        });
      }

      function renderInspector() {
        if (!selectedTower) {
          inspEl.innerHTML = `<strong>Inspector</strong><p style="color:#94a3b8;margin:6px 0 0;">Click any tower to inspect, upgrade, or sell.</p>`;
          return;
        }
        const t = selectedTower;
        const upCost = Math.round(t.def.cost * 0.75 * t.lvl);
        inspEl.innerHTML = `
          <strong style="color:${t.def.color}">${t.def.name} (Lv ${t.lvl})</strong>
          <div style="margin:6px 0;color:#cbd5e1;">
            DMG: ${t.dmg}<br>
            Range: ${t.range}<br>
            Kills: ${t.kills}
          </div>
          <div class="g-row" style="justify-content:flex-start;">
            <button class="g-btn g-btn-primary" id="td-upg">Upgrade (${upCost}g)</button>
            <button class="g-btn g-btn-danger" id="td-sell">Sell (+${Math.round(t.spent * 0.65)}g)</button>
          </div>
        `;
        inspEl.querySelector('#td-upg').onclick = () => {
          if (gold < upCost) return;
          gold -= upCost;
          t.spent += upCost;
          t.lvl++;
          t.dmg = Math.round(t.dmg * 1.45);
          t.range += 14;
          t.rate = Math.max(0.18, t.rate * 0.88);
          audio.playPowerup();
          renderInspector();
        };
        inspEl.querySelector('#td-sell').onclick = () => {
          gold += Math.round(t.spent * 0.65);
          towers = towers.filter(tw => tw !== t);
          selectedTower = null;
          audio.playCoin();
          renderInspector();
        };
      }

      function startWave() {
        if (dead || spawnQueue.length > 0) return;
        wave++;
        const count = 8 + wave * 3;
        for (let i = 0; i < count; i++) {
          let kind = 'scout';
          if (wave % 5 === 0 && i === count - 1) kind = 'boss';
          else {
            const r = Math.random();
            if (r < 0.25) kind = 'swarm';
            else if (r < 0.45) kind = 'tank';
            else if (r < 0.6 && wave >= 2) kind = 'regen';
            else if (r < 0.75 && wave >= 3) kind = 'shield';
          }
          spawnQueue.push(kind);
        }
        audio.playClick();
      }

      function spawnEnemy(kind) {
        const scale = 1 + (wave - 1) * 0.35;
        const specs = {
          scout: { hp: 38, spd: 78, r: 9, reward: 12, color: '#2ee59d' },
          swarm: { hp: 22, spd: 110, r: 7, reward: 8, color: '#ffd166' },
          tank: { hp: 115, spd: 46, r: 13, reward: 22, color: '#a855f7' },
          regen: { hp: 72, spd: 64, r: 10, reward: 18, color: '#4ade80', regen: 5 },
          shield: { hp: 65, spd: 65, r: 11, reward: 20, color: '#38bdf8', shield: 45 },
          boss: { hp: 520, spd: 38, r: 16, reward: 95, color: '#ff2a85' }
        };
        const sp = specs[kind];
        enemies.push({
          kind,
          pathIdx: 0,
          x: PATH[0][0] * TILE + TILE / 2,
          y: PATH[0][1] * TILE + TILE / 2,
          hp: Math.round(sp.hp * scale),
          maxHp: Math.round(sp.hp * scale),
          shield: sp.shield ? Math.round(sp.shield * scale) : 0,
          spd: sp.spd,
          r: sp.r,
          reward: sp.reward,
          color: sp.color,
          regen: sp.regen || 0,
          slowTimer: 0
        });
      }

      function initGame() {
        gold = 220;
        lives = 20 + api.getStartingShields() * 3;
        wave = 0;
        score = 0;
        towers = [];
        enemies = [];
        projectiles = [];
        spawnQueue = [];
        spawnCd = 0;
        selectedTower = null;
        orbitalMode = false;
        orbitalCd = 0;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
        renderShop();
        renderInspector();
      }

      sendBtn.onclick = startWave;
      speedBtn.onclick = () => {
        speedMult = speedMult === 1 ? 2 : 1;
        speedBtn.textContent = `Speed: ${speedMult}x`;
      };
      orbitalBtn.onclick = () => {
        if (orbitalCd <= 0) {
          orbitalMode = !orbitalMode;
          renderShop();
        }
      };
      wrap.querySelector('#td-retry').onclick = initGame;

      function onCanvasClick(e) {
        if (dead) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

        if (orbitalMode && orbitalCd <= 0) {
          orbitalMode = false;
          orbitalCd = 14;
          fxSys.burst(x, y, '#ffd166', 32, 240);
          fxSys.shake(10, 0.25);
          audio.playExplosion();
          for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            if (Math.hypot(en.x - x, en.y - y) <= 95) {
              damageEnemy(en, 180, null);
            }
          }
          renderShop();
          return;
        }

        const gx = Math.floor(x / TILE);
        const gy = Math.floor(y / TILE);
        const existing = towers.find(t => t.gx === gx && t.gy === gy);
        if (existing) {
          selectedTower = existing;
          renderInspector();
          return;
        }
        if (pathSet.has(`${gx},${gy}`)) return;
        const def = TOWERS.find(t => t.id === selectedBuild);
        if (!def || gold < def.cost) return;
        gold -= def.cost;
        const tw = {
          gx, gy,
          x: gx * TILE + TILE / 2,
          y: gy * TILE + TILE / 2,
          def,
          lvl: 1,
          dmg: def.dmg,
          range: def.range,
          rate: def.rate,
          cd: 0,
          spent: def.cost,
          kills: 0
        };
        towers.push(tw);
        selectedTower = tw;
        audio.playClick();
        renderInspector();
      }

      canvas.addEventListener('click', onCanvasClick);

      function damageEnemy(en, dmg, sourceTower) {
        if (en.shield > 0) {
          const absorbed = Math.min(en.shield, dmg);
          en.shield -= absorbed;
          dmg -= absorbed;
        }
        en.hp -= dmg;
        if (en.hp <= 0 && !en._dead) {
          en._dead = true;
          gold += en.reward;
          const pts = en.reward * 10;
          score += pts;
          api.setScore(score);
          if (sourceTower) sourceTower.kills++;
          fxSys.burst(en.x, en.y, en.color, 9, 110);
          audio.playCoin();
        }
      }

      function update(rawDt) {
        if (dead || api.isPaused()) return;
        const dt = rawDt * speedMult;
        if (orbitalCd > 0) orbitalCd = Math.max(0, orbitalCd - rawDt);

        if (spawnQueue.length > 0) {
          spawnCd -= dt;
          if (spawnCd <= 0) {
            spawnEnemy(spawnQueue.shift());
            spawnCd = 0.55;
          }
        }

        // Move enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const en = enemies[i];
          if (en._dead) { enemies.splice(i, 1); continue; }
          if (en.regen > 0) en.hp = Math.min(en.maxHp, en.hp + en.regen * dt);
          if (en.slowTimer > 0) en.slowTimer -= dt;
          const spd = en.spd * (en.slowTimer > 0 ? 0.5 : 1);
          const nextNode = PATH[en.pathIdx + 1];
          if (!nextNode) {
            lives--;
            enemies.splice(i, 1);
            audio.playHit();
            fxSys.shake(6, 0.16);
            if (lives <= 0) {
              dead = true;
              api.gameOver(score);
              api.addCredits(Math.floor(score / 100));
              api.addXP(Math.floor(score / 60));
              overTxt.textContent = `Score: ${score} | Cleared Wave ${wave}`;
              overEl.classList.remove('hidden');
            }
            continue;
          }
          const tx = nextNode[0] * TILE + TILE / 2;
          const ty = nextNode[1] * TILE + TILE / 2;
          const dx = tx - en.x, dy = ty - en.y;
          const dist = Math.hypot(dx, dy);
          if (dist < spd * dt) {
            en.x = tx; en.y = ty; en.pathIdx++;
          } else {
            en.x += (dx / dist) * spd * dt;
            en.y += (dy / dist) * spd * dt;
          }
        }

        // Towers
        for (const t of towers) {
          t.cd -= dt;
          if (t.cd > 0) continue;
          if (t.def.id === 'miner') {
            if (enemies.length > 0 || spawnQueue.length > 0) {
              t.cd = t.rate;
              gold += t.def.income + (t.lvl - 1) * 8;
              fxSys.text(t.x, t.y - 12, `+${t.def.income + (t.lvl - 1) * 8}g`, '#ffd166', 11);
            }
            continue;
          }
          let target = null, maxProgress = -1;
          for (const en of enemies) {
            if (Math.hypot(en.x - t.x, en.y - t.y) <= t.range && en.pathIdx > maxProgress) {
              maxProgress = en.pathIdx;
              target = en;
            }
          }
          if (!target) continue;
          t.cd = t.rate;
          if (t.def.id === 'cryo') {
            for (const en of enemies) {
              if (Math.hypot(en.x - t.x, en.y - t.y) <= t.range) {
                en.slowTimer = 1.6;
                damageEnemy(en, t.dmg, t);
              }
            }
            fxSys.burst(t.x, t.y, '#38bdf8', 8, 90);
          } else if (t.def.id === 'tesla') {
            const hitSet = [target];
            for (let k = 1; k < 3; k++) {
              const prev = hitSet[hitSet.length - 1];
              const next = enemies.find(en => !hitSet.includes(en) && Math.hypot(en.x - prev.x, en.y - prev.y) < 110);
              if (next) hitSet.push(next);
            }
            hitSet.forEach(en => damageEnemy(en, t.dmg, t));
            projectiles.push({ type: 'arc', pts: [{ x: t.x, y: t.y }, ...hitSet.map(h => ({ x: h.x, y: h.y }))], life: 0.14 });
          } else {
            projectiles.push({
              x: t.x, y: t.y, tx: target.x, ty: target.y, target,
              spd: t.def.id === 'rail' ? 620 : 380, dmg: t.dmg, color: t.def.color, tower: t
            });
          }
        }

        // Projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          if (p.type === 'arc') {
            p.life -= dt;
            if (p.life <= 0) projectiles.splice(i, 1);
            continue;
          }
          const tx = p.target && !p.target._dead ? p.target.x : p.tx;
          const ty = p.target && !p.target._dead ? p.target.y : p.ty;
          const dx = tx - p.x, dy = ty - p.y;
          const d = Math.hypot(dx, dy);
          if (d < p.spd * dt + 6) {
            if (p.target && !p.target._dead) damageEnemy(p.target, p.dmg, p.tower);
            projectiles.splice(i, 1);
          } else {
            p.x += (dx / d) * p.spd * dt;
            p.y += (dy / d) * p.spd * dt;
          }
        }

        fxSys.update(dt);
        goldEl.textContent = `GOLD: ${gold}`;
        livesEl.textContent = `CORE HP: ${lives}`;
        waveEl.textContent = `WAVE: ${wave}`;
        orbitalBtn.textContent = orbitalCd > 0 ? `☄ Orbital (${orbitalCd.toFixed(0)}s)` : orbitalMode ? '☄ Click Target!' : '☄ Orbital Strike (READY)';
        sendBtn.disabled = spawnQueue.length > 0;
      }

      function draw() {
        ctx.fillStyle = '#070b17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid & Path
        for (let x = 0; x < COLS; x++) {
          for (let y = 0; y < ROWS; y++) {
            const onPath = pathSet.has(`${x},${y}`);
            ctx.fillStyle = onPath ? '#16223e' : '#0b1122';
            ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
          }
        }

        // Core marker
        const end = PATH[PATH.length - 1];
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(end[0] * TILE + TILE / 2, end[1] * TILE + TILE / 2, 14, 0, Math.PI * 2);
        ctx.fill();

        // Towers
        for (const t of towers) {
          ctx.fillStyle = t.def.color;
          ctx.fillRect(t.x - 13, t.y - 13, 26, 26);
          if (selectedTower === t) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(t.x - 14, t.y - 14, 28, 28);
            if (t.range > 0) {
              ctx.strokeStyle = 'rgba(0,240,255,0.28)';
              ctx.beginPath();
              ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.fillStyle = '#050812';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('L' + t.lvl, t.x, t.y + 4);
        }

        // Enemies
        for (const en of enemies) {
          ctx.fillStyle = en.color;
          ctx.beginPath();
          ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2);
          ctx.fill();
          if (en.shield > 0) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.fillStyle = '#111';
          ctx.fillRect(en.x - 12, en.y - en.r - 7, 24, 3.5);
          ctx.fillStyle = '#2ee59d';
          ctx.fillRect(en.x - 12, en.y - en.r - 7, 24 * Math.max(0, en.hp / en.maxHp), 3.5);
        }

        // Projectiles & Arcs
        for (const p of projectiles) {
          if (p.type === 'arc') {
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            p.pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

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

      initGame();
      rafId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('click', onCanvasClick);
      };
    }
  });

  // =========================================================
  // GAME 6: CRYPT OF CALCULUS (Turn-Based Roguelike Dungeon)
  // =========================================================
  window.Arcade.registerGame({
    id: 'crypt-calculus',
    title: 'Crypt of Calculus',
    category: 'Strategy & RPG',
    icon: '🗝️',
    genre: 'Turn-Based Roguelike Dungeon',
    description: 'Explore procedural fog-of-war dungeons, equip loot affixes, pray at shrines, cast 4 tactical abilities, and defeat Floor Bosses.',
    mechanics: ['Procedural Rooms + Fog', '4 Tactical Skills', 'Loot Affixes & Shrines', 'Floor Bosses'],
    controls: 'Move/Attack: WASD or Arrow Keys | Skills: [1] Cleave [2] Fireball [3] Shield Bash [4] Potion',
    stars: [1000, 3000, 7500],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="cc-floor">FLOOR 1</span>
          <span class="g-badge" id="cc-hp">HP: 60/60</span>
          <span class="g-badge" id="cc-stats">ATK: 10 | DEF: 2 | CRIT: 10%</span>
          <span class="g-badge" id="cc-pot">Potions: 2</span>
        </div>
        <div class="g-row" style="align-items:flex-start;">
          <div style="position:relative;">
            <canvas id="cc-canvas" class="g-canvas" width="660" height="450"></canvas>
            <div id="cc-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
              <h3 style="margin:0 0 8px;color:#ff4d6d;">FALLEN IN THE CRYPT</h3>
              <p id="cc-over-txt" style="margin:0 0 12px;"></p>
              <button class="g-btn g-btn-primary" id="cc-retry">New Descent</button>
            </div>
          </div>
          <div class="g-panel" style="width:240px;display:flex;flex-direction:column;gap:8px;font-size:12px;">
            <div class="g-row" style="justify-content:flex-start;">
              <button class="g-btn" id="cc-sk1">[1] Cleave</button>
              <button class="g-btn" id="cc-sk2">[2] Fireball</button>
              <button class="g-btn" id="cc-sk3">[3] Bash</button>
              <button class="g-btn g-btn-primary" id="cc-sk4">[4] Heal</button>
            </div>
            <div id="cc-gear" style="color:#ffd166;">Weapon: Iron Calculus (+0)<br>Armor: Cloth Robe (+0)</div>
            <div id="cc-log" style="height:240px;overflow-y:auto;background:#080d1b;padding:8px;border-radius:8px;color:#cbd5e1;font-family:monospace;font-size:11px;"></div>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#cc-canvas');
      const ctx = canvas.getContext('2d');
      const TILE = 30;
      const COLS = 22, ROWS = 15;

      const floorEl = wrap.querySelector('#cc-floor');
      const hpEl = wrap.querySelector('#cc-hp');
      const statsEl = wrap.querySelector('#cc-stats');
      const potEl = wrap.querySelector('#cc-pot');
      const gearEl = wrap.querySelector('#cc-gear');
      const logEl = wrap.querySelector('#cc-log');
      const overEl = wrap.querySelector('#cc-over');
      const overTxt = wrap.querySelector('#cc-over-txt');

      let map, visible, explored, player, enemies, items, stairs, shrine, floor, score, dead, cd;

      function addLog(msg) {
        const div = document.createElement('div');
        div.textContent = '> ' + msg;
        logEl.prepend(div);
        while (logEl.children.length > 35) logEl.removeChild(logEl.lastChild);
      }

      function generateFloor(fl) {
        map = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
        visible = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        explored = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

        const rooms = [];
        for (let i = 0; i < 8; i++) {
          const rw = 3 + Math.floor(Math.random() * 4);
          const rh = 3 + Math.floor(Math.random() * 3);
          const rx = 1 + Math.floor(Math.random() * (COLS - rw - 2));
          const ry = 1 + Math.floor(Math.random() * (ROWS - rh - 2));
          rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
          for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) map[y][x] = 0;
          }
        }
        for (let i = 1; i < rooms.length; i++) {
          let x = rooms[i - 1].cx, y = rooms[i - 1].cy;
          const tx = rooms[i].cx, ty = rooms[i].cy;
          while (x !== tx) { map[y][x] = 0; x += x < tx ? 1 : -1; }
          while (y !== ty) { map[y][x] = 0; y += y < ty ? 1 : -1; }
        }

        player.x = rooms[0].cx;
        player.y = rooms[0].cy;
        const lastRoom = rooms[rooms.length - 1];
        stairs = { x: lastRoom.cx, y: lastRoom.cy };

        const shrineRoom = rooms[Math.min(1, rooms.length - 1)];
        shrine = { x: shrineRoom.cx, y: shrineRoom.cy, used: false };

        enemies = [];
        const pool = [
          { name: 'Derivative Imp', ch: 'i', hp: 18, atk: 5, color: '#fb7185' },
          { name: 'Matrix Golem', ch: 'G', hp: 34, atk: 8, color: '#a855f7' },
          { name: 'Vector Stalker', ch: 'V', hp: 24, atk: 7, color: '#ffd166' }
        ];
        rooms.slice(1).forEach((rm, idx) => {
          const isBoss = idx === rooms.length - 2;
          const base = pool[idx % pool.length];
          const scale = 1 + (fl - 1) * 0.35;
          enemies.push({
            x: rm.cx + (isBoss ? 0 : (Math.random() > 0.5 ? 1 : -1)),
            y: rm.cy,
            name: isBoss ? `Floor ${fl} Arch-Warden` : base.name,
            ch: isBoss ? 'B' : base.ch,
            hp: Math.round((isBoss ? 68 : base.hp) * scale),
            maxHp: Math.round((isBoss ? 68 : base.hp) * scale),
            atk: Math.round((isBoss ? 12 : base.atk) * scale),
            color: isBoss ? '#ff2a85' : base.color,
            stunned: 0,
            boss: isBoss
          });
        });

        items = [];
        rooms.slice(1, -1).forEach(rm => {
          if (Math.random() < 0.75) {
            const roll = Math.random();
            items.push({
              x: rm.x, y: rm.y,
              kind: roll < 0.45 ? 'potion' : roll < 0.72 ? 'weapon' : 'armor',
              power: fl + Math.floor(Math.random() * 3)
            });
          }
        });
        computeFOV();
        addLog(`Entered Floor ${fl}. Find the stairs (▼).`);
      }

      function computeFOV() {
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) visible[y][x] = false;
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (Math.hypot(x - player.x, y - player.y) <= 5.5) {
              visible[y][x] = true;
              explored[y][x] = true;
            }
          }
        }
      }

      function initGame() {
        floor = 1;
        score = 0;
        dead = false;
        cd = { cleave: 0, fireball: 0, bash: 0 };
        const shieldBonus = api.getStartingShields() * 12;
        player = { x: 2, y: 2, hp: 60 + shieldBonus, maxHp: 60 + shieldBonus, atk: 10, def: 2, crit: 12, lifesteal: 0, potions: 2, weaponBonus: 0, armorBonus: 0 };
        logEl.innerHTML = '';
        overEl.classList.add('hidden');
        api.setScore(0);
        generateFloor(1);
        updateUI();
        draw();
      }

      function updateUI() {
        floorEl.textContent = `FLOOR ${floor}`;
        hpEl.textContent = `HP: ${player.hp}/${player.maxHp}`;
        statsEl.textContent = `ATK: ${player.atk} | DEF: ${player.def} | CRIT: ${player.crit}%`;
        potEl.textContent = `Potions: ${player.potions}`;
        gearEl.innerHTML = `Weapon: Edge (+${player.weaponBonus} ATK)<br>Armor: Plating (+${player.armorBonus} DEF)`;
        wrap.querySelector('#cc-sk1').textContent = cd.cleave > 0 ? `[1] Cleave (${cd.cleave})` : '[1] Cleave';
        wrap.querySelector('#cc-sk2').textContent = cd.fireball > 0 ? `[2] Fire (${cd.fireball})` : '[2] Fireball';
        wrap.querySelector('#cc-sk3').textContent = cd.bash > 0 ? `[3] Bash (${cd.bash})` : '[3] Bash';
      }

      function strikeEnemy(en, mult = 1, stun = 0) {
        const isCrit = Math.random() * 100 < player.crit;
        const dmg = Math.round(player.atk * mult * (isCrit ? 1.8 : 1));
        en.hp -= dmg;
        if (stun > 0) en.stunned = stun;
        if (player.lifesteal > 0) player.hp = Math.min(player.maxHp, player.hp + player.lifesteal);
        addLog(`Hit ${en.name} for ${dmg}${isCrit ? ' CRIT!' : ''}`);
        audio.playHit();
        if (en.hp <= 0) {
          score += en.boss ? 500 : 110;
          api.setScore(score);
          if (en.boss) api.addCredits(20);
          addLog(`Slain ${en.name}!`);
        }
      }

      function endTurn() {
        enemies = enemies.filter(e => e.hp > 0);
        if (cd.cleave > 0) cd.cleave--;
        if (cd.fireball > 0) cd.fireball--;
        if (cd.bash > 0) cd.bash--;

        for (const en of enemies) {
          if (en.stunned > 0) { en.stunned--; continue; }
          const dist = Math.abs(en.x - player.x) + Math.abs(en.y - player.y);
          if (dist === 1) {
            const dmg = Math.max(1, en.atk - player.def);
            player.hp -= dmg;
            addLog(`${en.name} strikes you for ${dmg}.`);
            if (player.hp <= 0) {
              player.hp = 0;
              dead = true;
              audio.playGameOver();
              api.gameOver(score);
              api.addCredits(Math.floor(score / 80));
              api.addXP(Math.floor(score / 50));
              overTxt.textContent = `Score: ${score} | Reached Floor ${floor}`;
              overEl.classList.remove('hidden');
              break;
            }
          } else if (dist <= 7) {
            const dx = Math.sign(player.x - en.x);
            const dy = Math.sign(player.y - en.y);
            const tries = Math.abs(player.x - en.x) > Math.abs(player.y - en.y)
              ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
            for (const [mx, my] of tries) {
              const nx = en.x + mx, ny = en.y + my;
              if (map[ny]?.[nx] === 0 && !enemies.some(o => o.x === nx && o.y === ny) && !(nx === player.x && ny === player.y)) {
                en.x = nx; en.y = ny; break;
              }
            }
          }
        }
        computeFOV();
        updateUI();
        draw();
      }

      function movePlayer(dx, dy) {
        if (dead || api.isPaused()) return;
        const nx = player.x + dx, ny = player.y + dy;
        if (map[ny]?.[nx] !== 0) return;

        const target = enemies.find(e => e.x === nx && e.y === ny);
        if (target) {
          strikeEnemy(target, 1, 0);
          endTurn();
          return;
        }
        player.x = nx; player.y = ny;

        // Pickup items
        const itemIdx = items.findIndex(it => it.x === nx && it.y === ny);
        if (itemIdx >= 0) {
          const it = items.splice(itemIdx, 1)[0];
          audio.playPowerup();
          if (it.kind === 'potion') { player.potions++; addLog('Picked up Healing Potion.'); }
          else if (it.kind === 'weapon') {
            player.atk += it.power;
            player.weaponBonus += it.power;
            player.crit = Math.min(50, player.crit + 3);
            addLog(`Equipped Cyber-Blade (+${it.power} ATK, +3% Crit)!`);
          } else {
            player.def += it.power;
            player.armorBonus += it.power;
            player.maxHp += 8; player.hp += 8;
            addLog(`Equipped Nano-Armor (+${it.power} DEF, +8 MaxHP)!`);
          }
        }

        // Shrine
        if (!shrine.used && shrine.x === nx && shrine.y === ny) {
          shrine.used = true;
          player.hp = player.maxHp;
          player.lifesteal += 1;
          addLog('Shrine blessed you: Full HP & +1 Lifesteal!');
          audio.playPowerup();
        }

        // Stairs
        if (stairs.x === nx && stairs.y === ny) {
          floor++;
          score += 250;
          api.setScore(score);
          api.addCredits(15);
          generateFloor(floor);
          updateUI();
          draw();
          return;
        }
        endTurn();
      }

      function useSkill(num) {
        if (dead || api.isPaused()) return;
        if (num === 1 && cd.cleave === 0) {
          cd.cleave = 4;
          const adj = enemies.filter(e => Math.abs(e.x - player.x) <= 1 && Math.abs(e.y - player.y) <= 1);
          if (adj.length === 0) addLog('Cleave hit nothing.');
          adj.forEach(e => strikeEnemy(e, 1.35, 0));
          endTurn();
        } else if (num === 2 && cd.fireball === 0) {
          cd.fireball = 5;
          const target = enemies.find(e => Math.hypot(e.x - player.x, e.y - player.y) <= 5.5);
          if (target) {
            enemies.filter(e => Math.hypot(e.x - target.x, e.y - target.y) <= 1.6)
              .forEach(e => strikeEnemy(e, 1.6, 0));
            audio.playExplosion();
          } else addLog('No enemy in Fireball range.');
          endTurn();
        } else if (num === 3 && cd.bash === 0) {
          cd.bash = 4;
          const adj = enemies.find(e => Math.abs(e.x - player.x) + Math.abs(e.y - player.y) === 1);
          if (adj) strikeEnemy(adj, 1.1, 2);
          else addLog('No adjacent enemy to Bash.');
          endTurn();
        } else if (num === 4 && player.potions > 0) {
          player.potions--;
          player.hp = Math.min(player.maxHp, player.hp + 30);
          addLog('Drank Potion (+30 HP).');
          audio.playPowerup();
          endTurn();
        }
      }

      wrap.querySelector('#cc-sk1').onclick = () => useSkill(1);
      wrap.querySelector('#cc-sk2').onclick = () => useSkill(2);
      wrap.querySelector('#cc-sk3').onclick = () => useSkill(3);
      wrap.querySelector('#cc-sk4').onclick = () => useSkill(4);
      wrap.querySelector('#cc-retry').onclick = initGame;

      function onKeyDown(e) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') movePlayer(0, -1);
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') movePlayer(0, 1);
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePlayer(-1, 0);
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') movePlayer(1, 0);
        else if (e.code === 'Digit1') useSkill(1);
        else if (e.code === 'Digit2') useSkill(2);
        else if (e.code === 'Digit3') useSkill(3);
        else if (e.code === 'Digit4') useSkill(4);
      }
      window.addEventListener('keydown', onKeyDown);

      function draw() {
        ctx.fillStyle = '#050812';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (!explored[y][x]) continue;
            const vis = visible[y][x];
            if (map[y][x] === 1) {
              ctx.fillStyle = vis ? '#24345e' : '#11192e';
              ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
            } else {
              ctx.fillStyle = vis ? '#101933' : '#090e1e';
              ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
            }
          }
        }

        if (explored[stairs.y][stairs.x]) {
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('▼', stairs.x * TILE + TILE / 2, stairs.y * TILE + 22);
        }
        if (!shrine.used && explored[shrine.y][shrine.x]) {
          ctx.fillStyle = '#2ee59d';
          ctx.font = 'bold 18px monospace';
          ctx.fillText('✚', shrine.x * TILE + TILE / 2, shrine.y * TILE + 21);
        }

        for (const it of items) {
          if (!visible[it.y][it.x]) continue;
          ctx.fillStyle = it.kind === 'potion' ? '#fb7185' : '#ffd166';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(it.kind === 'potion' ? '!' : it.kind === 'weapon' ? '†' : '🛡', it.x * TILE + TILE / 2, it.y * TILE + 21);
        }

        for (const en of enemies) {
          if (!visible[en.y][en.x]) continue;
          ctx.fillStyle = en.color;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(en.ch, en.x * TILE + TILE / 2, en.y * TILE + 21);
          if (en.stunned > 0) {
            ctx.fillStyle = '#ffd166';
            ctx.font = '10px monospace';
            ctx.fillText('ZZZ', en.x * TILE + TILE / 2, en.y * TILE + 8);
          }
        }

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      initGame();
      return () => { window.removeEventListener('keydown', onKeyDown); };
    }
  });

  // =========================================================
  // GAME 7: DECK OF SINGULARITY (Roguelite Deckbuilder)
  // =========================================================
  window.Arcade.registerGame({
    id: 'deck-singularity',
    title: 'Deck of Singularity',
    category: 'Strategy & RPG',
    icon: '🃏',
    genre: 'Roguelite Card Deckbuilder',
    description: 'Draft cards, manage Energy, stack Poison/Vulnerable/Strength, read enemy intents, and survive escalating Sector Bosses.',
    mechanics: ['12 Distinct Cards', 'Status Effects & Combos', 'Enemy Intent Preview', 'Post-Battle Card Draft'],
    controls: 'Click Cards in Hand to Play | End Turn to Resolve Enemy Intent | Draft Cards After Victory',
    stars: [1000, 2800, 6500],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="ds-enc">ENCOUNTER 1</span>
          <span class="g-badge" id="ds-energy">ENERGY: 3/3</span>
          <span class="g-badge" id="ds-piles">Draw: 0 | Discard: 0</span>
        </div>
        <div class="g-panel" style="width:100%;max-width:860px;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <h3 style="margin:0 0 6px;color:#00f0ff;">Cyber-Runner (You)</h3>
            <div id="ds-php" style="font-size:15px;font-weight:700;">HP: 70/70 | Shield: 0</div>
            <div id="ds-pbuffs" style="font-size:12px;color:#2ee59d;margin-top:4px;"></div>
          </div>
          <div style="flex:1;min-width:220px;text-align:right;">
            <h3 id="ds-ename" style="margin:0 0 6px;color:#ff2a85;">Sentinel Drone</h3>
            <div id="ds-ehp" style="font-size:15px;font-weight:700;">HP: 42/42 | Shield: 0</div>
            <div id="ds-ebuffs" style="font-size:12px;color:#ffd166;margin-top:4px;"></div>
            <div id="ds-intent" style="margin-top:6px;font-weight:800;color:#fb7185;">Intent: Attack 8</div>
          </div>
        </div>
        <div id="ds-log" class="g-panel" style="width:100%;max-width:860px;font-size:12px;color:#cbd5e1;">Battle initialized. Play cards from your hand!</div>
        <div id="ds-hand" class="g-row" style="max-width:900px;"></div>
        <div class="g-row">
          <button class="g-btn g-btn-gold" id="ds-endturn">End Turn ⏭</button>
        </div>
        <div id="ds-draft" class="g-overlay-card hidden" style="width:100%;max-width:680px;">
          <h3 style="margin:0 0 8px;color:#00f0ff;">VICTORY! DRAFT A CARD TO YOUR DECK</h3>
          <div id="ds-draft-opts" class="g-row"></div>
          <button class="g-btn" id="ds-skip-draft" style="margin-top:10px;">Skip &amp; Heal +10 HP</button>
        </div>
        <div id="ds-over" class="g-overlay-card hidden">
          <h3 style="margin:0 0 8px;color:#ff4d6d;">NEURAL DECK SHATTERED</h3>
          <p id="ds-over-txt" style="margin:0 0 12px;"></p>
          <button class="g-btn g-btn-primary" id="ds-retry">New Run</button>
        </div>
      `;
      container.appendChild(wrap);

      const CARDS = {
        strike: { name: 'Laser Strike', cost: 1, type: 'ATK', desc: 'Deal 7 DMG.', fn: s => dealEnemy(7) },
        guard: { name: 'Aegis Guard', cost: 1, type: 'DEF', desc: 'Gain 6 Shield.', fn: s => gainShield(6) },
        venom: { name: 'Venom Inject', cost: 1, type: 'SKILL', desc: 'Apply 4 Poison & 4 DMG.', fn: s => { dealEnemy(4); s.enemy.poison += 4; } },
        overclock: { name: 'Overclock', cost: 0, type: 'SKILL', desc: 'Gain +2 Energy, Draw 1.', fn: s => { s.energy += 2; drawCards(1); } },
        barrage: { name: 'Plasma Barrage', cost: 2, type: 'ATK', desc: 'Deal 6 DMG twice.', fn: s => { dealEnemy(6); dealEnemy(6); } },
        repair: { name: 'Nano Repair', cost: 1, type: 'SKILL', desc: 'Heal 8 HP & +4 Shield.', fn: s => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 8); gainShield(4); } },
        emp: { name: 'EMP Shock', cost: 1, type: 'SKILL', desc: 'Apply 2 Vulnerable & 2 Weak.', fn: s => { s.enemy.vuln += 2; s.enemy.weak += 2; } },
        doubleTap: { name: 'Surge Matrix', cost: 1, type: 'PWR', desc: 'Gain +2 Strength permanently.', fn: s => { s.player.str += 2; } },
        execute: { name: 'Void Execute', cost: 2, type: 'ATK', desc: 'Deal 16 DMG (24 if Vuln).', fn: s => { dealEnemy(s.enemy.vuln > 0 ? 24 : 16); } },
        fortress: { name: 'Iron Fortress', cost: 2, type: 'DEF', desc: 'Gain 15 Shield & +1 Str.', fn: s => { gainShield(15); s.player.str += 1; } },
        siphon: { name: 'Soul Siphon', cost: 1, type: 'ATK', desc: 'Deal 6 DMG & Heal 4 HP.', fn: s => { dealEnemy(6); s.player.hp = Math.min(s.player.maxHp, s.player.hp + 4); } },
        recycle: { name: 'Data Draw', cost: 0, type: 'SKILL', desc: 'Draw 2 cards & +3 Shield.', fn: s => { drawCards(2); gainShield(3); } }
      };

      const encEl = wrap.querySelector('#ds-enc');
      const enEl = wrap.querySelector('#ds-energy');
      const pilesEl = wrap.querySelector('#ds-piles');
      const phpEl = wrap.querySelector('#ds-php');
      const pbuffEl = wrap.querySelector('#ds-pbuffs');
      const enameEl = wrap.querySelector('#ds-ename');
      const ehpEl = wrap.querySelector('#ds-ehp');
      const ebuffEl = wrap.querySelector('#ds-ebuffs');
      const intentEl = wrap.querySelector('#ds-intent');
      const logEl = wrap.querySelector('#ds-log');
      const handEl = wrap.querySelector('#ds-hand');
      const draftEl = wrap.querySelector('#ds-draft');
      const draftOpts = wrap.querySelector('#ds-draft-opts');
      const overEl = wrap.querySelector('#ds-over');
      const overTxt = wrap.querySelector('#ds-over-txt');

      let st;

      function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      function gainShield(amt) {
        st.player.shield += amt;
      }

      function dealEnemy(base) {
        let dmg = base + st.player.str;
        if (st.enemy.vuln > 0) dmg = Math.round(dmg * 1.5);
        if (st.enemy.shield > 0) {
          const ab = Math.min(st.enemy.shield, dmg);
          st.enemy.shield -= ab;
          dmg -= ab;
        }
        st.enemy.hp = Math.max(0, st.enemy.hp - dmg);
        audio.playLaser();
      }

      function drawCards(count) {
        for (let i = 0; i < count; i++) {
          if (st.draw.length === 0) {
            if (st.discard.length === 0) break;
            st.draw = shuffle(st.discard);
            st.discard = [];
          }
          if (st.hand.length < 8) st.hand.push(st.draw.pop());
        }
      }

      function rollIntent() {
        const roll = Math.random();
        const atkBase = 7 + st.encounter * 2;
        if (roll < 0.55) st.enemy.intent = { type: 'atk', val: atkBase };
        else if (roll < 0.8) st.enemy.intent = { type: 'def', val: 6 + st.encounter * 2 };
        else st.enemy.intent = { type: 'heavy', val: atkBase + 5 };
      }

      function spawnEncounter(num) {
        st.encounter = num;
        const isBoss = num % 3 === 0;
        const names = ['Sentinel Drone', 'Firewall Hound', 'Hex Weaver', 'Singularity Core'];
        const hp = (isBoss ? 72 : 34) + num * 12;
        st.enemy = {
          name: isBoss ? `BOSS: ${names[3]}` : names[(num - 1) % 3],
          hp, maxHp: hp, shield: 0, poison: 0, vuln: 0, weak: 0, intent: { type: 'atk', val: 8 }
        };
        st.draw = shuffle(st.deck);
        st.discard = [];
        st.hand = [];
        st.player.shield = api.getStartingShields() * 5;
        st.player.str = 0;
        st.energy = 3;
        drawCards(5);
        rollIntent();
        logEl.textContent = `Encounter ${num}: ${st.enemy.name} appeared!`;
        render();
      }

      function initGame() {
        st = {
          encounter: 1,
          score: 0,
          energy: 3,
          deck: ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'venom', 'emp', 'overclock'],
          draw: [], discard: [], hand: [],
          player: { hp: 70 + api.getStartingShields() * 10, maxHp: 70 + api.getStartingShields() * 10, shield: 0, str: 0 },
          enemy: null,
          dead: false,
          drafting: false
        };
        overEl.classList.add('hidden');
        draftEl.classList.add('hidden');
        api.setScore(0);
        spawnEncounter(1);
      }

      function checkEnemyDead() {
        if (st.enemy.hp > 0) return false;
        st.score += 300 + st.encounter * 100;
        api.setScore(st.score);
        api.addCredits(18 + st.encounter * 4);
        api.addXP(25);
        audio.playPowerup();
        openDraft();
        return true;
      }

      function openDraft() {
        st.drafting = true;
        const allKeys = Object.keys(CARDS);
        const picks = shuffle(allKeys).slice(0, 3);
        draftOpts.innerHTML = '';
        picks.forEach(k => {
          const c = CARDS[k];
          const btn = document.createElement('button');
          btn.className = 'g-btn';
          btn.style.width = '185px';
          btn.innerHTML = `<strong>${c.name} (${c.cost}⚡)</strong><br><small style="color:#94a3b8">${c.desc}</small>`;
          btn.onclick = () => {
            st.deck.push(k);
            st.drafting = false;
            draftEl.classList.add('hidden');
            spawnEncounter(st.encounter + 1);
          };
          draftOpts.appendChild(btn);
        });
        draftEl.classList.remove('hidden');
      }

      wrap.querySelector('#ds-skip-draft').onclick = () => {
        st.player.hp = Math.min(st.player.maxHp, st.player.hp + 10);
        st.drafting = false;
        draftEl.classList.add('hidden');
        spawnEncounter(st.encounter + 1);
      };

      wrap.querySelector('#ds-endturn').onclick = () => {
        if (st.dead || st.drafting || api.isPaused()) return;
        // Poison ticks on enemy
        if (st.enemy.poison > 0) {
          st.enemy.hp = Math.max(0, st.enemy.hp - st.enemy.poison);
          st.enemy.poison--;
          if (checkEnemyDead()) return;
        }
        // Enemy acts
        const int = st.enemy.intent;
        if (int.type === 'def') {
          st.enemy.shield += int.val;
          logEl.textContent = `${st.enemy.name} fortified +${int.val} Shield.`;
        } else {
          let dmg = int.val;
          if (st.enemy.weak > 0) dmg = Math.floor(dmg * 0.75);
          const ab = Math.min(st.player.shield, dmg);
          st.player.shield -= ab;
          dmg -= ab;
          st.player.hp = Math.max(0, st.player.hp - dmg);
          audio.playHit();
          logEl.textContent = `${st.enemy.name} attacked for ${int.val} (${dmg} unblocked)!`;
        }
        if (st.enemy.vuln > 0) st.enemy.vuln--;
        if (st.enemy.weak > 0) st.enemy.weak--;

        if (st.player.hp <= 0) {
          st.dead = true;
          audio.playGameOver();
          api.gameOver(st.score);
          overTxt.textContent = `Final Score: ${st.score} | Cleared ${st.encounter - 1} Encounters`;
          overEl.classList.remove('hidden');
          render();
          return;
        }

        st.discard.push(...st.hand);
        st.hand = [];
        st.player.shield = 0;
        st.energy = 3;
        drawCards(5);
        rollIntent();
        render();
      };

      wrap.querySelector('#ds-retry').onclick = initGame;

      function render() {
        encEl.textContent = `ENCOUNTER ${st.encounter}`;
        enEl.textContent = `ENERGY: ${st.energy}/3`;
        pilesEl.textContent = `Draw: ${st.draw.length} | Discard: ${st.discard.length}`;
        phpEl.textContent = `HP: ${st.player.hp}/${st.player.maxHp} | Shield: ${st.player.shield}`;
        pbuffEl.textContent = st.player.str > 0 ? `Strength +${st.player.str}` : '';

        enameEl.textContent = st.enemy.name;
        ehpEl.textContent = `HP: ${st.enemy.hp}/${st.enemy.maxHp} | Shield: ${st.enemy.shield}`;
        const eb = [];
        if (st.enemy.poison > 0) eb.push(`Poison ${st.enemy.poison}`);
        if (st.enemy.vuln > 0) eb.push(`Vulnerable ${st.enemy.vuln}`);
        if (st.enemy.weak > 0) eb.push(`Weak ${st.enemy.weak}`);
        ebuffEl.textContent = eb.join(' | ');
        const int = st.enemy.intent;
        intentEl.textContent = int.type === 'def' ? `Intent: Defend +${int.val}` : `Intent: Attack ${int.val}`;

        handEl.innerHTML = '';
        st.hand.forEach((cardKey, idx) => {
          const c = CARDS[cardKey];
          const btn = document.createElement('button');
          btn.className = 'g-panel';
          btn.style.cssText = 'width:148px;text-align:left;cursor:pointer;color:#eef3ff;border-color:' +
            (c.type === 'ATK' ? '#ff4d6d' : c.type === 'DEF' ? '#38bdf8' : '#a855f7');
          btn.disabled = st.energy < c.cost || st.dead || st.drafting;
          btn.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:4px;">
              <span>${c.name}</span><span style="color:#ffd166;">${c.cost}⚡</span>
            </div>
            <div style="font-size:11px;color:#94a3b8;">${c.desc}</div>
          `;
          btn.onclick = () => {
            if (st.energy < c.cost || st.dead || st.drafting) return;
            st.energy -= c.cost;
            st.hand.splice(idx, 1);
            st.discard.push(cardKey);
            c.fn(st);
            logEl.textContent = `Played ${c.name}.`;
            if (!checkEnemyDead()) render();
          };
          handEl.appendChild(btn);
        });
      }

      initGame();
      return () => {};
    }
  });

  // =========================================================
  // GAME 8: ORBITAL SIEGE (Gravity Slingshot Artillery)
  // =========================================================
  window.Arcade.registerGame({
    id: 'orbital-siege',
    title: 'Orbital Siege',
    category: 'Strategy & RPG',
    icon: '🪐',
    genre: 'Gravity Slingshot Artillery',
    description: 'Curve artillery shells around gravitational planets to destroy enemy fortresses across moving shields and orbital mechanics.',
    mechanics: ['Real Gravity Physics', '5 Ammo Types', 'Trajectory Preview', 'Moving Shields'],
    controls: 'Adjust Angle & Power Sliders (or Drag on Canvas to Slingshot) | Select Ammo | FIRE',
    stars: [800, 2200, 5000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="os-lvl">SECTOR 1</span>
          <span class="g-badge" id="os-shots">SHOTS: 8</span>
          <div class="g-row" id="os-ammo"></div>
        </div>
        <div style="position:relative;">
          <canvas id="os-canvas" class="g-canvas" width="840" height="460"></canvas>
          <div id="os-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">OUT OF ORDNANCE</h3>
            <p id="os-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="os-retry">Restart Campaign</button>
          </div>
        </div>
        <div class="g-row g-panel" style="width:100%;max-width:840px;">
          <label>Angle: <input type="range" id="os-ang" min="-85" max="85" value="-28" /> <span id="os-ang-v">-28°</span></label>
          <label>Power: <input type="range" id="os-pow" min="150" max="620" value="360" /> <span id="os-pow-v">360</span></label>
          <button class="g-btn g-btn-primary" id="os-fire">🚀 FIRE</button>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#os-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const AMMO = [
        { id: 'std', name: 'Shell', color: '#00f0ff', dmg: 100 },
        { id: 'cluster', name: 'Cluster', color: '#ffd166', dmg: 55 },
        { id: 'well', name: 'Anti-Grav', color: '#a855f7', dmg: 90 },
        { id: 'drill', name: 'Drill Laser', color: '#2ee59d', dmg: 85 },
        { id: 'napalm', name: 'Napalm', color: '#ff4d6d', dmg: 130 }
      ];

      const lvlEl = wrap.querySelector('#os-lvl');
      const shotsEl = wrap.querySelector('#os-shots');
      const ammoRow = wrap.querySelector('#os-ammo');
      const angIn = wrap.querySelector('#os-ang');
      const powIn = wrap.querySelector('#os-pow');
      const angVal = wrap.querySelector('#os-ang-v');
      const powVal = wrap.querySelector('#os-pow-v');
      const overEl = wrap.querySelector('#os-over');
      const overTxt = wrap.querySelector('#os-over-txt');

      let sector, shotsLeft, score, launcher, targets, planets, shields, projectiles, selectedAmmo, dead, rafId;

      function renderAmmo() {
        ammoRow.innerHTML = '';
        AMMO.forEach(a => {
          const b = document.createElement('button');
          b.className = 'g-btn' + (selectedAmmo === a.id ? ' g-btn-primary' : '');
          b.textContent = a.name;
          b.onclick = () => { selectedAmmo = a.id; renderAmmo(); };
          ammoRow.appendChild(b);
        });
      }

      function setupSector(sec) {
        sector = sec;
        shotsLeft = 8;
        launcher = { x: 65, y: H / 2 + (Math.random() - 0.5) * 140 };
        planets = [];
        const pCount = Math.min(4, 1 + Math.floor(sec / 2));
        for (let i = 0; i < pCount; i++) {
          planets.push({
            x: 260 + i * 135 + (Math.random() - 0.5) * 40,
            y: 110 + Math.random() * (H - 220),
            r: 22 + Math.random() * 20,
            mass: 160000 + Math.random() * 140000
          });
        }
        targets = [];
        const tCount = Math.min(4, 1 + Math.floor((sec + 1) / 2));
        for (let i = 0; i < tCount; i++) {
          targets.push({
            x: W - 90 - Math.random() * 90,
            y: 70 + (i + 0.5) * ((H - 140) / tCount),
            r: 18,
            hp: 100,
            maxHp: 100
          });
        }
        shields = sec >= 2 ? [{ x: W - 210, y: H / 2, h: 90, vy: 85 }] : [];
        projectiles = [];
      }

      function initGame() {
        score = 0;
        selectedAmmo = 'std';
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
        renderAmmo();
        setupSector(1);
      }

      function fire() {
        if (dead || shotsLeft <= 0 || projectiles.length > 0) return;
        shotsLeft--;
        const rad = (Number(angIn.value) * Math.PI) / 180;
        const pow = Number(powIn.value);
        const ammo = AMMO.find(a => a.id === selectedAmmo);
        projectiles.push({
          x: launcher.x + Math.cos(rad) * 20,
          y: launcher.y + Math.sin(rad) * 20,
          vx: Math.cos(rad) * pow,
          vy: Math.sin(rad) * pow,
          kind: ammo.id,
          color: ammo.color,
          dmg: ammo.dmg,
          age: 0,
          splitDone: false,
          trail: []
        });
        audio.playLaser();
      }

      angIn.oninput = () => { angVal.textContent = angIn.value + '°'; };
      powIn.oninput = () => { powVal.textContent = powIn.value; };
      wrap.querySelector('#os-fire').onclick = fire;
      wrap.querySelector('#os-retry').onclick = initGame;

      function stepGravity(obj, dt) {
        const gravSign = obj.kind === 'well' ? -0.45 : obj.kind === 'drill' ? 0.25 : 1;
        for (const pl of planets) {
          const dx = pl.x - obj.x, dy = pl.y - obj.y;
          const d2 = Math.max(400, dx * dx + dy * dy);
          const d = Math.sqrt(d2);
          const accel = (pl.mass / d2) * gravSign;
          obj.vx += (dx / d) * accel * dt;
          obj.vy += (dy / d) * accel * dt;
        }
      }

      function update(dt) {
        if (dead || api.isPaused()) return;
        for (const sh of shields) {
          sh.y += sh.vy * dt;
          if (sh.y < 60 || sh.y > H - 60) sh.vy *= -1;
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          p.age += dt;
          if (p.kind === 'cluster' && !p.splitDone && p.age > 0.65) {
            p.splitDone = true;
            [-0.25, 0.25].forEach(off => {
              const ang = Math.atan2(p.vy, p.vx) + off;
              const spd = Math.hypot(p.vx, p.vy);
              projectiles.push({
                x: p.x, y: p.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                kind: 'std', color: '#ffd166', dmg: 65, age: 0, splitDone: true, trail: []
              });
            });
          }

          stepGravity(p, dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 35) p.trail.shift();

          let destroyed = false;
          // Planet hit
          if (p.kind !== 'drill') {
            for (const pl of planets) {
              if (Math.hypot(p.x - pl.x, p.y - pl.y) < pl.r + 4) {
                destroyed = true;
                fxSys.burst(p.x, p.y, p.color, 12, 120);
                break;
              }
            }
          }
          // Shield hit
          for (const sh of shields) {
            if (Math.abs(p.x - sh.x) < 6 && Math.abs(p.y - sh.y) < sh.h / 2) {
              if (p.kind === 'drill') break;
              p.vx = -Math.abs(p.vx) * 0.8;
              audio.playClick();
            }
          }
          // Target hit
          for (let j = targets.length - 1; j >= 0; j--) {
            const t = targets[j];
            if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + 6) {
              t.hp -= p.dmg;
              destroyed = true;
              fxSys.burst(p.x, p.y, '#ff4d6d', 20, 180);
              fxSys.shake(7, 0.18);
              audio.playExplosion();
              if (t.hp <= 0) {
                targets.splice(j, 1);
                score += 250;
                api.setScore(score);
              }
              break;
            }
          }

          if (destroyed || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50 || p.age > 7) {
            projectiles.splice(i, 1);
          }
        }

        if (targets.length === 0) {
          score += shotsLeft * 75;
          api.setScore(score);
          api.addCredits(25);
          audio.playPowerup();
          setupSector(sector + 1);
        } else if (shotsLeft === 0 && projectiles.length === 0) {
          dead = true;
          audio.playGameOver();
          api.gameOver(score);
          overTxt.textContent = `Score: ${score} | Cleared Sector ${sector - 1}`;
          overEl.classList.remove('hidden');
        }

        fxSys.update(dt);
        lvlEl.textContent = `SECTOR ${sector}`;
        shotsEl.textContent = `SHOTS: ${shotsLeft}`;
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = '#060914';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        // Trajectory preview
        const rad = (Number(angIn.value) * Math.PI) / 180;
        const pow = Number(powIn.value);
        const sim = {
          x: launcher.x + Math.cos(rad) * 20,
          y: launcher.y + Math.sin(rad) * 20,
          vx: Math.cos(rad) * pow,
          vy: Math.sin(rad) * pow,
          kind: selectedAmmo
        };
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        for (let s = 0; s < 32; s++) {
          stepGravity(sim, 0.03);
          sim.x += sim.vx * 0.03;
          sim.y += sim.vy * 0.03;
          ctx.beginPath(); ctx.arc(sim.x, sim.y, 2, 0, Math.PI * 2); ctx.fill();
        }

        // Planets
        for (const pl of planets) {
          const grad = ctx.createRadialGradient(pl.x, pl.y, pl.r * 0.3, pl.x, pl.y, pl.r);
          grad.addColorStop(0, '#6366f1');
          grad.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(99,102,241,0.25)';
          ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r * 2.2, 0, Math.PI * 2); ctx.stroke();
        }

        // Moving shields
        ctx.fillStyle = '#38bdf8';
        for (const sh of shields) ctx.fillRect(sh.x - 4, sh.y - sh.h / 2, 8, sh.h);

        // Targets
        for (const t of targets) {
          ctx.fillStyle = '#ff2a85';
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Launcher
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath(); ctx.arc(launcher.x, launcher.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(launcher.x, launcher.y);
        ctx.lineTo(launcher.x + Math.cos(rad) * 26, launcher.y + Math.sin(rad) * 26);
        ctx.stroke();

        // Projectiles
        for (const p of projectiles) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          p.trail.forEach((pt, idx) => idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        }

        fxSys.draw(ctx);
        ctx.restore();
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
      return () => cancelAnimationFrame(rafId);
    }
  });
})();
