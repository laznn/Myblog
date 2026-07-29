(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const finePointer = matchMedia("(pointer:fine)").matches;
  const reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;

  const selectors = [
    ".main-menu", ".bolin-model", ".bolin-topic", ".bolin-note", ".bolin-contact",
    ".article-link--card", ".article-link--related", ".article-link--simple",
    "#TableOfContents", ".prose blockquote", ".prose .katex-display", ".prose table",
    "#site-footer > div", "main > article > header", ".pagination > a"
  ].join(",");

  const surfaces = [...doc.querySelectorAll(selectors)];
  const states = new Map();
  surfaces.forEach((surface, index) => {
    surface.classList.add("liquid-glass");
    if (!surface.querySelector(":scope > .lg-optics")) {
      const optics = doc.createElement("i");
      optics.className = "lg-optics";
      optics.setAttribute("aria-hidden", "true");
      surface.prepend(optics);
    }
    const initialX = 26 + (index * 19) % 52;
    const initialY = 18 + (index * 13) % 48;
    surface.style.setProperty("--gx", `${initialX}%`);
    surface.style.setProperty("--gy", `${initialY}%`);
    surface.style.setProperty("--angle", `${70 + (index * 37) % 220}deg`);
    states.set(surface, {
      rx: 0, ry: 0, vx: 0, vy: 0,
      tx: 0, ty: 0, lift: 0, liftV: 0, liftT: 0,
      gx: initialX, gy: initialY, gxT: initialX, gyT: initialY
    });
  });

  const magnetic = [...doc.querySelectorAll(".bolin-button, .main-menu nav > a, .main-menu button, .nested-menu > div:first-child > a")];
  const magnets = new Map();
  magnetic.forEach((item) => {
    item.classList.add("magnetic");
    magnets.set(item, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
  });

  const glyphStates = new Map();
  const heroTitle = doc.querySelector("#hero-title");
  if (heroTitle) {
    const walker = doc.createTreeWalker(heroTitle, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((textNode) => {
      const fragment = doc.createDocumentFragment();
      [...textNode.nodeValue].forEach((character) => {
        if (/\s/.test(character)) {
          fragment.appendChild(doc.createTextNode(character));
          return;
        }
        const glyph = doc.createElement("span");
        glyph.className = "bolin-glyph";
        glyph.textContent = character;
        fragment.appendChild(glyph);
        glyphStates.set(glyph, {
          x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
          scale: 1, scaleV: 0, scaleT: 1,
          glow: 0, glowV: 0, glowT: 0
        });
      });
      textNode.replaceWith(fragment);
    });
  }

  const grain = doc.createElement("div");
  grain.className = "ambient-grain";
  grain.setAttribute("aria-hidden", "true");
  doc.body.appendChild(grain);

  const canvas = doc.createElement("canvas");
  canvas.id = "bolin-aurora";
  canvas.setAttribute("aria-hidden", "true");
  doc.body.prepend(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let pointerX = innerWidth * .5;
  let pointerY = innerHeight * .36;
  let smoothX = pointerX;
  let smoothY = pointerY;
  let previousTime = performance.now();
  let scrollY = window.scrollY;
  let scrollVelocity = 0;
  let previousScroll = scrollY;

  const colors = [
    [245, 107, 174], [79, 170, 255], [123, 91, 238],
    [54, 216, 199], [255, 178, 101]
  ];
  const orbCount = reduced ? 4 : 7;
  const orbs = Array.from({ length: orbCount }, (_, i) => ({
    x: (i + .5) / orbCount,
    y: .15 + ((i * 37) % 70) / 100,
    r: .22 + (i % 3) * .055,
    phase: i * 1.73,
    speed: .00008 + i * .000006,
    color: colors[i % colors.length]
  }));

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  const lens = doc.createElement("span");
  lens.className = "liquid-lens";
  lens.setAttribute("aria-hidden", "true");
  doc.body.appendChild(lens);
  let lensX = pointerX;
  let lensY = pointerY;
  let lensVX = 0;
  let lensVY = 0;

  const progress = doc.createElement("span");
  progress.className = "scroll-spectrum";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<i></i>";
  doc.body.appendChild(progress);

  function setSurfaceTarget(surface, event) {
    const state = states.get(surface);
    if (!state) return;
    const rect = surface.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const nx = x / rect.width - .5;
    const ny = y / rect.height - .5;
    const intensity = surface.matches(".main-menu, .bolin-model") ? 2.15 : 1.45;
    state.tx = -ny * intensity;
    state.ty = nx * intensity;
    state.liftT = -3;
    state.gxT = x / rect.width * 100;
    state.gyT = y / rect.height * 100;
    surface.style.setProperty("--angle", `${Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90}deg`);
    surface.style.setProperty("--optic-x", `${nx * 6}px`);
    surface.style.setProperty("--optic-y", `${ny * 5}px`);
  }

  addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    root.style.setProperty("--mx", `${pointerX}px`);
    root.style.setProperty("--my", `${pointerY}px`);
    if (finePointer && !reduced) lens.classList.add("visible");

    const surface = event.target.closest(selectors);
    surfaces.forEach((item) => {
      if (item !== surface) {
        item.classList.remove("is-hot");
        const state = states.get(item);
        state.tx = 0;
        state.ty = 0;
        state.liftT = 0;
      }
    });
    if (surface) {
      surface.classList.add("is-hot");
      lens.classList.add("over-glass");
      setSurfaceTarget(surface, event);
    } else {
      lens.classList.remove("over-glass");
    }

    const magnet = event.target.closest(".magnetic");
    magnets.forEach((state, item) => {
      if (item !== magnet) {
        state.tx = 0;
        state.ty = 0;
      }
    });
    if (magnet) {
      const rect = magnet.getBoundingClientRect();
      const strength = magnet.closest(".main-menu") ? .16 : .22;
      const state = magnets.get(magnet);
      state.tx = (event.clientX - rect.left - rect.width / 2) * strength;
      state.ty = (event.clientY - rect.top - rect.height / 2) * strength;
    }

    if (!reduced) {
      glyphStates.forEach((state, glyph) => {
        const rect = glyph.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        const radius = 145;
        const influence = distance < radius ? Math.pow(1 - distance / radius, 2) : 0;
        const safeDistance = Math.max(distance, 1);
        state.tx = -(dx / safeDistance) * 2.8 * influence;
        state.ty = -(dy / safeDistance) * 1.8 * influence - 1.3 * influence;
        state.scaleT = 1 + .026 * influence;
        state.glowT = 5.5 * influence;
      });
    }
  }, { passive: true });

  root.addEventListener("mouseleave", () => {
    lens.classList.remove("visible", "over-glass");
    surfaces.forEach((surface) => {
      surface.classList.remove("is-hot");
      const state = states.get(surface);
      state.tx = state.ty = state.liftT = 0;
    });
    magnets.forEach((state) => { state.tx = state.ty = 0; });
    glyphStates.forEach((state) => {
      state.tx = state.ty = state.glowT = 0;
      state.scaleT = 1;
    });
  });

  addEventListener("scroll", () => {
    scrollY = window.scrollY;
    scrollVelocity = scrollY - previousScroll;
    previousScroll = scrollY;
    const max = Math.max(doc.documentElement.scrollHeight - innerHeight, 1);
    progress.firstElementChild.style.transform = `scaleX(${clamp(scrollY / max, 0, 1)})`;
    const nav = doc.querySelector(".main-menu");
    if (nav) nav.classList.toggle("nav-compact", scrollY > 44);
  }, { passive: true });

  doc.addEventListener("click", (event) => {
    const target = event.target.closest("a, button");
    if (!target) return;
    const burst = doc.createElement("span");
    burst.className = "liquid-burst";
    burst.style.left = event.clientX + "px";
    burst.style.top = event.clientY + "px";
    doc.body.appendChild(burst);
    setTimeout(() => burst.remove(), 600);

    if (target.tagName !== "A" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const href = target.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http") || target.target === "_blank") return;
    event.preventDefault();
    doc.body.classList.add("page-leaving");
    setTimeout(() => { location.href = target.href; }, 280);
  });

  const revealTargets = doc.querySelectorAll(".bolin-topic, .bolin-note, .bolin-contact, .article-link--card, .article-link--related, .article-link--simple, .prose > h2, .prose > blockquote, .prose > table, .prose > .katex-display");
  if (!reduced && "IntersectionObserver" in window) {
    revealTargets.forEach((el) => el.classList.add("reveal-ready"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .07, rootMargin: "0px 0px -28px" });
    revealTargets.forEach((el, index) => {
      el.style.transitionDelay = `${(index % 4) * 70}ms`;
      observer.observe(el);
    });
  }

  function spring(value, velocity, target, stiffness, damping, dt) {
    const force = (target - value) * stiffness;
    velocity = (velocity + force * dt) * Math.pow(damping, dt);
    value += velocity * dt;
    return [value, velocity];
  }

  function drawAurora(time) {
    ctx.clearRect(0, 0, width, height);
    smoothX = lerp(smoothX, pointerX, reduced ? .015 : .045);
    smoothY = lerp(smoothY, pointerY, reduced ? .015 : .045);
    ctx.globalCompositeOperation = "screen";

    orbs.forEach((orb, index) => {
      const wobbleX = Math.sin(time * orb.speed + orb.phase) * width * .13;
      const wobbleY = Math.cos(time * orb.speed * .77 + orb.phase) * height * .12;
      const pointerFactor = reduced ? 0 : (index % 2 ? -1 : 1) * .04;
      const x = orb.x * width + wobbleX + (smoothX - width / 2) * pointerFactor;
      const y = orb.y * height + wobbleY + (smoothY - height / 2) * pointerFactor;
      const radius = Math.min(width, height) * orb.r;
      const [r, g, b] = orb.color;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${r},${g},${b},.20)`);
      gradient.addColorStop(.36, `rgba(${r},${g},${b},.105)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }

  function animate(time) {
    const dt = clamp((time - previousTime) / 16.667, .35, 2.2);
    previousTime = time;
    drawAurora(time);

    lensVX = (lensVX + (pointerX - lensX) * .13 * dt) * Math.pow(.68, dt);
    lensVY = (lensVY + (pointerY - lensY) * .13 * dt) * Math.pow(.68, dt);
    lensX += lensVX * dt;
    lensY += lensVY * dt;
    lens.style.left = `${lensX}px`;
    lens.style.top = `${lensY}px`;

    states.forEach((state, surface) => {
      [state.rx, state.vx] = spring(state.rx, state.vx, state.tx, .11, .73, dt);
      [state.ry, state.vy] = spring(state.ry, state.vy, state.ty, .11, .73, dt);
      [state.lift, state.liftV] = spring(state.lift, state.liftV, state.liftT, .1, .76, dt);
      state.gx = lerp(state.gx, state.gxT, .1 * dt);
      state.gy = lerp(state.gy, state.gyT, .1 * dt);
      surface.style.setProperty("--rx", `${state.rx.toFixed(3)}deg`);
      surface.style.setProperty("--ry", `${state.ry.toFixed(3)}deg`);
      surface.style.setProperty("--lift", `${state.lift.toFixed(2)}px`);
      surface.style.setProperty("--gx", `${state.gx.toFixed(2)}%`);
      surface.style.setProperty("--gy", `${state.gy.toFixed(2)}%`);
    });

    magnets.forEach((state, item) => {
      [state.x, state.vx] = spring(state.x, state.vx, state.tx, .13, .68, dt);
      [state.y, state.vy] = spring(state.y, state.vy, state.ty, .13, .68, dt);
      item.style.setProperty("--mag-x", `${state.x.toFixed(2)}px`);
      item.style.setProperty("--mag-y", `${state.y.toFixed(2)}px`);
    });

    glyphStates.forEach((state, glyph) => {
      [state.x, state.vx] = spring(state.x, state.vx, state.tx, .12, .72, dt);
      [state.y, state.vy] = spring(state.y, state.vy, state.ty, .12, .72, dt);
      [state.scale, state.scaleV] = spring(state.scale, state.scaleV, state.scaleT, .1, .74, dt);
      [state.glow, state.glowV] = spring(state.glow, state.glowV, state.glowT, .09, .76, dt);
      glyph.style.setProperty("--glyph-x", `${state.x.toFixed(2)}px`);
      glyph.style.setProperty("--glyph-y", `${state.y.toFixed(2)}px`);
      glyph.style.setProperty("--glyph-scale", state.scale.toFixed(4));
      glyph.style.setProperty("--glyph-glow", `${state.glow.toFixed(2)}px`);
      glyph.style.setProperty("--glyph-blur", `${(state.glow * 1.7).toFixed(2)}px`);
    });

    scrollVelocity *= Math.pow(.78, dt);
    root.style.setProperty("--scroll-velocity", scrollVelocity.toFixed(2));
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
