(function () {
  const SAVE_KEY = 'stealth_arcade_1337_v1';
  const DEFAULT_EQUATION = '((8^3-12)/5)*sqrt(169)+37';

  function defaultState() {
    return {
      credits: 100,
      xp: 0,
      level: 1,
      highScores: {},
      stars: {},
      favorites: [],
      upgrades: {
        coinMult: 0,
        startShield: 0,
        xpBoost: 0
      },
      unlockedSkins: ['classic'],
      activeSkin: 'classic',
      soundOn: true,
      customEquation: DEFAULT_EQUATION
    };
  }

  const state = defaultState();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(state, defaultState(), parsed);
        state.upgrades = Object.assign({ coinMult: 0, startShield: 0, xpBoost: 0 }, parsed.upgrades || {});
        if (!Array.isArray(state.favorites)) state.favorites = [];
        if (!Array.isArray(state.unlockedSkins)) state.unlockedSkins = ['classic'];
        if (!state.customEquation) state.customEquation = DEFAULT_EQUATION;
      }
    } catch (_) {
      // Ignore storage errors
    }
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (_) {
      // Ignore storage errors
    }
  }

  function resetSave() {
    Object.assign(state, defaultState());
    save();
  }

  function xpForNextLevel(lvl) {
    return 100 + (lvl - 1) * 75;
  }

  function addXP(amount) {
    const mult = 1 + (state.upgrades.xpBoost || 0) * 0.25;
    const gained = Math.max(1, Math.round(amount * mult));
    state.xp += gained;
    while (state.xp >= xpForNextLevel(state.level)) {
      state.xp -= xpForNextLevel(state.level);
      state.level += 1;
      state.credits += 50 * state.level;
    }
    save();
    return gained;
  }

  function getCreditMultiplier() {
    return 1 + (state.upgrades.coinMult || 0) * 0.25;
  }

  function addCredits(amount) {
    const gained = Math.max(0, Math.round(amount * getCreditMultiplier()));
    state.credits += gained;
    save();
    return gained;
  }

  function totalStars() {
    return Object.values(state.stars).reduce((sum, s) => sum + (Number(s) || 0), 0);
  }

  function computeStars(score, thresholds) {
    if (!Array.isArray(thresholds) || thresholds.length < 3) return 0;
    let s = 0;
    if (score >= thresholds[0]) s = 1;
    if (score >= thresholds[1]) s = 2;
    if (score >= thresholds[2]) s = 3;
    return s;
  }

  function reportScore(gameId, score, thresholds) {
    const prevBest = state.highScores[gameId] || 0;
    const cleanScore = Math.max(0, Math.floor(score));
    let isNewBest = false;
    if (cleanScore > prevBest) {
      state.highScores[gameId] = cleanScore;
      isNewBest = true;
    }
    const newStars = computeStars(cleanScore, thresholds);
    const prevStars = state.stars[gameId] || 0;
    if (newStars > prevStars) {
      state.stars[gameId] = newStars;
    }
    save();
    return { isNewBest, best: state.highScores[gameId] || 0, stars: state.stars[gameId] || 0 };
  }

  // =========================================================
  // WEB AUDIO SYNTHESIZER
  // =========================================================
  let audioCtx = null;

  function ensureAudio() {
    if (!state.soundOn) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playNote(freq = 440, duration = 0.08, type = 'sine', volume = 0.08) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch (_) {}
  }

  const audio = {
    playNote,
    playClick() { playNote(520, 0.035, 'triangle', 0.045); },
    playCoin() {
      playNote(988, 0.07, 'sine', 0.07);
      setTimeout(() => playNote(1319, 0.12, 'sine', 0.07), 55);
    },
    playLaser() {
      const ctx = ensureAudio();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(760, now);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } catch (_) {}
    },
    playExplosion() {
      const ctx = ensureAudio();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (_) {}
    },
    playPowerup() {
      [440, 554, 659, 880].forEach((f, i) => {
        setTimeout(() => playNote(f, 0.09, 'triangle', 0.07), i * 45);
      });
    },
    playHit() {
      playNote(135, 0.11, 'square', 0.08);
    },
    playUnlock() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        setTimeout(() => playNote(f, 0.16, 'triangle', 0.09), i * 70);
      });
    },
    playGameOver() {
      [392, 349, 311, 261].forEach((f, i) => {
        setTimeout(() => playNote(f, 0.18, 'sawtooth', 0.07), i * 110);
      });
    }
  };

  // =========================================================
  // SAFE MATH EXPRESSION PARSER & SECRET UNLOCK CHECKER
  // =========================================================
  function normalizeExpr(str) {
    return String(str || '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√\(/g, 'sqrt(')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function factorial(n) {
    if (!Number.isFinite(n) || n < 0 || n > 170) return NaN;
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) > 1e-9) return NaN;
    let res = 1;
    for (let i = 2; i <= rounded; i++) res *= i;
    return res;
  }

  function tokenize(expr) {
    const s = normalizeExpr(expr);
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        let num = '';
        let dots = 0;
        while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
          if (s[i] === '.') dots++;
          if (dots > 1) throw new Error('Invalid number');
          num += s[i++];
        }
        tokens.push({ type: 'num', val: parseFloat(num) });
        continue;
      }
      if (ch >= 'a' && ch <= 'z') {
        let id = '';
        while (i < s.length && s[i] >= 'a' && s[i] <= 'z') {
          id += s[i++];
        }
        tokens.push({ type: 'id', val: id });
        continue;
      }
      if ('+-*/^()!'.includes(ch)) {
        tokens.push({ type: 'op', val: ch });
        i++;
        continue;
      }
      throw new Error('Unexpected character: ' + ch);
    }

    // Insert implicit multiplication where appropriate
    const out = [];
    for (let k = 0; k < tokens.length; k++) {
      const cur = tokens[k];
      const prev = out[out.length - 1];
      if (prev) {
        const prevEndsVal =
          prev.type === 'num' ||
          (prev.type === 'op' && (prev.val === ')' || prev.val === '!')) ||
          (prev.type === 'id' && (prev.val === 'pi' || prev.val === 'e' || prev.val === 'ans'));
        const curStartsVal =
          cur.type === 'num' ||
          (cur.type === 'op' && cur.val === '(') ||
          cur.type === 'id';
        if (prevEndsVal && curStartsVal) {
          out.push({ type: 'op', val: '*' });
        }
      }
      out.push(cur);
    }
    return out;
  }

  function evaluate(expr, ansVal = 0) {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;
    let pos = 0;

    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function parseAddSub() {
      let left = parseMulDiv();
      while (peek() && peek().type === 'op' && (peek().val === '+' || peek().val === '-')) {
        const op = consume().val;
        const right = parseMulDiv();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseMulDiv() {
      let left = parseUnary();
      while (peek() && peek().type === 'op' && (peek().val === '*' || peek().val === '/')) {
        const op = consume().val;
        const right = parseUnary();
        if (op === '/') {
          if (right === 0) throw new Error('Division by zero');
          left = left / right;
        } else {
          left = left * right;
        }
      }
      return left;
    }

    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().val === '+' || peek().val === '-')) {
        const op = consume().val;
        const val = parseUnary();
        return op === '-' ? -val : val;
      }
      return parsePow();
    }

    function parsePow() {
      let base = parsePostfix();
      if (peek() && peek().type === 'op' && peek().val === '^') {
        consume();
        const exp = parseUnary();
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parsePostfix() {
      let val = parsePrimary();
      while (peek() && peek().type === 'op' && peek().val === '!') {
        consume();
        val = factorial(val);
      }
      return val;
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('Unexpected end of expression');
      if (tok.type === 'num') {
        consume();
        return tok.val;
      }
      if (tok.type === 'op' && tok.val === '(') {
        consume();
        const val = parseAddSub();
        if (!peek() || peek().type !== 'op' || peek().val !== ')') {
          throw new Error('Mismatched parenthesis');
        }
        consume();
        return val;
      }
      if (tok.type === 'id') {
        consume();
        const name = tok.val;
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (name === 'ans') return Number(ansVal) || 0;
        // Function call
        if (!peek() || peek().type !== 'op' || peek().val !== '(') {
          throw new Error('Expected ( after ' + name);
        }
        consume();
        const arg = parseAddSub();
        if (!peek() || peek().type !== 'op' || peek().val !== ')') {
          throw new Error('Missing ) after ' + name);
        }
        consume();
        const rad = (arg * Math.PI) / 180;
        switch (name) {
          case 'sin': return Math.sin(rad);
          case 'cos': return Math.cos(rad);
          case 'tan': return Math.tan(rad);
          case 'sqrt': return Math.sqrt(arg);
          case 'log': return Math.log10(arg);
          case 'ln': return Math.log(arg);
          case 'abs': return Math.abs(arg);
          case 'fact': return factorial(arg);
          default: throw new Error('Unknown function: ' + name);
        }
      }
      throw new Error('Syntax error');
    }

    const result = parseAddSub();
    if (pos < tokens.length) throw new Error('Unexpected token');
    if (!Number.isFinite(result)) throw new Error('Math Error');
    return result;
  }

  function countDistinctOperators(expr) {
    const s = normalizeExpr(expr);
    const ops = new Set();
    const opChars = ['+', '-', '*', '/', '^', '!', '('];
    for (const ch of opChars) {
      if (s.includes(ch)) ops.add(ch);
    }
    const funcs = ['sqrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'fact('];
    for (const fn of funcs) {
      if (s.includes(fn)) ops.add(fn);
    }
    return ops.size;
  }

  function checkUnlock(expr, value) {
    const normInput = normalizeExpr(expr);
    const normSecret = normalizeExpr(state.customEquation || DEFAULT_EQUATION);
    if (normInput && normInput === normSecret) {
      return true;
    }
    const distinctOps = countDistinctOperators(expr);
    if (distinctOps >= 3 && (Math.abs(value - 1337) < 1e-6 || Math.abs(value - 421337) < 1e-6)) {
      return true;
    }
    return false;
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return 'Error';
    if (Math.abs(n) < 1e-12) return '0';
    const rounded = Math.round(n * 1e10) / 1e10;
    if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-7)) {
      return rounded.toExponential(6);
    }
    return String(rounded);
  }

  // =========================================================
  // CANVAS & GAME FX HELPERS
  // =========================================================
  function createFX() {
    const particles = [];
    const floaters = [];
    let shakeTime = 0;
    let shakeMag = 0;

    return {
      burst(x, y, color = '#00f0ff', count = 12, speed = 150) {
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = (0.3 + Math.random() * 0.8) * speed;
          particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.35 + Math.random() * 0.3,
            maxLife: 0.65,
            size: 2 + Math.random() * 3,
            color
          });
        }
      },
      text(x, y, txt, color = '#ffd166', size = 14) {
        floaters.push({ x, y, txt, color, size, life: 0.85, maxLife: 0.85 });
      },
      shake(mag = 6, time = 0.16) {
        shakeMag = Math.max(shakeMag, mag);
        shakeTime = Math.max(shakeTime, time);
      },
      update(dt) {
        if (shakeTime > 0) {
          shakeTime = Math.max(0, shakeTime - dt);
          if (shakeTime === 0) shakeMag = 0;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.life -= dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = floaters.length - 1; i >= 0; i--) {
          const f = floaters[i];
          f.y -= 28 * dt;
          f.life -= dt;
          if (f.life <= 0) floaters.splice(i, 1);
        }
      },
      applyShake(ctx) {
        if (shakeTime > 0 && shakeMag > 0) {
          const dx = (Math.random() - 0.5) * 2 * shakeMag;
          const dy = (Math.random() - 0.5) * 2 * shakeMag;
          ctx.translate(dx, dy);
        }
      },
      draw(ctx) {
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const f of floaters) {
          ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
          ctx.fillStyle = f.color;
          ctx.font = `bold ${f.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(f.txt, f.x, f.y);
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  const shopItems = [
    {
      id: 'coinMult',
      type: 'upgrade',
      name: 'Credit Overclock (+25% CR)',
      desc: 'Increases Arcade Credits earned across all 20 games.',
      baseCost: 150,
      maxLevel: 5
    },
    {
      id: 'xpBoost',
      type: 'upgrade',
      name: 'XP Neural Amp (+25% XP)',
      desc: 'Level up faster and earn bonus level-up credit drops.',
      baseCost: 120,
      maxLevel: 5
    },
    {
      id: 'startShield',
      type: 'upgrade',
      name: 'Aegis Capacitor (+1 Shield)',
      desc: 'Grants extra starting armor/shields in Action & Rogue games.',
      baseCost: 220,
      maxLevel: 3
    },
    {
      id: 'skin_amber',
      type: 'skin',
      skinKey: 'amber',
      name: 'Amber Lab Calculator Skin',
      desc: 'Retro amber LCD screen disguise for the front calculator.',
      cost: 180
    },
    {
      id: 'skin_cyber',
      type: 'skin',
      skinKey: 'cyber',
      name: 'Cyber Indigo Calculator Skin',
      desc: 'Sleek dark OLED cyan disguise for the front calculator.',
      cost: 280
    },
    {
      id: 'skin_gold',
      type: 'skin',
      skinKey: 'gold',
      name: 'Executive Gold Calculator Skin',
      desc: 'Luxury brushed-brass bezel for high-rollers.',
      cost: 450
    }
  ];

  load();

  window.Arcade = {
    DEFAULT_EQUATION,
    games: [],
    state,
    shopItems,
    audio,
    fx: { createFX },
    calc: {
      evaluate,
      normalizeExpr,
      countDistinctOperators,
      checkUnlock,
      formatNumber
    },
    load,
    save,
    resetSave,
    addXP,
    addCredits,
    getCreditMultiplier,
    xpForNextLevel,
    totalStars,
    computeStars,
    reportScore,
    registerGame(game) {
      this.games.push(game);
    }
  };
})();
