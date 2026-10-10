(() => {
  // ---------- settings ----------
  const PHOTO = "image0.jpeg"; // put your photo in the same folder; "" turns the Polaroids off
  const CAPTION = "exhibit A: cute"; // handwritten line on the first Polaroid, e.g. "us, forever ♥"
  const PHOTO2 = "image1.jpeg"; // second Polaroid next to the first; "" for just one
  const CAPTION2 = "exhibit B: still cute"; // handwritten line on the second Polaroid
  // letters on the back of each Polaroid: tap a photo to flip it over. "" = no letter on that card.
  // Use \n for a new line, e.g. "Dear Priya,\n\nThank you for every day.\n\nLove, T"
  const LETTER =
    "no big speech. i just wanted you to know how loved you are, and how you make my day better. anyways, i love you.";
  const LETTER2 = "ok that's all. smile for me 🫶";
  const NAME = ""; // used as the caption if CAPTION is empty; or open the page with #Name
  const OUTLINE_DELAY = 70; // ms between words while tracing the outline
  const FILL_DELAY = 45; // ms between words while filling the inside
  const MUSIC = ""; // your own song in the same folder, e.g. "song.mp3"; "" = built-in soft music
  const MUSIC_VOLUME = 0.55; // 0 to 1
  const HAPTICS = true; // phone vibrates with the heartbeat (Android; iPhones don't allow it)
  const HAPTIC_BEATS = 16; // how many beats to vibrate before stopping (0 = never stop)
  const WIDEN = 1.18; // >1 makes the heart wider
  const GRADIENT = ["#ffb3c6", "#ff4d6d", "#c9184a", "#8a0f2f"]; // word colours, top of the heart → bottom tip
  const COLORS = ["#ff4d6d", "#ff758f", "#c9184a"]; // floating hearts and the name's glow
  const GLOW = "#fff2f4";
  const FONT =
    'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", sans-serif';

  const PHRASES = [
    "I love you",
    "Seni seviyorum",
    "Te amo",
    "Je t'aime",
    "Ich liebe dich",
    "Ti amo",
    "Eu te amo",
    "Я тебя люблю",
    "사랑해",
    "愛してる",
    "我爱你",
    "मैं तुमसे प्यार करता हूँ",
    "Σ' αγαπώ",
    "Ik hou van jou",
    "Jag älskar dig",
    "Kocham cię",
    "ฉันรักเธอ",
    "Anh yêu em",
    "Aku cinta kamu",
    "Я тебе кохаю",
    "म तिमीलाई माया गर्छु",
  ];

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("heart");
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas"); // settled words live here, drawn once
  const lctx = layer.getContext("2d");
  const feel = document.getElementById("feel");
  const replay = document.getElementById("replay");
  const flash = document.getElementById("flash");
  const intro = document.getElementById("intro");
  const introFor = document.getElementById("intro-for");
  const soundBtn = document.getElementById("sound");
  const letterHint = document.getElementById("letter-hint");
  const cards = [
    {
      pol: document.querySelector(".pol-a"),
      flip: document.getElementById("flip-a"),
      text: document.getElementById("letter-a"),
      letter: LETTER,
    },
    {
      pol: document.querySelector(".pol-b"),
      flip: document.getElementById("flip-b"),
      text: document.getElementById("letter-b"),
      letter: LETTER2,
    },
  ];
  let letterSeen = false;

  const polaroid = document.getElementById("polaroid");
  const captionA = document.getElementById("caption-a");
  const captionB = document.getElementById("caption-b");

  // load (and decode, so a big camera photo doesn't stutter when it pops in) one photo;
  // resolves true if it worked, false if the file is missing
  function loadPhoto(img, src) {
    return new Promise((done) => {
      if (!src) return done(false);
      img.onload = () => {
        const ready = img.decode ? img.decode() : Promise.resolve();
        ready.catch(() => {}).then(() => done(true));
      };
      img.onerror = () => {
        console.warn(
          `Couldn't load "${src}". Check the file name and that it's in the same folder.`,
        );
        done(false);
      };
      img.src = src;
    });
  }

  // both photos load in the background while the heart builds; the reveal waits for them
  let photo = false;
  Promise.all([
    loadPhoto(document.getElementById("photo-a"), PHOTO),
    loadPhoto(document.getElementById("photo-b"), PHOTO2),
  ]).then(([a, b]) => {
    if (a && b) polaroid.classList.add("two");
    photo = a;
  });

  // ---------- helpers ----------
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, f) => {
    const A = rgb(a),
      B = rgb(b);
    f = Math.max(0, Math.min(1, f));
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(",")})`;
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const toHex = (c) =>
    "#" +
    c
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");

  // a word's colour comes from how far down the heart it sits, with a little
  // random brightness so neighbours aren't identical
  function colorAt(y) {
    const f =
      Math.min(0.9999, clamp01((y - yTop) / (yBot - yTop))) *
      (GRADIENT.length - 1);
    const i = Math.floor(f),
      A = rgb(GRADIENT[i]),
      B = rgb(GRADIENT[i + 1]);
    const shade = 1 + (Math.random() - 0.5) * 0.12;
    return toHex(A.map((v, k) => (v + (B[k] - v) * (f - i)) * shade));
  }
  const font = (px) => `700 ${px}px ${FONT}`;
  const widths = new Map();
  function measure(text, px) {
    const key = text + "|" + px;
    let w = widths.get(key);
    if (w === undefined) {
      ctx.font = font(px);
      w = ctx.measureText(text).width;
      widths.set(key, w);
    }
    return w;
  }
  function nameFromLink() {
    let h = "";
    try {
      h = decodeURIComponent(location.hash.slice(1));
    } catch (e) {}
    h = h.replace(/[_.~-]+/g, " ").trim();
    return h || NAME;
  }

  // ---------- layout ----------
  let W, H, dpr, S, cx, cy, halfW, outlinePts, rows, yTop, yBot;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // 2x is sharp on phones and much lighter than 3x
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    for (const c of [canvas, layer]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    for (const c of [ctx, lctx]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.textAlign = "center";
      c.textBaseline = "middle";
    }
    // heart spans x ±16·WIDEN, y from -17 to +12 in its own units
    S = Math.min((W * 0.93) / (32 * WIDEN), (H * 0.8) / 29.5);
    cx = W / 2;
    cy = H / 2 - 2.6 * S - H * 0.03;
    halfW = 16 * WIDEN * S;
    canvas.style.transformOrigin = `${cx}px ${cy + 2.6 * S}px`;

    outlinePts = [];
    for (let i = 0; i < 720; i++) {
      const a = (2 * Math.PI * i) / 720;
      const x = 16 * Math.sin(a) ** 3 * WIDEN;
      const y =
        13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a);
      outlinePts.push([cx + x * S, cy - y * S]);
    }

    // inside-the-heart x-ranges for every pixel row (fast "does this word fit?")
    const poly = outlinePts.filter((_, i) => i % 3 === 0);
    yTop = Math.min(...poly.map((p) => p[1]));
    yBot = Math.max(...poly.map((p) => p[1]));
    rows = [];
    for (let y = yTop; y <= yBot; y++) {
      const xs = [];
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i],
          [x2, y2] = poly[(i + 1) % poly.length];
        if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      const spans = [];
      for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
      rows.push(spans);
    }
  }

  const spanInside = (x0, x1, y) => {
    const r = rows[Math.floor(y - yTop)];
    return !!r && r.some(([a, b]) => a <= x0 && x1 <= b);
  };
  const boxInside = (x0, y0, x1, y1) =>
    spanInside(x0, x1, y0) &&
    spanInside(x0, x1, (y0 + y1) / 2) &&
    spanInside(x0, x1, y1);

  // ---------- state ----------
  let words,
    active,
    boxes,
    bag,
    phase,
    oi,
    queue,
    qi,
    nextAt,
    nameWord,
    waveOrder,
    waveI,
    waveAt,
    finaleAt,
    revealAt,
    flashDone,
    cardShown,
    burstDone,
    hearts,
    lastBeat,
    beatsFelt,
    instant = false,
    drawnStill = false,
    opened = false;
  // nothing runs until the intro is tapped
  phase = "idle";
  words = [];
  active = [];
  boxes = [];
  bag = [];
  hearts = [];

  // ---------- haptics ----------
  // phones only allow vibration after the person has touched the page
  // (laptops report vibrate() too but can't actually vibrate, so only touch screens count)
  const touchScreen = matchMedia("(pointer: coarse)").matches;
  const canVibrate =
    HAPTICS && touchScreen && typeof navigator.vibrate === "function";
  let touched = false;
  const activated = () =>
    touched ||
    !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  const stopVibration = () => {
    if (canVibrate) navigator.vibrate(0);
  };
  addEventListener("pointerdown", () => {
    touched = true;
    feel.classList.remove("show");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopVibration();
  });

  function nextPhrase() {
    if (!bag.length) {
      bag = PHRASES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag[bag.length - 1];
  }

  function tryPlace(x, y, sizes, onOutline, now) {
    const text = nextPhrase();
    const pad = Math.max(2, S * 0.14);
    for (const raw of sizes) {
      const px = Math.max(8, Math.round(raw));
      const w = measure(text, px);
      const h = px * 1.08;
      const x0c = onOutline ? x - (w / 2) * ((x - cx) / halfW) : x; // pull outline words inward
      const b = [x0c - w / 2 - pad, y - h / 2, x0c + w / 2 + pad, y + h / 2];
      if (!onOutline && !boxInside(...b)) continue;
      if (
        boxes.some(
          (o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3],
        )
      )
        continue;
      boxes.push(b);
      bag.pop();
      const word = {
        text,
        px,
        x: x0c,
        y,
        color: colorAt(y),
        t0: now,
        kind: "appear",
      };
      words.push(word);
      if (reduceMotion || instant) settle(word);
      else active.push(word);
      return true;
    }
    bag.unshift(bag.pop()); // didn't fit: a different phrase gets the next spot
    return false;
  }

  function buildQueue() {
    const step = Math.max(4, S * 0.28);
    const pts = [];
    for (let y = yTop; y < yTop + rows.length; y += step)
      for (let x = cx - halfW; x < cx + halfW; x += step)
        if (spanInside(x, x, y)) pts.push([x, y]);
    const passes = [
      [1.35, 1.2, 1.05, 0.92],
      [0.82, 0.74, 0.66],
      [0.58, 0.52, 0.46],
    ];
    const q = [];
    for (const p of passes) {
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      for (const [x, y] of pts) q.push([x, y, p.map((f) => f * S)]);
    }
    return q;
  }

  // a word that has finished its entrance is painted once onto the static layer,
  // with a faint permanent glow (cheap: it never redraws again)
  function settle(w) {
    lctx.font = font(w.px);
    lctx.shadowColor = w.color + "66";
    lctx.shadowBlur = w.px * 0.35;
    lctx.fillStyle = w.color;
    lctx.fillText(w.text, w.x, w.y);
    lctx.shadowBlur = 0;
  }

  // ---------- run ----------
  function start() {
    words = [];
    active = [];
    boxes = [];
    bag = [];
    phase = "outline";
    oi = 0;
    qi = 0;
    queue = null;
    waveOrder = null;
    waveI = 0;
    waveAt = 0;
    nameWord = null;
    revealAt = 0;
    flashDone = cardShown = burstDone = false;
    hearts = [];
    lctx.clearRect(0, 0, W, H);
    canvas.style.transform = "";
    polaroid.classList.remove("show");
    flash.classList.remove("go");
    feel.classList.remove("show");
    replay.classList.remove("show");
    letterHint.classList.remove("show");
    for (const c of cards) {
      c.flip.classList.remove("flipped");
      c.text.textContent = c.letter;
      c.pol.classList.toggle("has-letter", !!c.letter);
      if (c.letter) {
        c.flip.setAttribute("role", "button");
        c.flip.setAttribute("tabindex", "0");
        c.flip.setAttribute(
          "aria-label",
          "Turn the photo over to read the letter",
        );
      }
    }
    lastBeat = -1;
    beatsFelt = 0;
    drawnStill = false;
    stopVibration();
    delete document.body.dataset.stage;
    const now = performance.now();
    nextAt = now + 350;

    const name = nameFromLink();
    if (name) nameWord = { text: name, px: Math.max(15, Math.round(S * 1.25)) };
    // each caption sits in a span so CSS can "write" it in from left to right
    for (const [el, text] of [
      [captionA, CAPTION || name],
      [captionB, CAPTION2],
    ]) {
      el.innerHTML = "";
      const line = document.createElement("span");
      line.textContent = text;
      el.appendChild(line);
    }

    if (reduceMotion) {
      while (phase !== "done") build(now, true);
      finale(now);
      if (photo) showPolaroid(now);
    }
  }

  function build(now, all) {
    if (phase === "outline") {
      while (oi < outlinePts.length) {
        const [x, y] = outlinePts[oi];
        oi += 2;
        if (tryPlace(x, y, [S * (0.8 + Math.random() * 0.28)], true, now)) {
          oi += 3;
          nextAt = now + OUTLINE_DELAY;
          return;
        }
      }
      phase = "fill";
      queue = buildQueue();
      qi = 0;
      nextAt = now + 300;
    } else if (phase === "fill") {
      const deadline = performance.now() + 6; // never block a frame for long
      while (qi < queue.length) {
        const [x, y, sizes] = queue[qi++];
        if (tryPlace(x, y, sizes, false, now)) {
          nextAt = now + FILL_DELAY;
          return;
        }
        if (!all && performance.now() > deadline) return;
      }
      phase = "done";
      finaleAt = now + 700;
    }
  }

  function finale(now) {
    phase = "finale";
    waveOrder = words
      .slice()
      .sort(
        (a, b) =>
          Math.round(a.y / (S * 0.9)) - Math.round(b.y / (S * 0.9)) ||
          a.x - b.x,
      );
    waveI = 0;
    waveAt = now + 600;
    if (!photo) replay.classList.add("show");
    if (canVibrate && !activated()) feel.classList.add("show");
  }

  // ---------- the reveal ----------
  // 0 ms     the words fly into the centre
  // 950 ms   a flash, and the Polaroid pops out of it (CSS takes over the card from here)
  // 1900 ms  little hearts float up from the card
  // 2400 ms  the heart fades back in, faintly, behind it
  const T_FLASH = 950,
    T_HEARTS = 1900,
    T_HEART_BACK = 2400,
    T_REPLAY = 7600;

  function showPolaroid(now) {
    if (!reduceMotion) setTimeout(chime, T_FLASH - 150); // a soft chime as the photos pop out
    phase = "reveal";
    revealAt = reduceMotion ? now - 20000 : now;
    document.body.dataset.stage = "reveal";
    active = [];
    if (reduceMotion) {
      polaroid.classList.add("show");
      flashDone = cardShown = burstDone = true;
    }
  }

  const center = () => [W / 2, H * 0.48];

  function drawFlyingWords(t) {
    const [tx, ty] = center();
    for (const w of words) {
      const d = Math.hypot(w.x - tx, w.y - ty);
      const delay = (d / halfW) * 160; // outer words leave a little later
      const p = clamp01((t - delay) / 820);
      if (p >= 1) continue;
      const e = p * p * (2.2 - 1.2 * p); // starts moving right away, rushes in at the end
      const s = 1 - 0.65 * e;
      ctx.setTransform(
        dpr * s,
        0,
        0,
        dpr * s,
        dpr * (w.x + (tx - w.x) * e),
        dpr * (w.y + (ty - w.y) * e),
      );
      ctx.globalAlpha = 1 - Math.pow(p, 3);
      ctx.font = font(w.px);
      ctx.fillStyle = mix(w.color, GLOW, e);
      ctx.fillText(w.text, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnHearts() {
    const cards = [...polaroid.querySelectorAll(".polaroid-card")].filter(
      (c) => c.offsetParent,
    );
    for (let i = 0; i < 22; i++) {
      const card = cards[i % cards.length].getBoundingClientRect();
      const side = Math.random();
      const x = card.left + Math.random() * card.width;
      const y =
        side < 0.6
          ? card.top + Math.random() * card.height * 0.3
          : card.top + Math.random() * card.height;
      hearts.push({
        x: side < 0.6 ? x : Math.random() < 0.5 ? card.left : card.right,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: -(30 + Math.random() * 60),
        size: 5 + Math.random() * 9,
        spin: (Math.random() - 0.5) * 1.2,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1800 + Math.random() * 1400,
        born: performance.now() + Math.random() * 500,
      });
    }
  }

  function heartShape(size) {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(
      -size * 1.1,
      -size * 0.35,
      -size * 0.45,
      -size * 1.05,
      0,
      -size * 0.45,
    );
    ctx.bezierCurveTo(
      size * 0.45,
      -size * 1.05,
      size * 1.1,
      -size * 0.35,
      0,
      size * 0.35,
    );
    ctx.fill();
  }

  function drawHearts(now, dt) {
    hearts = hearts.filter((h) => now - h.born < h.life);
    for (const h of hearts) {
      const age = now - h.born;
      if (age < 0) continue;
      const k = dt / 1000;
      h.x += h.vx * k + Math.sin(age / 300) * 0.3;
      h.y += h.vy * k;
      h.vy *= 0.995;
      const p = age / h.life;
      ctx.setTransform(dpr, 0, 0, dpr, dpr * h.x, dpr * h.y);
      ctx.rotate(h.spin * p);
      ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      ctx.fillStyle = h.color;
      ctx.shadowColor = h.color;
      ctx.shadowBlur = h.size;
      heartShape(h.size * (0.6 + 0.4 * Math.min(1, p * 4)));
    }
    ctx.shadowBlur = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGlowing(w, glow, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = font(w.px);
    ctx.shadowColor = w.color;
    ctx.shadowBlur = glow * w.px * 0.9;
    ctx.fillStyle = mix(w.color, GLOW, glow * 0.85);
    ctx.fillText(w.text, w.x, w.y);
  }

  const bump = (t, s, d) =>
    t > s && t < s + d ? Math.sin((Math.PI * (t - s)) / d) : 0;

  let lastFrame = performance.now();

  function frame(now) {
    const dt = Math.min(50, now - lastFrame);
    lastFrame = now;
    if (phase === "idle") {
      requestAnimationFrame(frame);
      return;
    } // waiting on the intro
    if (phase === "outline" || phase === "fill") {
      if (now >= nextAt) build(now, false);
    } else if (phase === "done" && now >= finaleAt) finale(now);

    if (phase === "finale" && reduceMotion && photo) showPolaroid(now); // no animations: straight to the photo

    if (phase === "finale" && !reduceMotion && now >= waveAt) {
      // glow wave: light up the next word, top to bottom
      if (waveI < waveOrder.length) {
        const w = waveOrder[waveI++];
        active.push({ ...w, t0: now, kind: "wave" });
        waveAt = now + 40;
      } else if (photo) {
        showPolaroid(now); // after one full wave, the photo
      } else {
        waveI = 0;
        waveAt = now + 1400; // no photo: keep the wave looping
      }
    }

    if ((phase === "finale" || phase === "reveal") && !reduceMotion) {
      // heartbeat on the GPU: scale the whole canvas, no redraw needed
      const t = (now - finaleAt) % 1300;
      const beat = bump(t, 0, 180) + 0.7 * bump(t, 230, 200);
      canvas.style.transform = `scale(${1 + 0.018 * beat})`;

      // a matching "lub-dub" buzz at the start of each beat
      const cycle = Math.floor((now - finaleAt) / 1300);
      if (canVibrate && cycle !== lastBeat) {
        lastBeat = cycle;
        if (
          activated() &&
          !document.hidden &&
          (HAPTIC_BEATS === 0 || beatsFelt < HAPTIC_BEATS)
        ) {
          navigator.vibrate([45, 185, 35]);
          beatsFelt++;
        }
      }
    }

    const t = phase === "reveal" ? now - revealAt : -1;
    if (t >= T_FLASH - 120 && !flashDone) {
      flash.classList.add("go");
      flashDone = true;
    }
    if (t >= T_FLASH && !cardShown) {
      polaroid.classList.add("show");
      cardShown = true;
    }
    if (t >= T_HEARTS && !burstDone) {
      spawnHearts();
      burstDone = true;
    }
    if (t >= T_REPLAY && !replay.classList.contains("show")) {
      replay.classList.add("show");
      feel.classList.remove("show");
      if (!letterSeen && cards.some((c) => c.letter && c.pol.offsetParent))
        letterHint.classList.add("show");
    }

    // once the reveal has settled nothing on the canvas changes, so stop redrawing it
    // (saves battery; the heartbeat is a CSS transform and keeps going)
    const still =
      phase === "reveal" &&
      t > T_HEART_BACK + 2300 &&
      !hearts.length &&
      !active.length;
    if (still && drawnStill) {
      requestAnimationFrame(frame);
      return;
    }
    drawnStill = still;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // the word heart: full while building, gone during the fly-in, then faintly back behind the photo
    const heartAlpha = t < 0 ? 1 : 0.32 * clamp01((t - T_HEART_BACK) / 2200);
    if (heartAlpha > 0) {
      ctx.globalAlpha = heartAlpha;
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (t >= 0 && t < 1300) drawFlyingWords(t);

    const keep = [];
    for (const w of active) {
      const dur = w.kind === "appear" ? 560 : 520;
      const p = Math.min(1, (now - w.t0) / dur);
      if (w.kind === "appear") {
        const glow = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
        drawGlowing(w, glow, Math.min(1, p / 0.15));
        if (p >= 1) settle(w);
        else keep.push(w);
      } else {
        drawGlowing(w, 1 - p, 1);
        if (p < 1) keep.push(w);
      }
    }
    active = keep;

    if (hearts.length) drawHearts(now, dt);

    // with no photo, the name glows under the heart instead
    if (nameWord && !photo && phase === "finale") {
      const a = clamp01((now - finaleAt) / 1400);
      const y = Math.min(H - 56, yBot + (H - yBot) * 0.42);
      ctx.globalAlpha = a;
      ctx.font = font(nameWord.px);
      ctx.shadowColor = COLORS[0];
      ctx.shadowBlur = nameWord.px * (0.55 + 0.2 * Math.sin(now / 520));
      ctx.fillStyle = "#fff6f7";
      ctx.fillText(nameWord.text, cx, y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    requestAnimationFrame(frame);
  }

  // after the reveal, a rotation shouldn't replay everything: rebuild the faint heart
  // for the new screen size instantly and keep the Polaroid where it is
  function rebuildInPlace() {
    const keep = {
      revealAt,
      finaleAt,
      flashDone,
      cardShown,
      burstDone,
      lastBeat,
      beatsFelt,
    };
    words = [];
    active = [];
    boxes = [];
    bag = [];
    hearts = [];
    phase = "outline";
    oi = 0;
    qi = 0;
    lctx.clearRect(0, 0, W, H);
    instant = true;
    const now = performance.now();
    while (phase !== "done") build(now, true);
    instant = false;
    ({
      revealAt,
      finaleAt,
      flashDone,
      cardShown,
      burstDone,
      lastBeat,
      beatsFelt,
    } = keep);
    phase = "reveal";
    drawnStill = false;
  }

  // ---------- music ----------
  // Built-in: a slow four-chord loop of warm pads with soft music-box notes on top,
  // made live with the Web Audio API (no file needed). Each chord lasts four heartbeats.
  let actx = null,
    master = null,
    bus = null,
    songEl = null,
    schedTimer = 0,
    nextChordAt = 0,
    chordIndex = 0;
  let musicOn = true;
  try {
    musicOn = localStorage.getItem("loveheart-muted") !== "1";
  } catch (e) {}

  const BEAT = 1.3; // seconds, same as the heartbeat
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [
    // Fmaj7 → Em7 → Dm7 → Cmaj7
    { bass: 41, pad: [53, 57, 60, 64], tune: [69, 72, 76, 77, 81] },
    { bass: 40, pad: [52, 55, 59, 62], tune: [67, 71, 74, 76, 79] },
    { bass: 38, pad: [50, 53, 57, 60], tune: [65, 69, 72, 74, 77] },
    { bass: 36, pad: [48, 52, 55, 59], tune: [67, 71, 72, 76, 79] },
  ];

  function reverb() {
    const len = actx.sampleRate * 3.2,
      ir = actx.createBuffer(2, len, actx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const c = actx.createConvolver();
    c.buffer = ir;
    return c;
  }

  function padVoice(note, at, dur, level) {
    const f = actx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    f.Q.value = 0.3;
    const g = actx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 1.6);
    g.gain.setValueAtTime(level, at + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, at + dur + 2.2); // overlaps the next chord softly
    f.connect(g);
    g.connect(bus);
    for (const detune of [-7, 7]) {
      const o = actx.createOscillator();
      o.type = "triangle";
      o.frequency.value = midi(note);
      o.detune.value = detune;
      o.connect(f);
      o.start(at);
      o.stop(at + dur + 2.4);
    }
  }

  function bell(note, at, level) {
    const g = actx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
    g.connect(bus);
    [
      [1, 1],
      [2, 0.18],
      [3.01, 0.06],
    ].forEach(([mult, amt]) => {
      // a little shimmer above the note
      const o = actx.createOscillator(),
        og = actx.createGain();
      o.type = "sine";
      o.frequency.value = midi(note) * mult;
      og.gain.value = amt;
      o.connect(og);
      og.connect(g);
      o.start(at);
      o.stop(at + 2.5);
    });
  }

  function scheduleMusic() {
    while (nextChordAt < actx.currentTime + 1.5) {
      const ch = CHORDS[chordIndex % CHORDS.length],
        len = BEAT * 4;
      padVoice(ch.bass, nextChordAt, len, 0.12);
      ch.pad.forEach((n) => padVoice(n, nextChordAt, len, 0.055));
      // a few soft notes on the half-beats, never the same pattern twice
      for (let step = 0; step < 8; step++) {
        if (Math.random() < (step === 0 ? 0.9 : 0.38)) {
          const n = ch.tune[(Math.random() * ch.tune.length) | 0];
          bell(
            n,
            nextChordAt + (step * BEAT) / 2 + Math.random() * 0.03,
            0.12 + Math.random() * 0.06,
          );
        }
      }
      nextChordAt += len;
      chordIndex++;
    }
  }

  function chime() {
    if (!actx || !musicOn) return;
    const t = actx.currentTime + 0.02;
    [72, 76, 79, 84, 88].forEach((n, i) => bell(n, t + i * 0.09, 0.16));
  }

  function fadeTo(v, secs) {
    if (master) {
      const t = actx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(v, t + secs);
    } else if (songEl) {
      songEl.volume = v; // plain-file fallback (opened from disk)
    }
  }

  function startMusic() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) {} // iPhone: play even on silent mode
    if (MUSIC) {
      songEl = new Audio(MUSIC);
      songEl.loop = true;
      songEl.onerror = () =>
        console.warn(
          `Couldn't load "${MUSIC}". Check the file name and that it's in the same folder.`,
        );
      // through Web Audio for a smooth fade (iPhones ignore .volume); a page opened
      // straight from disk can't do that, so it just plays the file directly
      if (AC && location.protocol !== "file:") {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = 0;
        master.connect(actx.destination);
        actx.createMediaElementSource(songEl).connect(master);
      } else {
        songEl.volume = 0;
      }
      if (musicOn) songEl.play().catch(() => {});
    } else if (AC) {
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0;
      master.connect(actx.destination);
      bus = actx.createGain();
      const wet = actx.createGain();
      wet.gain.value = 0.55;
      const rv = reverb();
      bus.connect(master);
      bus.connect(rv);
      rv.connect(wet);
      wet.connect(master);
      nextChordAt = actx.currentTime + 0.1;
      scheduleMusic();
      schedTimer = setInterval(scheduleMusic, 250);
    }
    if (actx && !musicOn) actx.suspend();
    if (musicOn) fadeTo(MUSIC_VOLUME, 3);
  }

  function setMusic(on) {
    musicOn = on;
    try {
      localStorage.setItem("loveheart-muted", on ? "0" : "1");
    } catch (e) {}
    soundBtn.classList.toggle("muted", !on);
    soundBtn.setAttribute("aria-label", on ? "Mute music" : "Play music");
    if (on) {
      if (actx) actx.resume();
      if (songEl) songEl.play().catch(() => {});
      fadeTo(MUSIC_VOLUME, 1);
    } else {
      fadeTo(0, 0.4);
      setTimeout(() => {
        if (musicOn) return;
        if (actx) actx.suspend();
        if (songEl) songEl.pause();
      }, 450);
    }
  }

  // pause when she switches apps, carry on when she comes back
  document.addEventListener("visibilitychange", () => {
    if (!opened || !musicOn) return;
    if (document.hidden) {
      if (actx) actx.suspend();
      if (songEl) songEl.pause();
    } else {
      if (actx) actx.resume();
      if (songEl) songEl.play().catch(() => {});
    }
  });
  // some phones need a tap to wake audio back up after the screen was locked
  addEventListener("pointerdown", () => {
    if (opened && musicOn && actx && actx.state !== "running") actx.resume();
  });

  // ---------- letters ----------
  // shrink the handwriting until the whole note fits on the back of the card
  function fitLetter(el) {
    let size = 26;
    el.style.fontSize = size + "px";
    while (el.scrollHeight > el.clientHeight + 1 && size > 12) {
      size -= 1;
      el.style.fontSize = size + "px";
    }
  }

  for (const c of cards) {
    const turn = () => {
      // only once the cards have landed, and only cards that have a letter
      if (
        !c.letter ||
        phase !== "reveal" ||
        performance.now() - revealAt < T_FLASH + 1400
      )
        return;
      if (!c.flip.classList.contains("flipped")) fitLetter(c.text);
      c.flip.classList.toggle("flipped");
      letterSeen = true;
      letterHint.classList.remove("show");
    };
    c.flip.addEventListener("click", turn);
    c.flip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        turn();
      }
    });
  }

  // ---------- intro ----------
  function setIntroText() {
    const name = nameFromLink();
    introFor.textContent = name ? `For ${name}` : "For you";
  }

  function open() {
    if (opened) return;
    opened = true;
    touched = true; // this tap also unlocks vibration
    intro.classList.add("gone");
    soundBtn.classList.add("show");
    soundBtn.classList.toggle("muted", !musicOn);
    startMusic();
    start();
  }
  intro.addEventListener("click", open);
  intro.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  soundBtn.addEventListener("click", () => setMusic(!musicOn));

  // ---------- events ----------
  let lastW = 0,
    lastH = 0,
    resizeTimer;
  function fit(force) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    // phones resize slightly when the browser bar hides; only rebuild on real changes
    if (!force && Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < h * 0.15)
      return;
    lastW = w;
    lastH = h;
    layout();
    if (!opened) {
      setIntroText();
      return;
    }
    if (phase === "reveal" && !force) rebuildInPlace();
    else start();
  }
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fit(false), 250);
  });
  addEventListener("hashchange", () => fit(true));
  // only the Replay button restarts, so an accidental tap on the photo doesn't
  replay.addEventListener("click", () => start());

  fit(true);
  requestAnimationFrame(frame);
})();
