(function () {
  const { audio, fx } = window.Arcade;

  // =========================================================
  // GAME 13: PULSE RUNNER: SYNTHWAVE
  // =========================================================
  window.Arcade.registerGame({
    id: 'pulse-runner',
    title: 'Pulse Runner: Synthwave',
    category: 'Reflex & Rhythm',
    icon: '🏃',
    genre: 'Gravity-Flip Cyber Runner',
    description: 'Flip gravity between floor and ceiling at synth speed, Phase-Dash straight through red barriers, collect orbs, and survive boss sweeps.',
    mechanics: ['Gravity Flip Mechanic', 'Phase-Dash Through Lasers', 'Speed Multiplier', 'Boss Sweep Sequences'],
    controls: 'Flip Gravity: W / Up Arrow / Left Click | Phase-Dash: Space / Right Click',
    stars: [1200, 3800, 9000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="pr-spd">SPEED: 1.0x</span>
          <span class="g-badge" id="pr-dash">PHASE DASH: READY</span>
          <span class="g-badge" id="pr-orbs">ORBS: 0</span>
        </div>
        <div style="position:relative;">
          <canvas id="pr-canvas" class="g-canvas" width="840" height="420"></canvas>
          <div id="pr-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">SIGNAL TERMINATED</h3>
            <p id="pr-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="pr-retry">Run Again</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#pr-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const spdEl = wrap.querySelector('#pr-spd');
      const dashEl = wrap.querySelector('#pr-dash');
      const orbsEl = wrap.querySelector('#pr-orbs');
      const overEl = wrap.querySelector('#pr-over');
      const overTxt = wrap.querySelector('#pr-over-txt');

      const FLOOR_Y = H - 48, CEIL_Y = 48;
      let runner, obstacles, orbs, speed, mult, score, orbCount, dead, rafId, spawnT, bossT;

      function initGame() {
        runner = { x: 140, y: FLOOR_Y - 16, vy: 0, grav: 1, r: 16, phaseTime: 0, phaseCd: 0 };
        obstacles = [];
        orbs = [];
        speed = 330;
        mult = 1;
        score = 0;
        orbCount = 0;
        dead = false;
        spawnT = 0;
        bossT = 18;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function flipGravity() {
        if (dead || api.isPaused()) return;
        runner.grav *= -1;
        runner.vy = runner.grav * 220;
        audio.playClick();
        fxSys.burst(runner.x, runner.y, '#00f0ff', 8, 90);
      }

      function phaseDash() {
        if (dead || runner.phaseCd > 0 || api.isPaused()) return;
        runner.phaseTime = 0.42;
        runner.phaseCd = 2.4;
        audio.playLaser();
        fxSys.burst(runner.x, runner.y, '#a855f7', 14, 150);
      }

      function onKeyDown(e) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') flipGravity();
        if (e.code === 'Space') phaseDash();
      }
      function onMouseDown(e) {
        if (e.button === 2) phaseDash();
        else flipGravity();
      }
      function onContext(e) { e.preventDefault(); }

      window.addEventListener('keydown', onKeyDown);
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('contextmenu', onContext);
      wrap.querySelector('#pr-retry').onclick = initGame;

      function update(dt) {
        if (dead || api.isPaused()) return;
        speed = Math.min(680, speed + 7 * dt);
        mult = 1 + (speed - 330) / 140;
        score += 45 * mult * dt;
        api.setScore(Math.floor(score));

        if (runner.phaseTime > 0) runner.phaseTime -= dt;
        if (runner.phaseCd > 0) runner.phaseCd = Math.max(0, runner.phaseCd - dt);

        runner.vy += runner.grav * 2200 * dt;
        runner.y += runner.vy * dt;
        if (runner.y > FLOOR_Y - runner.r) { runner.y = FLOOR_Y - runner.r; runner.vy = 0; }
        if (runner.y < CEIL_Y + runner.r) { runner.y = CEIL_Y + runner.r; runner.vy = 0; }

        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = Math.max(0.55, 1.35 - (speed - 330) / 700);
          const kind = Math.random();
          if (kind < 0.35) {
            // Red laser gate spanning tall - encourage phase-dash or flip!
            const onFloor = Math.random() < 0.5;
            const h = 110 + Math.random() * 80;
            obstacles.push({
              x: W + 30,
              y: onFloor ? FLOOR_Y - h : CEIL_Y,
              w: 22, h,
              color: '#ff2a85', phaseable: true
            });
          } else {
            // Solid spike block
            const onFloor = Math.random() < 0.5;
            obstacles.push({
              x: W + 30,
              y: onFloor ? FLOOR_Y - 56 : CEIL_Y,
              w: 36, h: 56,
              color: '#ffd166', phaseable: false
            });
          }
          // Spawn synth orbs
          const oy = CEIL_Y + 40 + Math.random() * (FLOOR_Y - CEIL_Y - 80);
          for (let k = 0; k < 3; k++) orbs.push({ x: W + 90 + k * 34, y: oy, r: 9 });
        }

        bossT -= dt;
        if (bossT <= 0) {
          bossT = 20;
          fxSys.text(W / 2, H / 2, '⚡ BOSS LASER SEQUENCE ⚡', '#ff2a85', 18);
          for (let i = 0; i < 4; i++) {
            const top = i % 2 === 0;
            obstacles.push({
              x: W + 120 + i * 220,
              y: top ? CEIL_Y : FLOOR_Y - 140,
              w: 26, h: 140,
              color: '#ff2a85', phaseable: true
            });
          }
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          o.x -= speed * dt;
          if (
            runner.x + runner.r - 4 > o.x &&
            runner.x - runner.r + 4 < o.x + o.w &&
            runner.y + runner.r - 4 > o.y &&
            runner.y - runner.r + 4 < o.y + o.h
          ) {
            if (runner.phaseTime > 0 && o.phaseable) {
              score += 120;
              fxSys.text(runner.x, runner.y - 24, 'PHASE +120!', '#a855f7', 13);
              obstacles.splice(i, 1);
              audio.playCoin();
              continue;
            } else {
              dead = true;
              audio.playGameOver();
              api.gameOver(Math.floor(score));
              api.addCredits(Math.floor(score / 120));
              api.addXP(Math.floor(score / 80));
              overTxt.textContent = `Score: ${Math.floor(score)} | Orbs: ${orbCount}`;
              overEl.classList.remove('hidden');
              break;
            }
          }
          if (o.x + o.w < -40) obstacles.splice(i, 1);
        }

        for (let i = orbs.length - 1; i >= 0; i--) {
          const orb = orbs[i];
          orb.x -= speed * dt;
          if (Math.hypot(orb.x - runner.x, orb.y - runner.y) < runner.r + orb.r) {
            orbCount++;
            score += Math.round(60 * mult);
            api.setScore(Math.floor(score));
            audio.playCoin();
            fxSys.burst(orb.x, orb.y, '#00f0ff', 7, 100);
            orbs.splice(i, 1);
            continue;
          }
          if (orb.x < -30) orbs.splice(i, 1);
        }

        fxSys.update(dt);
        spdEl.textContent = `SPEED: ${mult.toFixed(1)}x`;
        dashEl.textContent = runner.phaseCd > 0 ? `PHASE: ${runner.phaseCd.toFixed(1)}s` : 'PHASE DASH: READY';
        orbsEl.textContent = `ORBS: ${orbCount}`;
      }

      function draw() {
        ctx.fillStyle = '#070916';
        ctx.fillRect(0, 0, W, H);

        // Synthwave rails
        ctx.fillStyle = '#131d3a';
        ctx.fillRect(0, 0, W, CEIL_Y);
        ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, CEIL_Y); ctx.lineTo(W, CEIL_Y);
        ctx.moveTo(0, FLOOR_Y); ctx.lineTo(W, FLOOR_Y);
        ctx.stroke();

        // Orbs
        for (const orb of orbs) {
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2); ctx.fill();
        }

        // Obstacles
        for (const o of obstacles) {
          ctx.fillStyle = o.color;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          if (o.phaseable) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(o.x, o.y, o.w, o.h);
          }
        }

        // Runner
        ctx.save();
        if (runner.phaseTime > 0) ctx.globalAlpha = 0.5;
        ctx.fillStyle = runner.phaseTime > 0 ? '#a855f7' : '#2ee59d';
        ctx.beginPath();
        ctx.arc(runner.x, runner.y, runner.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

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
        window.removeEventListener('keydown', onKeyDown);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('contextmenu', onContext);
      };
    }
  });

  // =========================================================
  // GAME 14: SUIKA CYBER DROP (Physics Merge Chamber)
  // =========================================================
  window.Arcade.registerGame({
    id: 'suika-cyber',
    title: 'Suika Cyber Drop',
    category: 'Reflex & Rhythm',
    icon: '🔮',
    genre: 'Physics Merge Chamber',
    description: 'Drop 10 tiers of glowing cyber-cores into a physics chamber. Merge identical tiers to evolve bigger cores, Shake the box, or Laser Pop!',
    mechanics: ['Circle Physics & Gravity', '10 Core Evolution Tiers', 'Container Shake Ability', 'Laser Pop Ability'],
    controls: 'Aim: Move Mouse | Drop Core: Click (or Space) | Abilities: Shake & Laser Pop Buttons',
    stars: [1000, 3000, 7500],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="sk-next">NEXT: Tier 1</span>
          <button class="g-btn g-btn-gold" id="sk-shake">📦 Shake Box (READY)</button>
          <button class="g-btn g-btn-danger" id="sk-pop">🔫 Laser Pop (READY)</button>
        </div>
        <div style="position:relative;">
          <canvas id="sk-canvas" class="g-canvas" width="460" height="540"></canvas>
          <div id="sk-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">CHAMBER OVERFLOW</h3>
            <p id="sk-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="sk-retry">Empty Chamber</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#sk-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const TIERS = [
        { r: 14, color: '#94a3b8', label: '1' },
        { r: 19, color: '#38bdf8', label: '2' },
        { r: 24, color: '#2ee59d', label: '3' },
        { r: 30, color: '#a855f7', label: '4' },
        { r: 36, color: '#ffd166', label: '5' },
        { r: 43, color: '#f97316', label: '6' },
        { r: 50, color: '#ff2a85', label: '7' },
        { r: 58, color: '#ef4444', label: '8' },
        { r: 66, color: '#00f0ff', label: '9' },
        { r: 76, color: '#ffffff', label: 'X' }
      ];

      const nextEl = wrap.querySelector('#sk-next');
      const shakeBtn = wrap.querySelector('#sk-shake');
      const popBtn = wrap.querySelector('#sk-pop');
      const overEl = wrap.querySelector('#sk-over');
      const overTxt = wrap.querySelector('#sk-over-txt');

      const DANGER_Y = 90;
      let balls, aimX, curTier, nextTier, dropCd, shakeCd, popCd, popMode, score, dead, rafId, overflowTimer;

      function randDropTier() {
        return Math.floor(Math.random() * 4);
      }

      function initGame() {
        balls = [];
        aimX = W / 2;
        curTier = randDropTier();
        nextTier = randDropTier();
        dropCd = 0;
        shakeCd = 0;
        popCd = 0;
        popMode = false;
        score = 0;
        overflowTimer = 0;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function dropBall() {
        if (dead || dropCd > 0 || popMode || api.isPaused()) return;
        const r = TIERS[curTier].r;
        const x = Math.max(r + 12, Math.min(W - r - 12, aimX));
        balls.push({ x, y: 54, vx: (Math.random() - 0.5) * 14, vy: 20, tier: curTier, r, age: 0 });
        curTier = nextTier;
        nextTier = randDropTier();
        dropCd = 0.42;
        audio.playClick();
      }

      function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        aimX = ((e.clientX - rect.left) / rect.width) * W;
      }

      function onClick(e) {
        if (dead) return;
        if (popMode) {
          const rect = canvas.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          const my = ((e.clientY - rect.top) / rect.height) * H;
          for (let i = balls.length - 1; i >= 0; i--) {
            if (Math.hypot(balls[i].x - mx, balls[i].y - my) <= balls[i].r + 6) {
              fxSys.burst(balls[i].x, balls[i].y, TIERS[balls[i].tier].color, 18, 170);
              balls.splice(i, 1);
              popMode = false;
              popCd = 16;
              audio.playExplosion();
              return;
            }
          }
          return;
        }
        dropBall();
      }

      function onKeyDown(e) {
        if (e.code === 'Space' && !api.isPaused()) dropBall();
      }

      shakeBtn.onclick = () => {
        if (shakeCd > 0 || dead) return;
        shakeCd = 12;
        fxSys.shake(10, 0.3);
        balls.forEach(b => { b.vy -= 180; b.vx += (Math.random() - 0.5) * 260; });
        audio.playExplosion();
      };

      popBtn.onclick = () => {
        if (popCd > 0 || dead) return;
        popMode = !popMode;
      };

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click', onClick);
      window.addEventListener('keydown', onKeyDown);
      wrap.querySelector('#sk-retry').onclick = initGame;

      function update(dt) {
        if (dead || api.isPaused()) return;
        if (dropCd > 0) dropCd -= dt;
        if (shakeCd > 0) shakeCd = Math.max(0, shakeCd - dt);
        if (popCd > 0) popCd = Math.max(0, popCd - dt);

        const subSteps = 3;
        const sdt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
          for (const b of balls) {
            b.age += sdt;
            b.vy += 680 * sdt;
            b.x += b.vx * sdt;
            b.y += b.vy * sdt;
            b.vx *= 0.996;
            b.vy *= 0.996;

            if (b.x - b.r < 8) { b.x = 8 + b.r; b.vx = Math.abs(b.vx) * 0.45; }
            if (b.x + b.r > W - 8) { b.x = W - 8 - b.r; b.vx = -Math.abs(b.vx) * 0.45; }
            if (b.y + b.r > H - 8) { b.y = H - 8 - b.r; b.vy = -Math.abs(b.vy) * 0.35; b.vx *= 0.92; }
          }

          // Collisions & Merges
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i], b = balls[j];
              if (!a || !b || a._dead || b._dead) continue;
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.hypot(dx, dy);
              const minD = a.r + b.r;
              if (dist < minD) {
                if (a.tier === b.tier && a.tier < TIERS.length - 1) {
                  a._dead = true; b._dead = true;
                  const nt = a.tier + 1;
                  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                  balls.push({ x: mx, y: my, vx: 0, vy: -40, tier: nt, r: TIERS[nt].r, age: 0 });
                  const pts = (nt + 1) * 45;
                  score += pts;
                  api.setScore(score);
                  fxSys.burst(mx, my, TIERS[nt].color, 16, 150);
                  fxSys.text(mx, my, `+${pts}`, '#ffd166', 14);
                  audio.playCoin();
                } else {
                  const nx = dist > 0.001 ? dx / dist : 1;
                  const ny = dist > 0.001 ? dy / dist : 0;
                  const overlap = (minD - dist) * 0.5;
                  a.x -= nx * overlap; a.y -= ny * overlap;
                  b.x += nx * overlap; b.y += ny * overlap;

                  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
                  const velAlong = rvx * nx + rvy * ny;
                  if (velAlong < 0) {
                    const imp = -1.25 * velAlong * 0.5;
                    a.vx -= imp * nx; a.vy -= imp * ny;
                    b.vx += imp * nx; b.vy += imp * ny;
                  }
                }
              }
            }
          }
          balls = balls.filter(b => !b._dead);
        }

        const overflowing = balls.some(b => b.age > 1.3 && b.y - b.r < DANGER_Y);
        if (overflowing) {
          overflowTimer += dt;
          if (overflowTimer > 1.8) {
            dead = true;
            audio.playGameOver();
            api.gameOver(score);
            api.addCredits(Math.floor(score / 100));
            api.addXP(Math.floor(score / 65));
            overTxt.textContent = `Final Score: ${score}`;
            overEl.classList.remove('hidden');
          }
        } else {
          overflowTimer = Math.max(0, overflowTimer - dt * 2);
        }

        fxSys.update(dt);
        nextEl.textContent = `NEXT: Tier ${TIERS[nextTier].label}`;
        shakeBtn.textContent = shakeCd > 0 ? `📦 Shake (${shakeCd.toFixed(0)}s)` : '📦 Shake Box (READY)';
        popBtn.textContent = popMode ? '🔫 Click a Core!' : popCd > 0 ? `🔫 Pop (${popCd.toFixed(0)}s)` : '🔫 Laser Pop (READY)';
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = '#070b17';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        // Danger line
        ctx.strokeStyle = overflowTimer > 0 ? '#ff2a85' : 'rgba(255,42,133,0.4)';
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(8, DANGER_Y); ctx.lineTo(W - 8, DANGER_Y); ctx.stroke();
        ctx.setLineDash([]);

        // Chamber border
        ctx.strokeStyle = '#33487d';
        ctx.lineWidth = 6;
        ctx.strokeRect(5, 5, W - 10, H - 10);
        ctx.lineWidth = 1;

        // Drop guide
        if (!dead && !popMode) {
          const t = TIERS[curTier];
          const gx = Math.max(t.r + 12, Math.min(W - t.r - 12, aimX));
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.moveTo(gx, 54); ctx.lineTo(gx, H - 8); ctx.stroke();
          ctx.fillStyle = t.color;
          ctx.beginPath(); ctx.arc(gx, 46, t.r, 0, Math.PI * 2); ctx.fill();
        }

        for (const b of balls) {
          const t = TIERS[b.tier];
          ctx.fillStyle = t.color;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffffff44';
          ctx.stroke();
          ctx.fillStyle = '#070b17';
          ctx.font = `bold ${Math.max(11, Math.round(b.r * 0.55))}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(t.label, b.x, b.y + 5);
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
      return () => {
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  });

  // =========================================================
  // GAME 15: BLADE & FRUIT: KATANA BLITZ
  // =========================================================
  window.Arcade.registerGame({
    id: 'katana-blitz',
    title: 'Blade & Fruit: Katana Blitz',
    category: 'Reflex & Rhythm',
    icon: '⚔️',
    genre: 'Neon Katana Slasher',
    description: 'Slash launched cyber-fruits with a glowing katana trail! Hit 3+ fruits in one stroke for Critical Combos, trigger Freeze Slow-Mo, and dodge plasma bombs.',
    mechanics: ['Katana Trail Slicing', '3+ Single-Stroke Combos', 'Freeze Slow-Mo & Frenzy', 'Plasma Bombs'],
    controls: 'Hold Left Mouse & Swipe across Cyber-Fruits (or move cursor fast while holding button)',
    stars: [1000, 3000, 7000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="kb-lives">LIVES: 3</span>
          <span class="g-badge" id="kb-buff">BLADE: STANDARD</span>
          <span class="g-badge" id="kb-combo">BEST STROKE: 0</span>
        </div>
        <div style="position:relative;">
          <canvas id="kb-canvas" class="g-canvas" width="800" height="480"></canvas>
          <div id="kb-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">BLADE SHATTERED</h3>
            <p id="kb-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="kb-retry">Sharpen Katana</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#kb-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const livesEl = wrap.querySelector('#kb-lives');
      const buffEl = wrap.querySelector('#kb-buff');
      const comboEl = wrap.querySelector('#kb-combo');
      const overEl = wrap.querySelector('#kb-over');
      const overTxt = wrap.querySelector('#kb-over-txt');

      let targets, halves, trail, slicing, score, lives, freezeTime, frenzyTime, strokeHits, bestStroke, spawnT, dead, rafId;

      function initGame() {
        targets = [];
        halves = [];
        trail = [];
        slicing = false;
        score = 0;
        lives = 3 + api.getStartingShields();
        freezeTime = 0;
        frenzyTime = 0;
        strokeHits = 0;
        bestStroke = 0;
        spawnT = 0.5;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function spawnWave(count = 3) {
        for (let i = 0; i < count; i++) {
          const r = Math.random();
          let kind = 'fruit', color = ['#ff4d6d', '#2ee59d', '#ffd166', '#f97316'][Math.floor(Math.random() * 4)];
          if (r < 0.14) { kind = 'bomb'; color = '#ff2a85'; }
          else if (r < 0.22) { kind = 'freeze'; color = '#38bdf8'; }
          else if (r < 0.29) { kind = 'frenzy'; color = '#a855f7'; }

          const x = 100 + Math.random() * (W - 200);
          targets.push({
            x, y: H + 25,
            vx: (W / 2 - x) * (0.25 + Math.random() * 0.45),
            vy: -(480 + Math.random() * 160),
            r: kind === 'bomb' ? 22 : 24,
            kind, color, sliced: false
          });
        }
      }

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * W,
          y: ((e.clientY - rect.top) / rect.height) * H
        };
      }

      function onDown(e) {
        slicing = true;
        strokeHits = 0;
        const p = getPos(e);
        trail = [{ x: p.x, y: p.y, life: 0.16 }];
      }
      function onUp() {
        if (strokeHits >= 3) {
          const bonus = strokeHits * 75;
          score += bonus;
          api.setScore(score);
          fxSys.text(trail[trail.length - 1]?.x || W / 2, 120, `${strokeHits}x BLITZ COMBO +${bonus}!`, '#ffd166', 18);
          audio.playPowerup();
        }
        bestStroke = Math.max(bestStroke, strokeHits);
        slicing = false;
        strokeHits = 0;
      }
      function onMove(e) {
        if (!slicing || dead || api.isPaused()) return;
        const p = getPos(e);
        const prev = trail[trail.length - 1];
        trail.push({ x: p.x, y: p.y, life: 0.16 });
        if (!prev) return;

        // Check slice intersections
        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          if (t.sliced) continue;
          const d = Math.hypot(t.x - p.x, t.y - p.y);
          if (d < t.r + 12) {
            t.sliced = true;
            if (t.kind === 'bomb') {
              lives--;
              fxSys.shake(12, 0.3);
              fxSys.burst(t.x, t.y, '#ff2a85', 28, 260);
              audio.playExplosion();
              targets.splice(i, 1);
              if (lives <= 0) triggerDead();
              continue;
            }
            strokeHits++;
            if (t.kind === 'freeze') { freezeTime = 5; fxSys.text(t.x, t.y, 'FREEZE SLOW-MO!', '#38bdf8', 15); }
            else if (t.kind === 'frenzy') { frenzyTime = 5; fxSys.text(t.x, t.y, 'FRENZY WAVE!', '#a855f7', 15); }
            score += 40;
            api.setScore(score);
            audio.playLaser();
            fxSys.burst(t.x, t.y, t.color, 12, 150);
            halves.push({ x: t.x - 8, y: t.y, vx: t.vx - 70, vy: t.vy - 30, r: t.r, color: t.color, side: -1 });
            halves.push({ x: t.x + 8, y: t.y, vx: t.vx + 70, vy: t.vy - 30, r: t.r, color: t.color, side: 1 });
            targets.splice(i, 1);
          }
        }
      }

      function triggerDead() {
        dead = true;
        audio.playGameOver();
        api.gameOver(score);
        api.addCredits(Math.floor(score / 90));
        api.addXP(Math.floor(score / 60));
        overTxt.textContent = `Score: ${score} | Best Stroke Combo: ${bestStroke}x`;
        overEl.classList.remove('hidden');
      }

      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      canvas.addEventListener('mousemove', onMove);
      wrap.querySelector('#kb-retry').onclick = initGame;

      function update(rawDt) {
        if (dead || api.isPaused()) return;
        if (freezeTime > 0) freezeTime = Math.max(0, freezeTime - rawDt);
        if (frenzyTime > 0) frenzyTime = Math.max(0, frenzyTime - rawDt);

        const dt = rawDt * (freezeTime > 0 ? 0.45 : 1);
        spawnT -= rawDt;
        if (spawnT <= 0) {
          spawnWave(frenzyTime > 0 ? 5 : 2 + Math.floor(Math.random() * 3));
          spawnT = frenzyTime > 0 ? 0.75 : 1.75;
        }

        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          t.vy += 410 * dt;
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          if (t.y > H + 50 && t.vy > 0) {
            if (t.kind === 'fruit') {
              lives--;
              audio.playHit();
              if (lives <= 0) triggerDead();
            }
            targets.splice(i, 1);
          }
        }

        for (let i = halves.length - 1; i >= 0; i--) {
          const h = halves[i];
          h.vy += 480 * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          if (h.y > H + 50) halves.splice(i, 1);
        }

        for (let i = trail.length - 1; i >= 0; i--) {
          trail[i].life -= rawDt;
          if (trail[i].life <= 0) trail.splice(i, 1);
        }

        fxSys.update(rawDt);
        livesEl.textContent = `LIVES: ${Math.max(0, lives)}`;
        buffEl.textContent = freezeTime > 0 ? `FREEZE ${freezeTime.toFixed(1)}s` : frenzyTime > 0 ? `FRENZY ${frenzyTime.toFixed(1)}s` : 'BLADE: STANDARD';
        comboEl.textContent = `BEST STROKE: ${bestStroke}x`;
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = freezeTime > 0 ? '#071424' : '#080b16';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        for (const t of targets) {
          ctx.fillStyle = t.color;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffffff88';
          ctx.lineWidth = 2;
          ctx.stroke();
          if (t.kind === 'bomb') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('💣', t.x, t.y + 5);
          } else if (t.kind === 'freeze' || t.kind === 'frenzy') {
            ctx.fillStyle = '#050812';
            ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(t.kind.toUpperCase(), t.x, t.y + 4);
          }
        }

        for (const h of halves) {
          ctx.fillStyle = h.color;
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r, h.side < 0 ? Math.PI / 2 : -Math.PI / 2, h.side < 0 ? 1.5 * Math.PI : Math.PI / 2);
          ctx.fill();
        }

        if (trail.length > 1) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          trail.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.stroke();
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
      return () => {
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup', onUp);
        canvas.removeEventListener('mousemove', onMove);
      };
    }
  });

  // =========================================================
  // GAME 16: BEAT MATRIX (4-Lane Synth Rhythm Game)
  // =========================================================
  window.Arcade.registerGame({
    id: 'beat-matrix',
    title: 'Beat Matrix',
    category: 'Reflex & Rhythm',
    icon: '🎵',
    genre: '4-Lane Synth Rhythm Game',
    description: 'Hit falling synth notes across 4 lanes to live procedural Web Audio arpeggios. Rack up Perfect timings and unleash 8x Overdrive!',
    mechanics: ['Procedural Synth Audio', '3 Speed Tracks', 'Perfect/Great/Good Windows', '8x Overdrive Multiplier'],
    controls: 'Hit Lanes: Keys D, F, J, K (or Click Lanes at bottom) | Choose Track Speed & Start',
    stars: [1500, 4500, 10000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="bm-combo">COMBO: 0 (x1)</span>
          <span class="g-badge" id="bm-od">OVERDRIVE: 0%</span>
          <button class="g-btn g-btn-primary" data-bpm="110">Track 1 (110 BPM)</button>
          <button class="g-btn" data-bpm="140">Track 2 (140 BPM)</button>
          <button class="g-btn" data-bpm="175">Track 3 (175 BPM)</button>
        </div>
        <div style="position:relative;">
          <canvas id="bm-canvas" class="g-canvas" width="520" height="520"></canvas>
          <div id="bm-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#00f0ff;">TRACK COMPLETE!</h3>
            <p id="bm-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="bm-retry">Replay Track</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#bm-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const comboEl = wrap.querySelector('#bm-combo');
      const odEl = wrap.querySelector('#bm-od');
      const overEl = wrap.querySelector('#bm-over');
      const overTxt = wrap.querySelector('#bm-over-txt');

      const LANES = 4;
      const LANE_W = W / LANES;
      const HIT_Y = H - 72;
      const LANE_COLORS = ['#00f0ff', '#2ee59d', '#ffd166', '#ff2a85'];
      const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
      const LANE_LABELS = ['D', 'F', 'J', 'K'];
      const SCALE_FREQS = [261.63, 311.13, 392.0, 466.16, 523.25, 622.25];

      let bpm = 110, notes, laneFlash, combo, mult, overdrive, score, songTime, songLen, dead, rafId, nextBeatT, beatIdx;

      function startTrack(newBpm) {
        bpm = newBpm;
        notes = [];
        laneFlash = [0, 0, 0, 0];
        combo = 0;
        mult = 1;
        overdrive = 0;
        score = 0;
        songTime = 0;
        songLen = 45;
        nextBeatT = 0;
        beatIdx = 0;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function hitLane(lane) {
        if (dead || api.isPaused()) return;
        laneFlash[lane] = 0.14;
        let bestIdx = -1, bestDist = 56;
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (n.lane !== lane) continue;
          const d = Math.abs(n.y - HIT_Y);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          const n = notes.splice(bestIdx, 1)[0];
          const label = bestDist < 16 ? 'PERFECT' : bestDist < 34 ? 'GREAT' : 'GOOD';
          const base = bestDist < 16 ? 150 : bestDist < 34 ? 100 : 60;
          combo++;
          overdrive = Math.min(100, overdrive + (bestDist < 16 ? 8 : 5));
          mult = overdrive >= 100 ? 8 : Math.min(4, 1 + Math.floor(combo / 10));
          score += base * mult;
          api.setScore(score);
          audio.playNote(n.freq, 0.12, 'triangle', 0.08);
          fxSys.burst(lane * LANE_W + LANE_W / 2, HIT_Y, LANE_COLORS[lane], 10, 140);
          fxSys.text(lane * LANE_W + LANE_W / 2, HIT_Y - 26, `${label} x${mult}`, LANE_COLORS[lane], 13);
        } else {
          combo = 0;
          overdrive = Math.max(0, overdrive - 12);
          audio.playHit();
        }
      }

      function onKeyDown(e) {
        const lane = LANE_KEYS.indexOf(e.code);
        if (lane >= 0) hitLane(lane);
      }
      function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        const lane = Math.min(3, Math.max(0, Math.floor(x / LANE_W)));
        hitLane(lane);
      }

      wrap.querySelectorAll('[data-bpm]').forEach(btn => {
        btn.onclick = () => startTrack(Number(btn.dataset.bpm));
      });
      wrap.querySelector('#bm-retry').onclick = () => startTrack(bpm);
      window.addEventListener('keydown', onKeyDown);
      canvas.addEventListener('mousedown', onClick);

      function update(dt) {
        if (dead || api.isPaused()) return;
        songTime += dt;
        const beatInterval = 60 / bpm;

        if (songTime < songLen - 2 && songTime >= nextBeatT) {
          nextBeatT += beatInterval * 0.5;
          beatIdx++;
          const lane = (beatIdx * 3 + Math.floor(Math.random() * 2)) % 4;
          const freq = SCALE_FREQS[beatIdx % SCALE_FREQS.length];
          notes.push({ lane, y: -20, freq, speed: 240 + bpm * 1.1 });
          if (beatIdx % 4 === 0) audio.playNote(110, 0.08, 'sine', 0.04); // bass pulse
        }

        for (let i = 0; i < 4; i++) if (laneFlash[i] > 0) laneFlash[i] = Math.max(0, laneFlash[i] - dt);

        for (let i = notes.length - 1; i >= 0; i--) {
          const n = notes[i];
          n.y += n.speed * dt;
          if (n.y > HIT_Y + 52) {
            notes.splice(i, 1);
            combo = 0;
            overdrive = Math.max(0, overdrive - 15);
            fxSys.text(n.lane * LANE_W + LANE_W / 2, HIT_Y - 18, 'MISS', '#ff4d6d', 12);
          }
        }

        if (songTime >= songLen && notes.length === 0) {
          dead = true;
          api.gameOver(score);
          api.addCredits(Math.floor(score / 100));
          api.addXP(Math.floor(score / 70));
          audio.playPowerup();
          overTxt.textContent = `Score: ${score} | Track Speed: ${bpm} BPM`;
          overEl.classList.remove('hidden');
        }

        fxSys.update(dt);
        comboEl.textContent = `COMBO: ${combo} (x${mult})`;
        odEl.textContent = overdrive >= 100 ? 'OVERDRIVE 8x ACTIVE!' : `OVERDRIVE: ${overdrive}%`;
      }

      function draw() {
        ctx.fillStyle = '#060914';
        ctx.fillRect(0, 0, W, H);

        // Equalizer bars bg
        for (let i = 0; i < 16; i++) {
          const h = 30 + Math.abs(Math.sin(songTime * 5 + i)) * 90;
          ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
          ctx.fillRect(i * (W / 16) + 2, H - h, W / 16 - 4, h);
        }

        // Lanes
        for (let i = 0; i < LANES; i++) {
          if (laneFlash[i] > 0) {
            ctx.fillStyle = LANE_COLORS[i] + '33';
            ctx.fillRect(i * LANE_W, 0, LANE_W, H);
          }
          ctx.strokeStyle = '#1e2c52';
          ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();

          ctx.strokeStyle = LANE_COLORS[i];
          ctx.lineWidth = 3;
          ctx.strokeRect(i * LANE_W + 10, HIT_Y - 14, LANE_W - 20, 28);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
          ctx.fillText(LANE_LABELS[i], i * LANE_W + LANE_W / 2, HIT_Y + 34);
        }
        ctx.lineWidth = 1;

        for (const n of notes) {
          ctx.fillStyle = LANE_COLORS[n.lane];
          ctx.fillRect(n.lane * LANE_W + 14, n.y - 10, LANE_W - 28, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(n.lane * LANE_W + 22, n.y - 3, LANE_W - 44, 6);
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

      startTrack(110);
      rafId = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('keydown', onKeyDown);
        canvas.removeEventListener('mousedown', onClick);
      };
    }
  });
})();
