(function () {
  const { audio, fx } = window.Arcade;

  // =========================================================
  // GAME 1: NEON SURVIVOR 1337 (Bullet Heaven Roguelite)
  // =========================================================
  window.Arcade.registerGame({
    id: 'neon-survivor',
    title: 'Neon Survivor 1337',
    category: 'Action',
    icon: '⚡',
    genre: 'Bullet Heaven Roguelite',
    description: 'Survive endless neon swarms. Collect XP gems, level up 6 stackable cyber-weapons, dash through danger, and slay 45s Bosses.',
    mechanics: ['WASD/Arrows + Dash', '6 Stackable Weapons', 'Bosses Every 45s', 'Level-Up Draft'],
    controls: 'Move: WASD / Arrow Keys | Dash (i-frames): Space | Aim Mode: Click / Toggle Auto-Aim',
    stars: [1500, 5000, 12000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="ns-hp">HP: 100/100</span>
          <span class="g-badge" id="ns-lvl">LVL 1 (0/10 XP)</span>
          <span class="g-badge" id="ns-time">TIME: 0:00</span>
          <button class="g-btn" id="ns-aim-btn">Aim: Auto</button>
          <span class="g-badge" id="ns-dash">Dash: READY</span>
        </div>
        <div style="position:relative;">
          <canvas id="ns-canvas" class="g-canvas" width="840" height="500"></canvas>
          <div id="ns-levelup" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 6px;color:#00f0ff;">SYSTEM UPGRADE AVAILABLE</h3>
            <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">Choose a weapon or passive module (Keys 1 / 2 / 3):</p>
            <div id="ns-choices" class="g-row" style="flex-direction:column;align-items:stretch;"></div>
          </div>
          <div id="ns-gameover" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">CORE OFFLINE</h3>
            <p id="ns-over-msg" style="margin:0 0 12px;font-size:14px;"></p>
            <button class="g-btn g-btn-primary" id="ns-retry">Reboot Simulation</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#ns-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const hpEl = wrap.querySelector('#ns-hp');
      const lvlEl = wrap.querySelector('#ns-lvl');
      const timeEl = wrap.querySelector('#ns-time');
      const dashEl = wrap.querySelector('#ns-dash');
      const aimBtn = wrap.querySelector('#ns-aim-btn');
      const lvlModal = wrap.querySelector('#ns-levelup');
      const choicesEl = wrap.querySelector('#ns-choices');
      const overModal = wrap.querySelector('#ns-gameover');
      const overMsg = wrap.querySelector('#ns-over-msg');

      const keys = {};
      const mouse = { x: W / 2, y: H / 2 };
      let autoAim = true;
      let choosingUpgrade = false;
      let dead = false;
      let rafId = 0;

      const UPGRADE_POOL = [
        { id: 'blades', name: 'Orbiting Blades', desc: 'Spinning plasma blades slice nearby foes (+1 blade & speed).' },
        { id: 'lightning', name: 'Chain Lightning', desc: 'Zaps closest enemy and arcs across nearby targets.' },
        { id: 'missiles', name: 'Homing Missiles', desc: 'Launches explosive seeker pods that track targets.' },
        { id: 'nova', name: 'Nova Pulse', desc: 'Periodic shockwave ring blasts and knocks back enemies.' },
        { id: 'crit', name: 'Crit Matrix', desc: '+15% crit chance and +35% all weapon damage.' },
        { id: 'vamp', name: 'Vampiric Drone', desc: 'Turret drone fires + heals 2 HP per 8 kills.' }
      ];

      let player, enemies, bullets, gems, lightnings, novaRings, elapsed, nextBossAt, score, spawnTimer, killCount;

      function initState() {
        const bonusShield = api.getStartingShields() * 20;
        player = {
          x: W / 2, y: H / 2, r: 13,
          hp: 100 + bonusShield, maxHp: 100 + bonusShield,
          speed: 215, lvl: 1, xp: 0, xpNext: 10,
          dashCd: 0, dashTime: 0, invuln: 0,
          dx: 1, dy: 0,
          mods: { blades: 1, lightning: 0, missiles: 0, nova: 0, crit: 0, vamp: 0 },
          timers: { pulse: 0, lightning: 0, missile: 0, nova: 0, drone: 0 }
        };
        enemies = [];
        bullets = [];
        gems = [];
        lightnings = [];
        novaRings = [];
        elapsed = 0;
        nextBossAt = 45;
        score = 0;
        spawnTimer = 0;
        killCount = 0;
        choosingUpgrade = false;
        dead = false;
        lvlModal.classList.add('hidden');
        overModal.classList.add('hidden');
        api.setScore(0);
      }

      aimBtn.addEventListener('click', () => {
        autoAim = !autoAim;
        aimBtn.textContent = autoAim ? 'Aim: Auto' : 'Aim: Mouse';
      });
      wrap.querySelector('#ns-retry').addEventListener('click', initState);

      function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * W;
        mouse.y = ((e.clientY - rect.top) / rect.height) * H;
      }

      function onKeyDown(e) {
        keys[e.code] = true;
        if (choosingUpgrade && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
          const idx = Number(e.code.replace('Digit', '')) - 1;
          const btn = choicesEl.children[idx];
          if (btn) btn.click();
        }
        if (e.code === 'Space' && !choosingUpgrade && !dead && !api.isPaused()) {
          triggerDash();
        }
      }
      function onKeyUp(e) { keys[e.code] = false; }

      canvas.addEventListener('mousemove', onMouseMove);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      function triggerDash() {
        if (player.dashCd > 0) return;
        let mx = 0, my = 0;
        if (keys.KeyW || keys.ArrowUp) my -= 1;
        if (keys.KeyS || keys.ArrowDown) my += 1;
        if (keys.KeyA || keys.ArrowLeft) mx -= 1;
        if (keys.KeyD || keys.ArrowRight) mx += 1;
        if (mx === 0 && my === 0) { mx = player.dx; my = player.dy; }
        const len = Math.hypot(mx, my) || 1;
        player.dx = mx / len;
        player.dy = my / len;
        player.dashTime = 0.16;
        player.invuln = 0.28;
        player.dashCd = 1.6;
        audio.playLaser();
        fxSys.burst(player.x, player.y, '#00f0ff', 14, 180);
      }

      function openLevelUp() {
        choosingUpgrade = true;
        const pool = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
        choicesEl.innerHTML = '';
        pool.forEach((u, idx) => {
          const curLvl = player.mods[u.id] || 0;
          const btn = document.createElement('button');
          btn.className = 'g-btn';
          btn.style.textAlign = 'left';
          btn.innerHTML = `<strong>[${idx + 1}] ${u.name} (Lv ${curLvl + 1})</strong><br><small style="color:#94a3b8">${u.desc}</small>`;
          btn.onclick = () => {
            player.mods[u.id] = curLvl + 1;
            player.hp = Math.min(player.maxHp, player.hp + 15);
            choosingUpgrade = false;
            lvlModal.classList.add('hidden');
            audio.playPowerup();
          };
          choicesEl.appendChild(btn);
        });
        lvlModal.classList.remove('hidden');
      }

      function spawnEnemy(isBoss = false) {
        const edge = Math.floor(Math.random() * 4);
        let x = 0, y = 0;
        if (edge === 0) { x = Math.random() * W; y = -24; }
        else if (edge === 1) { x = W + 24; y = Math.random() * H; }
        else if (edge === 2) { x = Math.random() * W; y = H + 24; }
        else { x = -24; y = Math.random() * H; }

        const scale = 1 + elapsed / 40;
        if (isBoss) {
          enemies.push({
            x, y, r: 26, boss: true,
            hp: Math.round(280 * scale), maxHp: Math.round(280 * scale),
            speed: 62 + Math.min(40, elapsed * 0.35),
            dmg: 22, color: '#ff2a85', xp: 25
          });
          fxSys.text(W / 2, 70, '⚠ DREADNOUGHT BOSS DETECTED ⚠', '#ff2a85', 18);
          audio.playExplosion();
          return;
        }
        const roll = Math.random();
        const fast = roll < 0.25;
        const tank = roll > 0.82;
        enemies.push({
          x, y,
          r: tank ? 16 : fast ? 9 : 12,
          boss: false,
          hp: Math.round((tank ? 48 : fast ? 14 : 24) * scale),
          maxHp: Math.round((tank ? 48 : fast ? 14 : 24) * scale),
          speed: tank ? 58 : fast ? 128 : 88,
          dmg: tank ? 16 : 10,
          color: tank ? '#a855f7' : fast ? '#ffd166' : '#ff4d6d',
          xp: tank ? 4 : fast ? 2 : 1
        });
      }

      function damageEnemy(e, rawDmg) {
        const mult = 1 + player.mods.crit * 0.35;
        const isCrit = Math.random() < (0.1 + player.mods.crit * 0.15);
        const dmg = Math.round(rawDmg * mult * (isCrit ? 2 : 1));
        e.hp -= dmg;
        if (isCrit) fxSys.text(e.x, e.y - 12, dmg + '!', '#ffd166', 13);
        if (e.hp <= 0) {
          killCount++;
          const pts = e.boss ? 500 : e.xp * 25;
          score += pts;
          api.setScore(score);
          gems.push({ x: e.x, y: e.y, val: e.xp, gold: e.boss });
          fxSys.burst(e.x, e.y, e.color, e.boss ? 28 : 8, e.boss ? 240 : 120);
          if (e.boss) {
            api.addCredits(35);
            audio.playExplosion();
            fxSys.shake(10, 0.3);
          }
          if (player.mods.vamp > 0 && killCount % 8 === 0) {
            player.hp = Math.min(player.maxHp, player.hp + 2 * player.mods.vamp);
          }
          return true;
        }
        return false;
      }

      function nearestEnemy(fromX, fromY, maxDist = Infinity) {
        let best = null, bestD = maxDist * maxDist;
        for (const e of enemies) {
          const d2 = (e.x - fromX) ** 2 + (e.y - fromY) ** 2;
          if (d2 < bestD) { bestD = d2; best = e; }
        }
        return best;
      }

      function update(dt) {
        if (dead || choosingUpgrade || api.isPaused()) return;

        elapsed += dt;
        if (elapsed >= nextBossAt) {
          spawnEnemy(true);
          nextBossAt += 45;
        }

        const spawnRate = Math.max(0.22, 1.05 - elapsed * 0.008);
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnEnemy(false);
          spawnTimer = spawnRate;
        }

        // Player movement
        player.dashCd = Math.max(0, player.dashCd - dt);
        player.invuln = Math.max(0, player.invuln - dt);
        if (player.dashTime > 0) {
          player.dashTime -= dt;
          player.x += player.dx * 640 * dt;
          player.y += player.dy * 640 * dt;
        } else {
          let mx = 0, my = 0;
          if (keys.KeyW || keys.ArrowUp) my -= 1;
          if (keys.KeyS || keys.ArrowDown) my += 1;
          if (keys.KeyA || keys.ArrowLeft) mx -= 1;
          if (keys.KeyD || keys.ArrowRight) mx += 1;
          if (mx !== 0 || my !== 0) {
            const l = Math.hypot(mx, my);
            player.dx = mx / l;
            player.dy = my / l;
            player.x += player.dx * player.speed * dt;
            player.y += player.dy * player.speed * dt;
          }
        }
        player.x = Math.max(16, Math.min(W - 16, player.x));
        player.y = Math.max(16, Math.min(H - 16, player.y));

        // Base Pulse Rifle
        player.timers.pulse -= dt;
        if (player.timers.pulse <= 0) {
          player.timers.pulse = 0.42;
          let ang = Math.atan2(mouse.y - player.y, mouse.x - player.x);
          if (autoAim) {
            const target = nearestEnemy(player.x, player.y);
            if (target) ang = Math.atan2(target.y - player.y, target.x - player.x);
          }
          bullets.push({
            x: player.x, y: player.y,
            vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
            r: 4, dmg: 16, life: 1.5, color: '#00f0ff', homing: false
          });
        }

        // Chain Lightning
        if (player.mods.lightning > 0) {
          player.timers.lightning -= dt;
          if (player.timers.lightning <= 0 && enemies.length > 0) {
            player.timers.lightning = Math.max(0.7, 1.8 - player.mods.lightning * 0.18);
            const first = nearestEnemy(player.x, player.y, 260);
            if (first) {
              const chain = [first];
              let cur = first;
              const maxArcs = 2 + player.mods.lightning;
              for (let i = 1; i < maxArcs; i++) {
                let next = null, bd = 140 * 140;
                for (const e of enemies) {
                  if (chain.includes(e)) continue;
                  const d2 = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
                  if (d2 < bd) { bd = d2; next = e; }
                }
                if (next) { chain.push(next); cur = next; } else break;
              }
              const pts = [{ x: player.x, y: player.y }, ...chain.map(c => ({ x: c.x, y: c.y }))];
              lightnings.push({ pts, life: 0.18 });
              chain.forEach(c => damageEnemy(c, 18 + player.mods.lightning * 6));
              audio.playLaser();
            }
          }
        }

        // Homing Missiles
        if (player.mods.missiles > 0) {
          player.timers.missile -= dt;
          if (player.timers.missile <= 0 && enemies.length > 0) {
            player.timers.missile = Math.max(0.9, 2.2 - player.mods.missiles * 0.22);
            const count = 1 + Math.floor(player.mods.missiles / 2);
            for (let i = 0; i < count; i++) {
              const ang = Math.random() * Math.PI * 2;
              bullets.push({
                x: player.x, y: player.y,
                vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
                r: 6, dmg: 26 + player.mods.missiles * 7, life: 2.8,
                color: '#ffd166', homing: true, splash: 42
              });
            }
          }
        }

        // Nova Pulse
        if (player.mods.nova > 0) {
          player.timers.nova -= dt;
          if (player.timers.nova <= 0) {
            player.timers.nova = Math.max(1.5, 3.6 - player.mods.nova * 0.35);
            const maxR = 95 + player.mods.nova * 22;
            novaRings.push({ x: player.x, y: player.y, r: 10, maxR, life: 0.35 });
            for (const e of enemies) {
              const d = Math.hypot(e.x - player.x, e.y - player.y);
              if (d < maxR) {
                damageEnemy(e, 20 + player.mods.nova * 8);
                if (d > 1) {
                  e.x += ((e.x - player.x) / d) * 35;
                  e.y += ((e.y - player.y) / d) * 35;
                }
              }
            }
          }
        }

        // Vampiric Drone
        if (player.mods.vamp > 0) {
          player.timers.drone -= dt;
          if (player.timers.drone <= 0) {
            player.timers.drone = Math.max(0.28, 0.7 - player.mods.vamp * 0.08);
            const dx = player.x + Math.cos(elapsed * 2.5) * 36;
            const dy = player.y + Math.sin(elapsed * 2.5) * 36;
            const t = nearestEnemy(dx, dy, 300);
            if (t) {
              const ang = Math.atan2(t.y - dy, t.x - dx);
              bullets.push({
                x: dx, y: dy, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
                r: 3.5, dmg: 12 + player.mods.vamp * 4, life: 1.0, color: '#2ee59d'
              });
            }
          }
        }

        // Orbiting Blades collision
        const bladeCount = player.mods.blades;
        const bladeRadius = 56;
        const bladeSpeed = 3.2 + bladeCount * 0.35;
        for (let b = 0; b < bladeCount; b++) {
          const ang = elapsed * bladeSpeed + (b * Math.PI * 2) / bladeCount;
          const bx = player.x + Math.cos(ang) * bladeRadius;
          const by = player.y + Math.sin(ang) * bladeRadius;
          for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (Math.hypot(e.x - bx, e.y - by) < e.r + 10) {
              if (!e._bladeCd || e._bladeCd <= 0) {
                e._bladeCd = 0.25;
                damageEnemy(e, 14 + bladeCount * 3);
              }
            }
          }
        }

        // Bullets update
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.life -= dt;
          if (b.homing) {
            const t = nearestEnemy(b.x, b.y);
            if (t) {
              const ta = Math.atan2(t.y - b.y, t.x - b.x);
              const spd = Math.hypot(b.vx, b.vy);
              b.vx = b.vx * 0.88 + Math.cos(ta) * spd * 0.12;
              b.vy = b.vy * 0.88 + Math.sin(ta) * spd * 0.12;
            }
          }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          let hit = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
              if (b.splash) {
                fxSys.burst(b.x, b.y, '#ffd166', 12, 160);
                for (const other of enemies) {
                  if (Math.hypot(other.x - b.x, other.y - b.y) <= b.splash) {
                    damageEnemy(other, b.dmg);
                  }
                }
              } else {
                damageEnemy(e, b.dmg);
              }
              hit = true;
              break;
            }
          }
          if (hit || b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) {
            bullets.splice(i, 1);
          }
        }

        // Enemies update & cleanup dead
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (e.hp <= 0) {
            enemies.splice(i, 1);
            continue;
          }
          if (e._bladeCd > 0) e._bladeCd -= dt;
          const ang = Math.atan2(player.y - e.y, player.x - e.x);
          e.x += Math.cos(ang) * e.speed * dt;
          e.y += Math.sin(ang) * e.speed * dt;
          if (player.invuln <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r) {
            player.hp -= e.dmg;
            player.invuln = 0.5;
            fxSys.shake(7, 0.18);
            audio.playHit();
            if (player.hp <= 0) {
              player.hp = 0;
              dead = true;
              api.gameOver(score);
              api.addCredits(Math.floor(score / 120));
              api.addXP(Math.floor(score / 80));
              overMsg.textContent = `Final Score: ${score} | Survived: ${Math.floor(elapsed)}s | Kills: ${killCount}`;
              overModal.classList.remove('hidden');
            }
          }
        }

        // Collect XP gems
        for (let i = gems.length - 1; i >= 0; i--) {
          const g = gems[i];
          const d = Math.hypot(player.x - g.x, player.y - g.y);
          if (d < 85) {
            g.x += ((player.x - g.x) / (d || 1)) * 310 * dt;
            g.y += ((player.y - g.y) / (d || 1)) * 310 * dt;
          }
          if (d < player.r + 8) {
            player.xp += g.val;
            score += g.gold ? 100 : 10;
            api.setScore(score);
            audio.playCoin();
            gems.splice(i, 1);
            if (player.xp >= player.xpNext) {
              player.xp -= player.xpNext;
              player.lvl++;
              player.xpNext = Math.round(player.xpNext * 1.38 + 4);
              openLevelUp();
              break;
            }
          }
        }

        lightnings.forEach(l => l.life -= dt);
        lightnings = lightnings.filter(l => l.life > 0);
        novaRings.forEach(n => { n.life -= dt; n.r += (n.maxR / 0.35) * dt; });
        novaRings = novaRings.filter(n => n.life > 0);
        fxSys.update(dt);

        // HUD updates
        hpEl.textContent = `HP: ${Math.ceil(player.hp)}/${player.maxHp}`;
        lvlEl.textContent = `LVL ${player.lvl} (${player.xp}/${player.xpNext} XP)`;
        const mins = Math.floor(elapsed / 60);
        const secs = String(Math.floor(elapsed % 60)).padStart(2, '0');
        timeEl.textContent = `TIME: ${mins}:${secs}`;
        dashEl.textContent = player.dashCd > 0 ? `Dash: ${player.dashCd.toFixed(1)}s` : 'Dash: READY';
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = '#070b17';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        // Grid background
        ctx.strokeStyle = 'rgba(0,240,255,0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 40) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Nova rings
        for (const n of novaRings) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${n.life / 0.35})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Gems
        for (const g of gems) {
          ctx.fillStyle = g.gold ? '#ffd166' : '#2ee59d';
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.gold ? 7 : 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bullets
        for (const b of bullets) {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Lightning arcs
        for (const l of lightnings) {
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          l.pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }

        // Enemies
        for (const e of enemies) {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.fill();
          if (e.boss) {
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#111827';
            ctx.fillRect(e.x - 24, e.y - e.r - 10, 48, 5);
            ctx.fillStyle = '#ff2a85';
            ctx.fillRect(e.x - 24, e.y - e.r - 10, 48 * Math.max(0, e.hp / e.maxHp), 5);
          }
        }

        // Orbiting blades
        const bladeCount = player.mods.blades;
        const bladeSpeed = 3.2 + bladeCount * 0.35;
        for (let b = 0; b < bladeCount; b++) {
          const ang = elapsed * bladeSpeed + (b * Math.PI * 2) / bladeCount;
          const bx = player.x + Math.cos(ang) * 56;
          const by = player.y + Math.sin(ang) * 56;
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Vampiric Drone
        if (player.mods.vamp > 0) {
          const dx = player.x + Math.cos(elapsed * 2.5) * 36;
          const dy = player.y + Math.sin(elapsed * 2.5) * 36;
          ctx.fillStyle = '#2ee59d';
          ctx.fillRect(dx - 5, dy - 5, 10, 10);
        }

        // Player
        ctx.fillStyle = player.invuln > 0 ? '#ffffff' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

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

      initState();
      rafId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }
  });

  // =========================================================
  // GAME 2: VOID BREAKER (Roguelite Brick & Boss Breaker)
  // =========================================================
  window.Arcade.registerGame({
    id: 'void-breaker',
    title: 'Void Breaker',
    category: 'Action',
    icon: '🧱',
    genre: 'Roguelite Brick & Boss Breaker',
    description: 'Smash armored matrices & firing Boss Bricks with multi-ball, explosive bricks, laser turrets, and between-wave upgrades.',
    mechanics: ['Multi-Ball & Laser Turrets', 'Boss Bricks Fire Back', 'Between-Wave Upgrades', 'Magnet & Pierce'],
    controls: 'Move Paddle: Mouse or Left/Right Arrows | Launch / Fire Lasers: Click or Space',
    stars: [1200, 3500, 8000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="vb-wave">WAVE 1</span>
          <span class="g-badge" id="vb-lives">LIVES: 3</span>
          <span class="g-badge" id="vb-perks">Perks: Standard</span>
        </div>
        <div style="position:relative;">
          <canvas id="vb-canvas" class="g-canvas" width="800" height="500"></canvas>
          <div id="vb-shop" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#00f0ff;">WAVE CLEARED! CHOOSE MODULE</h3>
            <div id="vb-upgrades" class="g-row" style="flex-direction:column;align-items:stretch;"></div>
          </div>
          <div id="vb-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">PADDLE DESTROYED</h3>
            <p id="vb-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="vb-retry">Play Again</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#vb-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const waveEl = wrap.querySelector('#vb-wave');
      const livesEl = wrap.querySelector('#vb-lives');
      const perksEl = wrap.querySelector('#vb-perks');
      const shopEl = wrap.querySelector('#vb-shop');
      const upgEl = wrap.querySelector('#vb-upgrades');
      const overEl = wrap.querySelector('#vb-over');
      const overTxt = wrap.querySelector('#vb-over-txt');

      const keys = {};
      let rafId = 0;
      let paddle, balls, bricks, capsules, lasers, enemyShots, wave, lives, score, gameOver, choosing;
      let mods;

      const MOD_DEFS = [
        { key: 'wide', name: 'Wide Shield (+24px)', desc: 'Permanently widens your paddle.' },
        { key: 'pierce', name: 'Fireball Pierce', desc: 'Balls tear through weak bricks without bouncing.' },
        { key: 'laser', name: 'Dual Laser Turrets', desc: 'Space/Click fires twin plasma bolts upward.' },
        { key: 'magnet', name: 'Magnet Catch', desc: 'Catch balls cleanly on Space/Click release.' },
        { key: 'split', name: 'Quantum Multi-Ball', desc: 'Immediately spawns +2 extra balls next wave.' }
      ];

      function spawnWave(wNum) {
        bricks = [];
        const rows = Math.min(7, 4 + Math.floor(wNum / 2));
        const cols = 10;
        const bw = 68, bh = 22, gap = 6;
        const offX = (W - (cols * (bw + gap) - gap)) / 2;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = offX + c * (bw + gap);
            const y = 48 + r * (bh + gap);
            const roll = Math.random();
            let type = 'normal', hp = 1 + Math.floor(wNum / 4), color = '#00f0ff';
            if (roll < 0.14) { type = 'boom'; hp = 1; color = '#ffd166'; }
            else if (roll < 0.34) { type = 'armor'; hp = 2 + Math.floor(wNum / 2); color = '#a855f7'; }
            else if (wNum % 2 === 0 && r === 0 && (c === 3 || c === 6)) {
              type = 'boss'; hp = 4 + wNum; color = '#ff2a85';
            }
            bricks.push({ x, y, w: bw, h: bh, hp, maxHp: hp, type, color, fireCd: 1.5 + Math.random() * 2.5 });
          }
        }
        resetBalls(mods.split ? 3 : 1);
      }

      function resetBalls(count = 1) {
        balls = [];
        for (let i = 0; i < count; i++) {
          balls.push({
            x: paddle.x + (i - (count - 1) / 2) * 16,
            y: paddle.y - 14,
            vx: (i % 2 === 0 ? 1 : -1) * (160 + i * 35),
            vy: -310,
            r: 7,
            stuck: i === 0
          });
        }
      }

      function initGame() {
        wave = 1;
        lives = 3 + api.getStartingShields();
        score = 0;
        gameOver = false;
        choosing = false;
        mods = { wide: 0, pierce: false, laser: false, magnet: false, split: false, laserCd: 0 };
        paddle = { x: W / 2, y: H - 28, w: 112, h: 14 };
        capsules = [];
        lasers = [];
        enemyShots = [];
        overEl.classList.add('hidden');
        shopEl.classList.add('hidden');
        api.setScore(0);
        spawnWave(1);
      }

      function releaseStuckOrFire() {
        let released = false;
        for (const b of balls) {
          if (b.stuck) {
            b.stuck = false;
            b.vy = -330;
            released = true;
          }
        }
        if (!released && mods.laser && mods.laserCd <= 0) {
          mods.laserCd = 0.28;
          lasers.push({ x: paddle.x - paddle.w * 0.4, y: paddle.y - 8, vy: -520 });
          lasers.push({ x: paddle.x + paddle.w * 0.4, y: paddle.y - 8, vy: -520 });
          audio.playLaser();
        }
      }

      function openWaveShop() {
        choosing = true;
        const choices = [...MOD_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);
        upgEl.innerHTML = '';
        choices.forEach(m => {
          const btn = document.createElement('button');
          btn.className = 'g-btn';
          btn.innerHTML = `<strong>${m.name}</strong><br><small style="color:#94a3b8">${m.desc}</small>`;
          btn.onclick = () => {
            if (m.key === 'wide') { mods.wide++; paddle.w += 24; }
            else mods[m.key] = true;
            choosing = false;
            shopEl.classList.add('hidden');
            wave++;
            api.addCredits(20);
            spawnWave(wave);
            audio.playPowerup();
          };
          upgEl.appendChild(btn);
        });
        shopEl.classList.remove('hidden');
      }

      function hitBrick(b, idx, fromExplosion = false) {
        b.hp--;
        score += 40;
        api.setScore(score);
        if (b.hp <= 0) {
          bricks.splice(idx, 1);
          fxSys.burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 10, 140);
          score += b.type === 'boss' ? 250 : 60;
          api.setScore(score);
          audio.playCoin();
          if (b.type === 'boom' && !fromExplosion) {
            fxSys.shake(6, 0.16);
            audio.playExplosion();
            for (let j = bricks.length - 1; j >= 0; j--) {
              const ob = bricks[j];
              if (Math.hypot((ob.x + ob.w / 2) - (b.x + b.w / 2), (ob.y + ob.h / 2) - (b.y + b.h / 2)) < 110) {
                hitBrick(ob, j, true);
              }
            }
          } else if (Math.random() < 0.22) {
            const kinds = ['MULTI', 'WIDE', 'LASER', 'LIFE'];
            capsules.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vy: 135, kind: kinds[Math.floor(Math.random() * kinds.length)] });
          }
        } else {
          audio.playClick();
        }
      }

      function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * W;
        paddle.x = Math.max(paddle.w / 2 + 6, Math.min(W - paddle.w / 2 - 6, mx));
      }
      function onClick() { if (!gameOver && !choosing) releaseStuckOrFire(); }
      function onKeyDown(e) {
        keys[e.code] = true;
        if (e.code === 'Space' && !gameOver && !choosing && !api.isPaused()) releaseStuckOrFire();
      }
      function onKeyUp(e) { keys[e.code] = false; }

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click', onClick);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      wrap.querySelector('#vb-retry').addEventListener('click', initGame);

      function update(dt) {
        if (gameOver || choosing || api.isPaused()) return;
        if (mods.laserCd > 0) mods.laserCd -= dt;

        if (keys.ArrowLeft || keys.KeyA) paddle.x -= 460 * dt;
        if (keys.ArrowRight || keys.KeyD) paddle.x += 460 * dt;
        paddle.x = Math.max(paddle.w / 2 + 6, Math.min(W - paddle.w / 2 - 6, paddle.x));

        // Boss brick shooting
        for (const br of bricks) {
          if (br.type === 'boss') {
            br.fireCd -= dt;
            if (br.fireCd <= 0) {
              br.fireCd = 2.6;
              enemyShots.push({ x: br.x + br.w / 2, y: br.y + br.h, vy: 210 });
            }
          }
        }

        // Balls
        for (let i = balls.length - 1; i >= 0; i--) {
          const ball = balls[i];
          if (ball.stuck) {
            ball.x = paddle.x;
            ball.y = paddle.y - paddle.h / 2 - ball.r - 1;
            continue;
          }
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
          if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
          if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

          // Paddle hit
          if (
            ball.vy > 0 &&
            ball.y + ball.r >= paddle.y - paddle.h / 2 &&
            ball.y - ball.r <= paddle.y + paddle.h / 2 &&
            ball.x >= paddle.x - paddle.w / 2 - 4 &&
            ball.x <= paddle.x + paddle.w / 2 + 4
          ) {
            const offset = (ball.x - paddle.x) / (paddle.w / 2);
            const speed = Math.min(540, Math.hypot(ball.vx, ball.vy) * 1.015);
            const ang = offset * (Math.PI / 3);
            ball.vx = Math.sin(ang) * speed;
            ball.vy = -Math.cos(ang) * speed;
            ball.y = paddle.y - paddle.h / 2 - ball.r - 1;
            if (mods.magnet) ball.stuck = true;
            audio.playClick();
          }

          // Brick hit
          for (let j = bricks.length - 1; j >= 0; j--) {
            const br = bricks[j];
            if (
              ball.x + ball.r > br.x &&
              ball.x - ball.r < br.x + br.w &&
              ball.y + ball.r > br.y &&
              ball.y - ball.r < br.y + br.h
            ) {
              const prevHp = br.hp;
              hitBrick(br, j);
              if (!mods.pierce || prevHp > 1) {
                const overlapX = Math.min(ball.x + ball.r - br.x, br.x + br.w - (ball.x - ball.r));
                const overlapY = Math.min(ball.y + ball.r - br.y, br.y + br.h - (ball.y - ball.r));
                if (overlapX < overlapY) ball.vx = -ball.vx;
                else ball.vy = -ball.vy;
              }
              break;
            }
          }

          if (ball.y - ball.r > H) {
            balls.splice(i, 1);
          }
        }

        if (balls.length === 0) {
          lives--;
          audio.playHit();
          fxSys.shake(8, 0.22);
          if (lives <= 0) {
            gameOver = true;
            api.gameOver(score);
            api.addCredits(Math.floor(score / 100));
            api.addXP(Math.floor(score / 60));
            overTxt.textContent = `Score: ${score} | Reached Wave ${wave}`;
            overEl.classList.remove('hidden');
          } else {
            resetBalls(1);
          }
        }

        // Lasers
        for (let i = lasers.length - 1; i >= 0; i--) {
          const l = lasers[i];
          l.y += l.vy * dt;
          let hit = false;
          for (let j = bricks.length - 1; j >= 0; j--) {
            const br = bricks[j];
            if (l.x > br.x && l.x < br.x + br.w && l.y > br.y && l.y < br.y + br.h) {
              hitBrick(br, j);
              hit = true;
              break;
            }
          }
          if (hit || l.y < 0) lasers.splice(i, 1);
        }

        // Enemy shots
        for (let i = enemyShots.length - 1; i >= 0; i--) {
          const s = enemyShots[i];
          s.y += s.vy * dt;
          if (
            s.y >= paddle.y - paddle.h / 2 &&
            s.y <= paddle.y + paddle.h / 2 &&
            Math.abs(s.x - paddle.x) < paddle.w / 2
          ) {
            enemyShots.splice(i, 1);
            lives--;
            audio.playHit();
            fxSys.shake(8, 0.2);
            if (lives <= 0) {
              gameOver = true;
              api.gameOver(score);
              overTxt.textContent = `Score: ${score} | Reached Wave ${wave}`;
              overEl.classList.remove('hidden');
            }
            continue;
          }
          if (s.y > H) enemyShots.splice(i, 1);
        }

        // Capsules
        for (let i = capsules.length - 1; i >= 0; i--) {
          const c = capsules[i];
          c.y += c.vy * dt;
          if (
            c.y + 10 >= paddle.y - paddle.h / 2 &&
            c.y - 10 <= paddle.y + paddle.h / 2 &&
            Math.abs(c.x - paddle.x) < paddle.w / 2 + 10
          ) {
            audio.playPowerup();
            if (c.kind === 'MULTI' && balls.length > 0) {
              const b0 = balls[0];
              balls.push({ x: b0.x, y: b0.y, vx: 210, vy: -290, r: 7, stuck: false });
              balls.push({ x: b0.x, y: b0.y, vx: -210, vy: -290, r: 7, stuck: false });
            } else if (c.kind === 'WIDE') {
              paddle.w = Math.min(220, paddle.w + 22);
            } else if (c.kind === 'LASER') {
              mods.laser = true;
            } else if (c.kind === 'LIFE') {
              lives++;
            }
            fxSys.text(paddle.x, paddle.y - 24, `+${c.kind}!`, '#2ee59d', 14);
            capsules.splice(i, 1);
            continue;
          }
          if (c.y > H) capsules.splice(i, 1);
        }

        if (bricks.length === 0 && !choosing && !gameOver) {
          openWaveShop();
        }

        fxSys.update(dt);
        waveEl.textContent = `WAVE ${wave}`;
        livesEl.textContent = `LIVES: ${lives}`;
        const activePerks = [
          mods.pierce && 'Pierce',
          mods.laser && 'Lasers',
          mods.magnet && 'Magnet',
          mods.split && 'Multi'
        ].filter(Boolean);
        perksEl.textContent = 'Perks: ' + (activePerks.length ? activePerks.join(', ') : 'Standard');
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = '#070b17';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        for (const br of bricks) {
          ctx.fillStyle = br.color;
          ctx.globalAlpha = 0.45 + 0.55 * (br.hp / br.maxHp);
          ctx.fillRect(br.x, br.y, br.w, br.h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#ffffff44';
          ctx.strokeRect(br.x, br.y, br.w, br.h);
          if (br.type === 'boss') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS ' + br.hp, br.x + br.w / 2, br.y + 15);
          } else if (br.type === 'boom') {
            ctx.fillStyle = '#111';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TNT', br.x + br.w / 2, br.y + 15);
          }
        }

        // Capsules
        for (const c of capsules) {
          ctx.fillStyle = '#2ee59d';
          ctx.fillRect(c.x - 18, c.y - 8, 36, 16);
          ctx.fillStyle = '#06130f';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(c.kind, c.x, c.y + 3);
        }

        // Lasers & enemy shots
        ctx.fillStyle = '#00f0ff';
        for (const l of lasers) ctx.fillRect(l.x - 2, l.y - 10, 4, 14);
        ctx.fillStyle = '#ff4d6d';
        for (const s of enemyShots) {
          ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
        }

        // Paddle
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h);
        if (mods.laser) {
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(paddle.x - paddle.w * 0.42, paddle.y - 14, 5, 8);
          ctx.fillRect(paddle.x + paddle.w * 0.42 - 5, paddle.y - 14, 5, 8);
        }

        // Balls
        for (const b of balls) {
          ctx.fillStyle = mods.pierce ? '#ffd166' : '#ffffff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
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
        window.removeEventListener('keyup', onKeyUp);
      };
    }
  });

  // =========================================================
  // GAME 3: CYBER SERPENT OVERDRIVE (Snake + AI Rivals + Trails)
  // =========================================================
  window.Arcade.registerGame({
    id: 'cyber-serpent',
    title: 'Cyber Serpent Overdrive',
    category: 'Action',
    icon: '🐍',
    genre: 'Action Snake + AI Rivals',
    description: 'Steer through warp portals, burn tail segments to leave lethal boost trails, cut off Rival AI snakes for mega-loot, and chain combo apples.',
    mechanics: ['AI Rival Snakes', 'Boost Burn Light Trails', 'Warp Portals', 'Gold / Ghost / Slow Apples'],
    controls: 'Steer: WASD / Arrows | Overdrive Boost: Hold Space or Shift',
    stars: [800, 2200, 5000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="cs-len">LENGTH: 6</span>
          <span class="g-badge" id="cs-combo">COMBO: x1</span>
          <span class="g-badge" id="cs-buff">STATUS: NORMAL</span>
        </div>
        <div style="position:relative;">
          <canvas id="cs-canvas" class="g-canvas" width="760" height="480"></canvas>
          <div id="cs-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">SERPENT DEREZZED</h3>
            <p id="cs-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="cs-retry">Re-Enter Grid</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#cs-canvas');
      const ctx = canvas.getContext('2d');
      const CELL = 20;
      const COLS = canvas.width / CELL;
      const ROWS = canvas.height / CELL;

      const lenEl = wrap.querySelector('#cs-len');
      const comboEl = wrap.querySelector('#cs-combo');
      const buffEl = wrap.querySelector('#cs-buff');
      const overEl = wrap.querySelector('#cs-over');
      const overTxt = wrap.querySelector('#cs-over-txt');

      const keys = {};
      let rafId = 0;
      let snake, dir, nextDir, rivals, foods, trails, portals, combo, comboTimer, ghostTime, slowTime, score, dead, stepTimer;

      function spawnFood(kind = 'normal') {
        const x = Math.floor(Math.random() * COLS);
        const y = Math.floor(Math.random() * ROWS);
        foods.push({ x, y, kind });
      }

      function spawnRival() {
        const y = 3 + Math.floor(Math.random() * (ROWS - 6));
        const segments = [];
        for (let i = 0; i < 6; i++) segments.push({ x: COLS - 3 - i, y });
        rivals.push({ body: segments, dx: -1, dy: 0, color: '#ff2a85', respawn: 0 });
      }

      function initGame() {
        snake = [];
        for (let i = 0; i < 6; i++) snake.push({ x: 8 - i, y: 12 });
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        rivals = [];
        spawnRival();
        spawnRival();
        foods = [];
        for (let i = 0; i < 4; i++) spawnFood('normal');
        spawnFood('gold');
        trails = [];
        portals = [
          { ax: 4, ay: 4, bx: COLS - 5, by: ROWS - 5, color: '#00f0ff' },
          { ax: COLS - 5, ay: 4, bx: 4, by: ROWS - 5, color: '#ffd166' }
        ];
        combo = 1;
        comboTimer = 0;
        ghostTime = 0;
        slowTime = 0;
        score = 0;
        dead = false;
        stepTimer = 0;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function onKeyDown(e) {
        keys[e.code] = true;
        if ((e.code === 'ArrowUp' || e.code === 'KeyW') && dir.y === 0) nextDir = { x: 0, y: -1 };
        else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && dir.y === 0) nextDir = { x: 0, y: 1 };
        else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && dir.x === 0) nextDir = { x: -1, y: 0 };
        else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && dir.x === 0) nextDir = { x: 1, y: 0 };
      }
      function onKeyUp(e) { keys[e.code] = false; }

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      wrap.querySelector('#cs-retry').addEventListener('click', initGame);

      function applyPortals(head) {
        for (const p of portals) {
          if (head.x === p.ax && head.y === p.ay) {
            head.x = p.bx; head.y = p.by;
            audio.playLaser();
            return;
          }
          if (head.x === p.bx && head.y === p.by) {
            head.x = p.ax; head.y = p.ay;
            audio.playLaser();
            return;
          }
        }
      }

      function step() {
        const boosting = (keys.Space || keys.ShiftLeft || keys.ShiftRight) && snake.length > 4;
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // Wrap walls in Ghost mode, otherwise die on wall
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
          if (ghostTime > 0) {
            head.x = (head.x + COLS) % COLS;
            head.y = (head.y + ROWS) % ROWS;
          } else {
            return triggerDeath();
          }
        }

        applyPortals(head);

        // Self collision
        if (ghostTime <= 0 && snake.some(seg => seg.x === head.x && seg.y === head.y)) {
          return triggerDeath();
        }
        // Rival body collision
        if (ghostTime <= 0 && rivals.some(r => r.body.some(seg => seg.x === head.x && seg.y === head.y))) {
          return triggerDeath();
        }

        snake.unshift(head);
        let grew = false;

        for (let i = foods.length - 1; i >= 0; i--) {
          const f = foods[i];
          if (f.x === head.x && f.y === head.y) {
            grew = true;
            combo = Math.min(10, combo + 1);
            comboTimer = 5.0;
            let pts = 50 * combo;
            if (f.kind === 'gold') { pts = 250 * combo; api.addCredits(5); }
            else if (f.kind === 'ghost') { ghostTime = 6; }
            else if (f.kind === 'slow') { slowTime = 6; }
            score += pts;
            api.setScore(score);
            audio.playCoin();
            foods.splice(i, 1);
            const r = Math.random();
            spawnFood(r < 0.16 ? 'gold' : r < 0.25 ? 'ghost' : r < 0.33 ? 'slow' : 'normal');
            break;
          }
        }

        if (!grew) {
          const tail = snake.pop();
          if (boosting && Math.random() < 0.45 && snake.length > 4) {
            const burned = snake.pop();
            trails.push({ x: burned.x, y: burned.y, life: 4.5 });
          } else if (boosting) {
            trails.push({ x: tail.x, y: tail.y, life: 3.5 });
          }
        }

        // Move AI Rivals
        for (let ri = rivals.length - 1; ri >= 0; ri--) {
          const r = rivals[ri];
          if (r.respawn > 0) continue;
          const rh = r.body[0];
          const target = foods[0] || { x: COLS / 2, y: ROWS / 2 };
          const candidates = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
          ].filter(c => !(c.dx === -r.dx && c.dy === -r.dy));

          let bestMove = candidates[0], bestScore = Infinity;
          for (const c of candidates) {
            const nx = rh.x + c.dx, ny = rh.y + c.dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            if (snake.some(s => s.x === nx && s.y === ny)) continue;
            if (trails.some(t => t.x === nx && t.y === ny)) continue;
            const d = Math.abs(nx - target.x) + Math.abs(ny - target.y);
            if (d < bestScore) { bestScore = d; bestMove = c; }
          }
          r.dx = bestMove.dx; r.dy = bestMove.dy;
          const nh = { x: rh.x + r.dx, y: rh.y + r.dy };
          const hitPlayerOrTrail =
            nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS ||
            snake.some(s => s.x === nh.x && s.y === nh.y) ||
            trails.some(t => t.x === nh.x && t.y === nh.y);

          if (hitPlayerOrTrail) {
            // Rival drops mega-loot!
            r.body.forEach((seg, idx) => {
              if (idx % 2 === 0) foods.push({ x: seg.x, y: seg.y, kind: 'gold' });
            });
            score += 400 * combo;
            api.setScore(score);
            api.addCredits(10);
            audio.playExplosion();
            rivals.splice(ri, 1);
            setTimeout(() => { if (!dead) spawnRival(); }, 3500);
            continue;
          }
          r.body.unshift(nh);
          const ate = foods.findIndex(f => f.x === nh.x && f.y === nh.y);
          if (ate >= 0) {
            foods.splice(ate, 1);
            spawnFood('normal');
          } else {
            r.body.pop();
          }
        }
      }

      function triggerDeath() {
        dead = true;
        audio.playGameOver();
        api.gameOver(score);
        api.addCredits(Math.floor(score / 80));
        api.addXP(Math.floor(score / 50));
        overTxt.textContent = `Score: ${score} | Max Length: ${snake.length}`;
        overEl.classList.remove('hidden');
      }

      function update(dt) {
        if (dead || api.isPaused()) return;
        if (comboTimer > 0) {
          comboTimer -= dt;
          if (comboTimer <= 0) combo = 1;
        }
        if (ghostTime > 0) ghostTime = Math.max(0, ghostTime - dt);
        if (slowTime > 0) slowTime = Math.max(0, slowTime - dt);
        for (let i = trails.length - 1; i >= 0; i--) {
          trails[i].life -= dt;
          if (trails[i].life <= 0) trails.splice(i, 1);
        }

        const boosting = (keys.Space || keys.ShiftLeft || keys.ShiftRight) && snake.length > 4;
        const interval = boosting ? 0.055 : slowTime > 0 ? 0.145 : 0.095;
        stepTimer += dt;
        if (stepTimer >= interval) {
          stepTimer = 0;
          step();
        }

        lenEl.textContent = `LENGTH: ${snake.length}`;
        comboEl.textContent = `COMBO: x${combo}`;
        const status = [ghostTime > 0 && `GHOST ${ghostTime.toFixed(1)}s`, slowTime > 0 && `SLOW ${slowTime.toFixed(1)}s`].filter(Boolean);
        buffEl.textContent = 'STATUS: ' + (status.length ? status.join(' | ') : 'NORMAL');
      }

      function draw() {
        ctx.fillStyle = '#070b17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        for (let x = 0; x <= canvas.width; x += CELL) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += CELL) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Portals
        for (const p of portals) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(p.ax * CELL + 2, p.ay * CELL + 2, CELL - 4, CELL - 4);
          ctx.strokeRect(p.bx * CELL + 2, p.by * CELL + 2, CELL - 4, CELL - 4);
        }

        // Trails
        for (const t of trails) {
          ctx.fillStyle = `rgba(0, 240, 255, ${Math.min(1, t.life / 2)})`;
          ctx.fillRect(t.x * CELL + 3, t.y * CELL + 3, CELL - 6, CELL - 6);
        }

        // Foods
        for (const f of foods) {
          ctx.fillStyle =
            f.kind === 'gold' ? '#ffd166' :
            f.kind === 'ghost' ? '#a855f7' :
            f.kind === 'slow' ? '#38bdf8' : '#2ee59d';
          ctx.beginPath();
          ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }

        // Rivals
        for (const r of rivals) {
          r.body.forEach((seg, idx) => {
            ctx.fillStyle = idx === 0 ? '#ff6ea8' : '#ff2a85';
            ctx.fillRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4);
          });
        }

        // Player Snake
        snake.forEach((seg, idx) => {
          ctx.globalAlpha = ghostTime > 0 ? 0.55 : 1;
          ctx.fillStyle = idx === 0 ? '#ffffff' : '#00f0ff';
          ctx.fillRect(seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3);
        });
        ctx.globalAlpha = 1;
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
        window.removeEventListener('keyup', onKeyUp);
      };
    }
  });

  // =========================================================
  // GAME 4: STARFALL VANGUARD (Bullet-Hell Vertical Shmup)
  // =========================================================
  window.Arcade.registerGame({
    id: 'starfall-vanguard',
    title: 'Starfall Vanguard',
    category: 'Action',
    icon: '🚀',
    genre: 'Bullet-Hell Vertical Shmup',
    description: 'Pilot an interceptor with 3 switchable weapons. Graze enemy bullets to charge Overdrive & drop EMP Screen Bombs against Dreadnought bosses.',
    mechanics: ['3 Switchable Weapons', 'Bullet Graze Meter', 'EMP Screen Bomb', 'Multi-Phase Bosses'],
    controls: 'Move: WASD / Arrows or Mouse | Weapons: 1 (Spread) / 2 (Laser) / 3 (Homing) | EMP Bomb: Space',
    stars: [2000, 6000, 14000],
    mount(container, api) {
      const wrap = document.createElement('div');
      wrap.className = 'g-wrap';
      wrap.innerHTML = `
        <div class="g-row">
          <span class="g-badge" id="sv-hp">HULL: 5</span>
          <span class="g-badge" id="sv-wep">WEAPON: [1] SPREAD</span>
          <span class="g-badge" id="sv-graze">OVERDRIVE: 0%</span>
          <span class="g-badge" id="sv-bombs">EMP BOMBS: 2</span>
        </div>
        <div style="position:relative;">
          <canvas id="sv-canvas" class="g-canvas" width="600" height="540"></canvas>
          <div id="sv-over" class="g-overlay-card hidden" style="position:absolute;inset:0;margin:auto;height:fit-content;">
            <h3 style="margin:0 0 8px;color:#ff4d6d;">INTERCEPTOR LOST</h3>
            <p id="sv-over-txt" style="margin:0 0 12px;"></p>
            <button class="g-btn g-btn-primary" id="sv-retry">Launch Sortie</button>
          </div>
        </div>
      `;
      container.appendChild(wrap);

      const canvas = wrap.querySelector('#sv-canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const fxSys = fx.createFX();

      const hpEl = wrap.querySelector('#sv-hp');
      const wepEl = wrap.querySelector('#sv-wep');
      const grazeEl = wrap.querySelector('#sv-graze');
      const bombsEl = wrap.querySelector('#sv-bombs');
      const overEl = wrap.querySelector('#sv-over');
      const overTxt = wrap.querySelector('#sv-over-txt');

      const keys = {};
      let rafId = 0;
      let ship, bullets, eBullets, enemies, starsBg, weaponMode, graze, overdrive, bombs, score, waveTimer, bossActive, dead;

      function initGame() {
        ship = { x: W / 2, y: H - 64, r: 6, invuln: 0, fireCd: 0 };
        bullets = [];
        eBullets = [];
        enemies = [];
        starsBg = Array.from({ length: 65 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2 }));
        weaponMode = 1;
        graze = 0;
        overdrive = 0;
        bombs = 2 + Math.min(2, api.getStartingShields());
        ship.hp = 5 + api.getStartingShields();
        score = 0;
        waveTimer = 0;
        bossActive = false;
        dead = false;
        overEl.classList.add('hidden');
        api.setScore(0);
      }

      function triggerEMP() {
        if (bombs <= 0 || dead) return;
        bombs--;
        eBullets = [];
        fxSys.shake(12, 0.35);
        fxSys.burst(ship.x, ship.y, '#00f0ff', 36, 320);
        audio.playExplosion();
        for (let i = enemies.length - 1; i >= 0; i--) {
          enemies[i].hp -= 60;
          if (enemies[i].hp <= 0) {
            score += enemies[i].boss ? 1200 : 120;
            fxSys.burst(enemies[i].x, enemies[i].y, '#ffd166', 14, 150);
            enemies.splice(i, 1);
          }
        }
        api.setScore(score);
      }

      function onKeyDown(e) {
        keys[e.code] = true;
        if (e.code === 'Digit1') weaponMode = 1;
        if (e.code === 'Digit2') weaponMode = 2;
        if (e.code === 'Digit3') weaponMode = 3;
        if (e.code === 'Space' && !api.isPaused()) triggerEMP();
      }
      function onKeyUp(e) { keys[e.code] = false; }
      function onMouseMove(e) {
        if (e.buttons !== 1) return;
        const rect = canvas.getBoundingClientRect();
        ship.x = Math.max(20, Math.min(W - 20, ((e.clientX - rect.left) / rect.width) * W));
        ship.y = Math.max(40, Math.min(H - 20, ((e.clientY - rect.top) / rect.height) * H));
      }

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('mousemove', onMouseMove);
      wrap.querySelector('#sv-retry').addEventListener('click', initGame);

      function spawnWave(t) {
        if (!bossActive && Math.floor(t) > 0 && Math.floor(t) % 28 === 0) {
          bossActive = true;
          enemies.push({
            x: W / 2, y: -40, targetY: 85, w: 72, h: 36,
            hp: 420 + Math.floor(t * 8), maxHp: 420 + Math.floor(t * 8),
            boss: true, phase: 0, fireCd: 1.0, dir: 1
          });
          fxSys.text(W / 2, 160, 'DREADNOUGHT APPROACHING', '#ff2a85', 16);
          return;
        }
        if (bossActive) return;
        const kind = Math.random();
        enemies.push({
          x: 40 + Math.random() * (W - 80), y: -25,
          w: kind > 0.75 ? 36 : 24, h: 24,
          hp: kind > 0.75 ? 45 : 18, maxHp: kind > 0.75 ? 45 : 18,
          vy: kind > 0.75 ? 55 : 95,
          vx: (Math.random() - 0.5) * 60,
          fireCd: 0.7 + Math.random() * 1.2,
          boss: false
        });
      }

      let spawnAcc = 0;
      function update(dt) {
        if (dead || api.isPaused()) return;
        waveTimer += dt;
        spawnAcc += dt;
        if (spawnAcc > 0.85) {
          spawnAcc = 0;
          spawnWave(waveTimer);
        }

        starsBg.forEach(s => { s.y += s.s * 75 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

        // Ship move
        const spd = 280;
        if (keys.KeyW || keys.ArrowUp) ship.y -= spd * dt;
        if (keys.KeyS || keys.ArrowDown) ship.y += spd * dt;
        if (keys.KeyA || keys.ArrowLeft) ship.x -= spd * dt;
        if (keys.KeyD || keys.ArrowRight) ship.x += spd * dt;
        ship.x = Math.max(18, Math.min(W - 18, ship.x));
        ship.y = Math.max(30, Math.min(H - 18, ship.y));
        if (ship.invuln > 0) ship.invuln -= dt;
        if (overdrive > 0) overdrive -= dt;

        // Auto fire
        ship.fireCd -= dt;
        const rateBoost = overdrive > 0 ? 0.55 : 1;
        if (ship.fireCd <= 0) {
          if (weaponMode === 1) {
            ship.fireCd = 0.14 * rateBoost;
            [-0.22, 0, 0.22].forEach(ang => {
              bullets.push({ x: ship.x, y: ship.y - 12, vx: Math.sin(ang) * 460, vy: -Math.cos(ang) * 460, dmg: 10, color: '#00f0ff' });
            });
          } else if (weaponMode === 2) {
            ship.fireCd = 0.08 * rateBoost;
            bullets.push({ x: ship.x, y: ship.y - 14, vx: 0, vy: -640, dmg: 13, color: '#ff2a85', tall: true });
          } else {
            ship.fireCd = 0.22 * rateBoost;
            bullets.push({ x: ship.x - 10, y: ship.y - 10, vx: -70, vy: -360, dmg: 14, color: '#ffd166', homing: true });
            bullets.push({ x: ship.x + 10, y: ship.y - 10, vx: 70, vy: -360, dmg: 14, color: '#ffd166', homing: true });
          }
        }

        // Player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          if (b.homing && enemies.length > 0) {
            const t = enemies[0];
            const ang = Math.atan2(t.y - b.y, t.x - b.x);
            b.vx = b.vx * 0.9 + Math.cos(ang) * 420 * 0.1;
            b.vy = b.vy * 0.9 + Math.sin(ang) * 420 * 0.1;
          }
          b.x += b.vx * dt; b.y += b.vy * dt;
          let hit = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.abs(b.x - e.x) < e.w / 2 + 4 && Math.abs(b.y - e.y) < e.h / 2 + 6) {
              e.hp -= b.dmg * (overdrive > 0 ? 1.5 : 1);
              hit = true;
              if (e.hp <= 0) {
                score += (e.boss ? 2000 : 120) * (overdrive > 0 ? 2 : 1);
                api.setScore(score);
                fxSys.burst(e.x, e.y, e.boss ? '#ffd166' : '#ff4d6d', e.boss ? 34 : 10, 170);
                if (e.boss) {
                  bossActive = false;
                  bombs++;
                  api.addCredits(40);
                  audio.playExplosion();
                }
                enemies.splice(j, 1);
              }
              break;
            }
          }
          if (hit || b.y < -20 || b.x < -20 || b.x > W + 20) bullets.splice(i, 1);
        }

        // Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (e.boss) {
            if (e.y < e.targetY) e.y += 65 * dt;
            else {
              e.x += e.dir * 105 * dt;
              if (e.x < 60 || e.x > W - 60) e.dir *= -1;
            }
            e.fireCd -= dt;
            if (e.fireCd <= 0) {
              e.fireCd = e.hp < e.maxHp * 0.5 ? 0.55 : 0.9;
              const ringCount = e.hp < e.maxHp * 0.5 ? 12 : 8;
              const spin = waveTimer * 1.4;
              for (let k = 0; k < ringCount; k++) {
                const a = spin + (k * Math.PI * 2) / ringCount;
                eBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, r: 5 });
              }
            }
          } else {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            if (e.x < 20 || e.x > W - 20) e.vx *= -1;
            e.fireCd -= dt;
            if (e.fireCd <= 0) {
              e.fireCd = 1.6;
              const a = Math.atan2(ship.y - e.y, ship.x - e.x);
              eBullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, r: 4.5 });
            }
            if (e.y > H + 30) enemies.splice(i, 1);
          }
        }

        // Enemy bullets & Graze mechanic
        for (let i = eBullets.length - 1; i >= 0; i--) {
          const eb = eBullets[i];
          eb.x += eb.vx * dt; eb.y += eb.vy * dt;
          const d = Math.hypot(eb.x - ship.x, eb.y - ship.y);
          if (!eb.grazed && d < 28 && d > ship.r + eb.r) {
            eb.grazed = true;
            graze = Math.min(100, graze + 8);
            score += 35;
            api.setScore(score);
            fxSys.text(ship.x, ship.y - 18, 'GRAZE!', '#ffd166', 11);
            if (graze >= 100) {
              graze = 0;
              overdrive = 7;
              audio.playPowerup();
              fxSys.text(ship.x, ship.y - 34, 'OVERDRIVE 2X!', '#00f0ff', 15);
            }
          }
          if (ship.invuln <= 0 && d < ship.r + eb.r) {
            eBullets.splice(i, 1);
            ship.hp--;
            ship.invuln = 1.1;
            fxSys.shake(8, 0.25);
            audio.playHit();
            if (ship.hp <= 0) {
              dead = true;
              api.gameOver(score);
              api.addCredits(Math.floor(score / 120));
              api.addXP(Math.floor(score / 75));
              overTxt.textContent = `Final Score: ${score} | Survived: ${Math.floor(waveTimer)}s`;
              overEl.classList.remove('hidden');
            }
            continue;
          }
          if (eb.y > H + 20 || eb.y < -20 || eb.x < -20 || eb.x > W + 20) eBullets.splice(i, 1);
        }

        fxSys.update(dt);
        hpEl.textContent = `HULL: ${ship.hp}`;
        const wNames = { 1: '[1] SPREAD', 2: '[2] LASER', 3: '[3] HOMING' };
        wepEl.textContent = `WEAPON: ${wNames[weaponMode]}`;
        grazeEl.textContent = overdrive > 0 ? `OVERDRIVE: ${overdrive.toFixed(1)}s!` : `OVERDRIVE: ${graze}%`;
        bombsEl.textContent = `EMP BOMBS: ${bombs}`;
      }

      function draw() {
        ctx.save();
        ctx.fillStyle = '#050812';
        ctx.fillRect(0, 0, W, H);
        fxSys.applyShake(ctx);

        ctx.fillStyle = '#ffffff44';
        for (const s of starsBg) ctx.fillRect(s.x, s.y, s.s, s.s);

        for (const b of bullets) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x - 2, b.y - (b.tall ? 12 : 5), 4, b.tall ? 20 : 10);
        }

        for (const e of enemies) {
          ctx.fillStyle = e.boss ? '#ff2a85' : '#a855f7';
          ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
          if (e.boss) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(e.x - 45, e.y - e.h / 2 - 12, 90, 6);
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(e.x - 45, e.y - e.h / 2 - 12, 90 * Math.max(0, e.hp / e.maxHp), 6);
          }
        }

        for (const eb of eBullets) {
          ctx.fillStyle = eb.grazed ? '#ffd166' : '#ff4d6d';
          ctx.beginPath();
          ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Player Ship + Hitbox indicator
        if (ship.invuln <= 0 || Math.floor(waveTimer * 15) % 2 === 0) {
          ctx.fillStyle = overdrive > 0 ? '#ffd166' : '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(ship.x, ship.y - 16);
          ctx.lineTo(ship.x - 14, ship.y + 12);
          ctx.lineTo(ship.x + 14, ship.y + 12);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2);
          ctx.fill();
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
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('mousemove', onMouseMove);
      };
    }
  });
})();
