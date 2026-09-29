(() => {
  "use strict";

  const canvas = document.querySelector("#letter");
  const hero = document.querySelector("#hero-mark");
  const motionButton = document.querySelector("#motion");
  const motionLabel = document.querySelector("#motion-label");
  const identityTriggers = document.querySelectorAll("[data-scatter]");
  const signalLabel = document.querySelector("#signal-label");
  const copyPromptButton = document.querySelector("#copy-prompt");
  const portrait = window.PORTRAIT_DOTS;
  const style = window.PORTRAIT_STYLE;
  const portraitStyle =
    typeof style?.sample === "function" &&
    [
      "dotOpacity",
      "trailOpacity",
      "softOpacity",
      "strokeWidth",
      "softWidth",
    ].every((key) => Number.isFinite(style[key]) && style[key] >= 0)
      ? style
      : null;
  const portraitAnchor = document.getElementById("about-emblem");
  const hasPortrait = Boolean(portraitAnchor && validPortrait(portrait));
  const portraitReveal = document.querySelector(".about-reveal");
  const portraitStage = document.querySelector(".about-stage");
  const portraitLinks = document.querySelector(".portrait-links");
  const portraitLinkTargets = portraitLinks
    ? [...portraitLinks.querySelectorAll("a")]
    : [];
  const anchors = hasPortrait ? [hero, portraitAnchor] : [hero];
  const letter = window.K_LETTER;
  let context = null,
    glyphPath = null;
  try {
    if (
      typeof Path2D === "function" &&
      typeof letter?.path === "string" &&
      letter.path.length &&
      Array.isArray(letter.viewBox) &&
      letter.viewBox.length === 4 &&
      letter.viewBox.every(Number.isFinite) &&
      letter.viewBox[2] > 0 &&
      letter.viewBox[3] > 0
    ) {
      context = canvas?.getContext("2d");
      glyphPath = new Path2D(letter.path);
    }
  } catch {
    // Keep the static SVG images when canvas is unavailable.
  }
  if (!context || !glyphPath || !hero) {
    showStaticView();
    return;
  }

  function validPortrait(data) {
    return (
      Number.isInteger(data?.columns) &&
      data.columns > 0 &&
      Number.isInteger(data.rows) &&
      data.rows > 0 &&
      Array.isArray(data.palette) &&
      data.palette.length > 0 &&
      data.palette.every((color) => /^#[\da-f]{6}$/i.test(color)) &&
      Array.isArray(data.points) &&
      data.points.length === data.columns * data.rows &&
      data.points.every(
        (point) =>
          Number.isInteger(point?.color) &&
          point.color >= 0 &&
          point.color < data.palette.length &&
          (point.alpha === undefined ||
            (Number.isFinite(point.alpha) &&
              point.alpha >= 0 &&
              point.alpha <= 1)),
      )
    );
  }

  function showStaticView() {
    document.body.dataset.motion = "off";
    document.body.dataset.particles = "unavailable";
    if (motionButton) {
      motionButton.disabled = true;
      motionButton.setAttribute("aria-pressed", "false");
    }
    identityTriggers.forEach((trigger) => {
      trigger.disabled = true;
    });
    if (motionLabel) motionLabel.textContent = "STATIC VIEW";
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const GLYPH_PARTICLE_LIMIT = 6200;
  const PORTRAIT_DOT_PITCH = 4;
  const PROMPT_EDGE_GAP = 28;
  const CONNECTOR_PAUSE = 220;
  const CONNECTOR_DURATION = 1100;
  const inks = ["#edeade", "#f43f5e"];
  const rgb = (color) =>
    [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const inkChannels = inks.map(rgb);
  const portraitChannels = hasPortrait ? portrait.palette.map(rgb) : [];
  const pointer = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    active: false,
    down: false,
    id: null,
  };
  let available = true,
    enabled = !reduceMotion.matches;
  let points = [],
    stages = [],
    waves = [],
    anchorBoxes = [];
  let baseParticleCount = 0;
  let viewportWidth = 0,
    viewportHeight = 0,
    heroBox = null;
  let portraitScene = null;
  let connectorGeometry = "";
  let connectorCount = 0;
  let connectorElapsed = 0;
  let connectorProgress = 0;
  let aboutTop = Infinity;
  let raf = 0,
    layoutRaf = 0,
    previousTime = 0,
    lastSignal = "";
  let needsLayout = false;
  let promptEffect = null,
    promptHovered = false;
  let promptCursor = null;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (index) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const documentBox = (element) => {
    const box = element.getBoundingClientRect();
    return {
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      width: box.width,
      height: box.height,
    };
  };

  // Stable spatial ordering keeps the K's original particle indices together
  // when extra portrait particles split from those positions.
  function spatialKey(point) {
    const x = clamp(Math.floor(point.x * 1023), 0, 1023);
    const y = clamp(Math.floor(point.y * 1023), 0, 1023);
    let key = 0;
    for (let bit = 0; bit < 10; bit++) {
      key |= ((x >> bit) & 1) << (bit * 2);
      key |= ((y >> bit) & 1) << (bit * 2 + 1);
    }
    return key;
  }

  function paintGlyph(ctx, width, height) {
    const [left, top, glyphWidth, glyphHeight] = letter.viewBox;
    const scale = Math.min(
      (width * 0.87) / glyphWidth,
      (height * 0.9) / glyphHeight,
    );
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (width - glyphWidth * scale) / 2 - left * scale,
      (height - glyphHeight * scale) / 2 - top * scale,
    );
    ctx.fill(glyphPath, letter.fillRule || "evenodd");
  }

  function samplePortrait(box, count) {
    if (!count) return [];
    const rows = Math.max(
      1,
      Math.round(Math.sqrt((count * box.height) / box.width)),
    );
    const samples = [];
    for (let row = 0; row < rows; row++) {
      // Distribute the exact live particle count across complete image rows.
      const columns =
        Math.floor(((row + 1) * count) / rows) -
        Math.floor((row * count) / rows);
      const y = (row + 0.5) / rows;
      const sourceRow = Math.min(
        portrait.rows - 1,
        Math.floor(y * portrait.rows),
      );
      for (let column = 0; column < columns; column++) {
        const x = (column + 0.5) / columns;
        const sourceColumn = Math.min(
          portrait.columns - 1,
          Math.floor(x * portrait.columns),
        );
        const sourceIndex = sourceRow * portrait.columns + sourceColumn;
        const source = portrait.points[sourceIndex];
        const sketch = portraitStyle?.sample(
          x,
          y,
          sourceIndex,
          source.alpha ?? 1,
        );
        const point = {
          x: sketch?.x ?? x,
          y: sketch?.y ?? y,
          color: source.color,
          radius:
            Math.min(box.width / columns, box.height / rows) *
            0.45 *
            Math.sqrt(source.alpha ?? 1) *
            (sketch?.radiusScale ?? 1),
          sketch: sketch
            ? {
                tailX: sketch.tailX * box.width,
                tailY: sketch.tailY * box.height,
                bendX: sketch.bendX * box.width,
                bendY: sketch.bendY * box.height,
              }
            : null,
        };
        samples.push(point);
      }
    }
    // Mix destinations across the whole face so it resolves as a cloud of dots,
    // rather than revealing the quadrants of the spatial sorting grid.
    for (let index = samples.length - 1; index > 0; index--) {
      const swap = Math.floor(noise(index + 2909) * (index + 1));
      [samples[index], samples[swap]] = [samples[swap], samples[index]];
    }
    return samples;
  }

  function sampleGlyph(box, dpr) {
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(box.width * dpr);
    mask.height = Math.ceil(box.height * dpr);
    const maskContext = mask.getContext("2d", { willReadFrequently: true });
    paintGlyph(maskContext, box.width * dpr, box.height * dpr);
    const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
    let area = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 140) area++;
    }

    // Keep every dot in the K's grid. Pixel-aligned rows avoid the alternating
    // brightness caused by a dense fractional pitch, especially on phones.
    const minimumPitch = viewportWidth <= 700 ? 3 : 1;
    let pitchPixels = Math.max(
      Math.ceil(minimumPitch * dpr),
      Math.ceil(Math.sqrt(area / GLYPH_PARTICLE_LIMIT)),
    );
    const startX = Math.ceil(box.x * dpr) + 0.5 - box.x * dpr;
    const startY = Math.ceil(box.y * dpr) + 0.5 - box.y * dpr;
    let samples;
    do {
      samples = [];
      for (let y = startY; y < mask.height; y += pitchPixels) {
        for (let x = startX; x < mask.width; x += pitchPixels) {
          if (
            pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 140
          ) {
            const point = {
              x: x / (box.width * dpr),
              y: y / (box.height * dpr),
            };
            point.key = spatialKey(point);
            samples.push(point);
          }
        }
      }
      if (samples.length <= GLYPH_PARTICLE_LIMIT) break;
      pitchPixels++;
    } while (true);
    samples.sort((a, b) => a.key - b.key);
    return { samples, spacing: pitchPixels / dpr };
  }

  function signal(value) {
    if (!signalLabel || value === lastSignal) return;
    lastSignal = value;
    signalLabel.textContent = value;
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
    previousTime = 0;
  }
  function disableAnimation() {
    available = false;
    enabled = false;
    syncMotion();
  }
  function wake() {
    if (enabled && !raf && !document.hidden && stages.length)
      raf = requestAnimationFrame(frame);
  }
  function resetInteraction() {
    pointer.down = false;
    pointer.active = false;
    pointer.id = null;
    pointer.dx = pointer.dy = 0;
    waves = [];
  }
  function syncMotion() {
    enabled = enabled && available;
    document.body.dataset.motion = enabled ? "on" : "off";
    motionButton?.setAttribute("aria-pressed", String(enabled));
    if (motionLabel)
      motionLabel.textContent = enabled ? "MOTION ON" : "MOTION OFF";
    identityTriggers.forEach((trigger) => {
      trigger.disabled = !enabled;
    });
    if (!enabled) {
      cancelAnimationFrame(layoutRaf);
      layoutRaf = 0;
      resetPromptPointer();
      clearPromptEffect(false);
      resetInteraction();
      connectorElapsed = connectorProgress = 0;
      points.forEach((point) => {
        point.dx = point.dy = point.vx = point.vy = point.heat = 0;
      });
      pause();
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      signal("FORM / STILL");
      if (!available) showStaticView();
    } else {
      // Turning motion on restores the sticky reveal's scroll space.
      build();
    }
  }

  function build() {
    cancelAnimationFrame(layoutRaf);
    layoutRaf = 0;
    if (document.hidden || !enabled) {
      needsLayout = true;
      return;
    }
    needsLayout = false;
    try {
      rebuild();
    } catch {
      // Sampling can fail when a canvas context is unavailable or lost.
      // The static images and page content remain usable.
      disableAnimation();
    }
  }

  function rebuild() {
    if (hasPortrait && document.body.dataset.portrait !== "ready") {
      document.body.dataset.portrait = "ready";
    }
    const boxes = anchors.map(documentBox);
    if (boxes.some((box) => box.width < 1 || box.height < 1)) return;
    portraitScene = null;
    if (hasPortrait && portraitReveal && portraitStage) {
      const reveal = documentBox(portraitReveal);
      const runway = Math.max(
        0,
        reveal.height - portraitStage.getBoundingClientRect().height,
      );
      if (runway > 0) {
        const pinned = clamp(window.scrollY - reveal.y, 0, runway);
        // Cache the released document position. Per-frame offsets follow the
        // CSS sticky element without resampling dots on each scroll event.
        boxes[1].y += runway - pinned;
        portraitScene = {
          pin: reveal.y,
          runway,
          // Let the K depart while it is still visible, leaving room for the
          // journey into About before the portrait's pinned finish.
          start: Math.max(
            0,
            Math.min(
              boxes[0].y + boxes[0].height * 0.1,
              reveal.y - window.innerHeight * 0.8,
            ),
          ),
          end: reveal.y + runway * 0.82,
        };
      }
    }
    if (promptEffect) {
      const sameBox = (a, b, tolerance = 1) =>
        ["x", "y", "width", "height"].every(
          (key) => Math.abs(a[key] - b[key]) < tolerance,
        );
      // A status update can notify the observer without moving anything.
      // Real layout changes release the dots and invalidate the cursor target.
      if (
        viewportWidth !== document.documentElement.clientWidth ||
        viewportHeight !== window.innerHeight ||
        !sameBox(promptEffect.buttonBox, documentBox(copyPromptButton), 4) ||
        boxes.some((box, index) => !sameBox(box, promptEffect.layout[index]))
      ) {
        resetPromptPointer();
        clearPromptEffect();
      }
    }
    anchorBoxes = boxes;
    viewportWidth = document.documentElement.clientWidth;
    viewportHeight = window.innerHeight;
    canvas.style.width = viewportWidth + "px";
    canvas.style.height = viewportHeight + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(viewportWidth * dpr),
      pixelHeight = Math.round(viewportHeight * dpr);
    // Keep the current field visible while the document layout changes.
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    heroBox = boxes[0];
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - viewportHeight,
    );
    const glyph = sampleGlyph(heroBox, dpr);
    const glyphCount = glyph.samples.length;
    const portraitBox = boxes[1];
    const portraitColumns = hasPortrait
      ? Math.min(
          portrait.columns,
          Math.max(1, Math.round(portraitBox.width / PORTRAIT_DOT_PITCH)),
        )
      : 0;
    const portraitRows = hasPortrait
      ? Math.min(
          portrait.rows,
          Math.max(
            1,
            Math.round(
              (portraitColumns * portraitBox.height) / portraitBox.width,
            ),
          ),
        )
      : 0;
    const count = glyphCount
      ? Math.max(glyphCount, portraitColumns * portraitRows)
      : 0;
    const parents = new Array(count),
      portraitOrder = new Array(count);
    let extraIndex = glyphCount;
    // Original dots retain their indices. Extra portrait dots split from nearby
    // originals and have zero radius in the K.
    for (let index = 0; index < glyphCount; index++) {
      const start = Math.floor((index * count) / glyphCount);
      const end = Math.floor(((index + 1) * count) / glyphCount);
      parents[index] = index;
      portraitOrder[index] = start;
      for (let sample = start + 1; sample < end; sample++) {
        parents[extraIndex] = index;
        portraitOrder[extraIndex++] = sample;
      }
    }
    const glyphRadius = Math.min(glyph.spacing * 0.28, 1.65);
    stages = boxes.map((box, index) => {
      const isPortrait = index === 1;
      const samples = isPortrait ? samplePortrait(box, count) : glyph.samples;
      return {
        id: isPortrait ? "about-emblem" : "hero-mark",
        box,
        at: isPortrait
          ? clamp(
              portraitScene
                ? portraitScene.end
                : box.y + box.height / 2 - viewportHeight * 0.5,
              0,
              maxScroll,
            )
          : 0,
        points: samples.length
          ? parents.map((parent, particleIndex) => {
              const point =
                samples[isPortrait ? portraitOrder[particleIndex] : parent];
              return {
                x: box.x + point.x * box.width,
                y: box.y + point.y * box.height,
                color: point.color,
                sketch: point.sketch,
                radius: isPortrait
                  ? point.radius
                  : particleIndex < glyphCount
                    ? glyphRadius
                    : 0,
              };
            })
          : [],
      };
    });
    if (!count || stages.some((stage) => stage.points.length !== count)) {
      disableAnimation();
      return;
    }
    buildPortraitConnectors(glyphCount);
    if (points.length !== count || baseParticleCount !== glyphCount) {
      clearPromptEffect(false);
      baseParticleCount = glyphCount;
      points = Array.from({ length: count }, (_, index) => ({
        dx: 0,
        dy: 0,
        vx: 0,
        vy: 0,
        heat: 0,
        seed: noise(index + 701),
        orbitX: Math.cos(noise(index + 1709) * TAU),
        orbitY: Math.sin(noise(index + 1709) * TAU),
        promptX: 0,
        promptY: 0,
        previousX: null,
        previousY: null,
      }));
    }
    const aboutSection = document.getElementById("about");
    aboutTop = aboutSection ? documentBox(aboutSection).y : Infinity;
    resetInteraction();
    hero.classList.add("ready");
    document.body.dataset.particles = "ready";
    wake();
  }
  function scheduleLayout() {
    if (!available) return;
    needsLayout = true;
    if (!layoutRaf && !document.hidden && enabled)
      layoutRaf = requestAnimationFrame(build);
  }

  function clearPortraitConnectors() {
    connectorCount = 0;
    connectorGeometry = "";
    connectorElapsed = connectorProgress = 0;
    delete document.body.dataset.portraitConnectors;
  }

  function buildPortraitConnectors(glyphCount) {
    const photo = stages[1];
    if (!photo || !portraitLinkTargets.length) {
      clearPortraitConnectors();
      return;
    }

    // Use the same released document coordinates as the portrait. Both the
    // picture and its connectors then follow the sticky stage's frame offset.
    const pinOffset = photo.box.y - documentBox(portraitAnchor).y;
    const links = portraitLinkTargets.map((link) => {
      const box = documentBox(link);
      box.y += pinOffset;
      return box;
    });
    if (links.some((box) => box.width <= 0 || box.height <= 0)) {
      clearPortraitConnectors();
      return;
    }

    const root = {
      x: photo.box.x + photo.box.width * 0.5,
      y: photo.box.y + photo.box.height - 2,
    };
    const junction = {
      x: root.x,
      y: Math.max(root.y + 4, Math.min(...links.map((box) => box.y)) - 10),
    };
    const targets = [{ ...root, distance: 0, radius: 1.25 }];
    const segment = (from, to, distance, endpoint = false) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(length / 4.5));
      for (let step = 1; step <= steps; step++) {
        const progress = step / steps;
        targets.push({
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
          distance: distance + length * progress,
          radius: endpoint && step === steps ? 2 : 1.25,
        });
      }
      return distance + length;
    };
    const stemLength = segment(root, junction, 0);
    for (const link of links) {
      const corner = { x: link.x + link.width * 0.5, y: junction.y };
      const branchLength = segment(junction, corner, stemLength);
      segment(corner, { x: corner.x, y: link.y - 2 }, branchLength, true);
    }

    // Borrow a sparse set of existing lower-portrait dots. Their original
    // destinations stay intact so the complete photograph renders first.
    const candidates = photo.points
      .map((point, index) => ({ point, index }))
      .filter(
        ({ point }) =>
          point.radius > 0 && point.y > photo.box.y + photo.box.height * 0.6,
      )
      .map(({ point, index }) => ({
        point,
        score:
          Math.abs(point.x - root.x) / photo.box.width +
          Math.abs(point.y - root.y) / photo.box.height +
          noise(index + 4021) * 0.75 +
          (portraitChannels[point.color][0] < 70 ? 1 : 0),
      }))
      .sort((a, b) => a.score - b.score);
    if (candidates.length < targets.length) {
      clearPortraitConnectors();
      return;
    }
    const longestBranch = Math.max(
      ...targets.map((target) => target.distance),
      1,
    );
    targets.forEach((target, index) => {
      candidates[index].point.connector = {
        ...target,
        delay: (target.distance / longestBranch) * 0.24,
      };
    });
    connectorCount = targets.length;
    const geometry = [
      photo.box.x,
      photo.box.y,
      photo.box.width,
      photo.box.height,
      photo.points.length,
      glyphCount,
      ...links.flatMap((box) => [box.x, box.y, box.width, box.height]),
    ]
      .map((value) => Math.round(value * 10))
      .join(":");
    if (geometry !== connectorGeometry) {
      connectorGeometry = geometry;
      connectorElapsed = connectorProgress = 0;
    }
    document.body.dataset.portraitConnectors = "ready";
  }

  function advancePortraitConnectors(scene, elapsed, scroll) {
    if (!connectorCount) return false;
    const photo = stages[1];
    const photoTop = photo.box.y + scene.toOffset;
    const visible =
      photoTop < scroll + viewportHeight &&
      photoTop + photo.box.height > scroll;
    const duration = CONNECTOR_PAUSE + CONNECTOR_DURATION;
    if (scene.assembly < 1) {
      // Retrace smoothly into the portrait when scrolling back toward the K.
      connectorElapsed =
        connectorProgress > 0 ? Math.max(0, connectorElapsed - elapsed * 3) : 0;
    } else if (visible) {
      // This clock starts only after a full portrait frame is on screen.
      // It pauses while hidden and finishes without further scrolling.
      connectorElapsed = Math.min(duration, connectorElapsed + elapsed);
    }
    connectorProgress = clamp(
      (connectorElapsed - CONNECTOR_PAUSE) / CONNECTOR_DURATION,
      0,
      1,
    );
    if (scene.assembly < 1 && connectorProgress === 0) connectorElapsed = 0;
    return scene.assembly < 1
      ? connectorProgress > 0
      : visible && connectorElapsed < duration;
  }

  function sceneFor(scroll) {
    const [letterStage, photoStage] = stages;
    if (!photoStage) {
      return {
        from: letterStage,
        to: letterStage,
        t: 0,
        assembly: 0,
        fromOffset: 0,
        toOffset: 0,
      };
    }
    const offset = portraitScene
      ? clamp(scroll - portraitScene.pin, 0, portraitScene.runway) -
        portraitScene.runway
      : 0;
    // The portrait is the final form. Keep its colors, sketch trails, and
    // remaining sticky offset when it settles, then let it scroll away.
    if (scroll >= photoStage.at) {
      return {
        from: photoStage,
        to: photoStage,
        t: 0,
        assembly: 1,
        fromOffset: offset,
        toOffset: offset,
      };
    }
    // Travel out of the visible K, then finish in the pinned introduction.
    const revealStart =
      portraitScene?.start ??
      Math.max(
        0,
        Math.min(photoStage.at * 0.12, heroBox.y + heroBox.height * 0.1),
      );
    const duration = Math.max(1, photoStage.at - revealStart);
    const assembly = clamp((scroll - revealStart) / duration, 0, 1);
    return {
      from: letterStage,
      to: photoStage,
      t: ease(assembly),
      assembly,
      fromOffset: 0,
      toOffset: offset,
    };
  }

  function portraitPosition(
    from,
    to,
    point,
    box,
    progress,
    spread,
    result,
    offset = 0,
  ) {
    const centerX = box.x + box.width * 0.5;
    const centerY = box.y + offset + box.height * 0.48;
    const targetY = to.y + offset;
    const distance = Math.hypot(
      (to.x - centerX) / box.width,
      (targetY - centerY) / box.height,
    );
    const delay = point.seed * 0.16 + Math.min(distance, 1) * 0.1;
    const local = clamp((progress - delay) / (1 - delay), 0, 1);
    result.progress = ease(local);
    result.energy = 0;
    // One continuous descent across the whole journey. Using the short intake
    // and settling curves for Y sent dots to the offscreen destination early.
    // Global progress also carries delayed strands along with the departing K.
    const descent = 1 - (1 - progress) * (1 - progress);
    const travelingY = from.y + (targetY - from.y) * descent;
    if (local === 0 || local === 1) {
      result.x = local === 0 ? from.x : to.x;
      result.y = travelingY;
      return;
    }
    const inflow = ease(clamp(local / 0.42, 0, 1));
    const settle = ease(clamp((local - 0.24) / 0.76, 0, 1));
    const direction = point.seed < 0.52 ? 1 : -1;
    const angle = TAU * (point.seed + direction * (1 - local) * 1.18);
    const depth = 0.4 + point.seed * 0.6;
    const orbitX = centerX + Math.cos(angle) * spread * depth;
    const gatheredX = from.x + (orbitX - from.x) * inflow;
    result.x = gatheredX + (to.x - gatheredX) * settle;
    result.energy = Math.sin(local * Math.PI) * (1 - settle);
    // The spiral rides that descent instead of pulling it toward the face.
    result.y =
      travelingY + Math.sin(angle) * box.height * 0.32 * depth * result.energy;
  }

  function resetPromptPointer() {
    promptHovered = false;
    promptCursor = null;
  }

  function clearPromptEffect(release = true) {
    if (!promptEffect) return;
    promptEffect = null;
    points.forEach((point) => {
      // An interrupted gesture rejoins the existing spring from its last
      // rendered position. A completed gesture already ends exactly at home.
      if (release) {
        point.dx += point.promptX;
        point.dy += point.promptY;
      }
      point.promptX = point.promptY = 0;
    });
  }

  function startPromptEffect(kind) {
    if (
      !enabled ||
      document.hidden ||
      !stages.length ||
      !copyPromptButton ||
      copyPromptButton.disabled
    )
      return;
    const buttonBox = documentBox(copyPromptButton);
    if (
      !buttonBox.width ||
      !buttonBox.height ||
      buttonBox.y >= window.scrollY + viewportHeight ||
      buttonBox.y + buttonBox.height <= window.scrollY
    )
      return;
    if (kind === "charge" && promptEffect) return;

    clearPromptEffect();
    resetInteraction();
    const scene = sceneFor(window.scrollY);
    const assembling = scene.assembly > 0 && scene.assembly < 1;
    const assemblyPoint = {};
    const assemblySpread = assembling
      ? Math.min(scene.to.box.width * 0.85, viewportWidth * 0.28)
      : 0;
    const cursor =
      promptHovered && copyPromptButton.matches(":hover") ? promptCursor : null;
    const sinkX = cursor
      ? clamp(cursor.x, buttonBox.x + 28, buttonBox.x + buttonBox.width - 28)
      : buttonBox.x + buttonBox.width * 0.5;
    const sinkY = buttonBox.y - PROMPT_EDGE_GAP;
    const curve = Math.min(180, heroBox.width * 0.32);
    promptEffect = {
      kind,
      started: performance.now(),
      duration: kind === "copy" ? 1840 : Infinity,
      burst: Math.min(190, viewportWidth * 0.34),
      buttonBox,
      layout: anchorBoxes,
      sinkX,
      sinkY,
      targetX: sinkX,
      heroBounds: documentBox(hero.closest(".hero") || hero),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    points.forEach((point, index) => {
      const from = scene.from.points[index],
        to = scene.to.points[index];
      let homeX = from.x + (to.x - from.x) * scene.t;
      let homeY =
        from.y +
        scene.fromOffset +
        (to.y + scene.toOffset - from.y - scene.fromOffset) * scene.t;
      if (assembling) {
        portraitPosition(
          from,
          to,
          point,
          scene.to.box,
          scene.assembly,
          assemblySpread,
          assemblyPoint,
          scene.toOffset,
        );
        homeX = assemblyPoint.x;
        homeY = assemblyPoint.y;
      }
      point.promptOriginX = point.dx;
      point.promptOriginY = point.dy;
      const halo = 9 + point.seed * 19;
      point.promptSinkX = sinkX + point.orbitX * halo;
      point.promptSinkY = sinkY + point.orbitY * halo * 0.6;
      const dx = point.promptSinkX - homeX - point.dx;
      const dy = point.promptSinkY - homeY - point.dy;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const arc = curve * (0.5 + point.seed * 0.5) * (index % 2 ? 1 : -1);
      point.promptArc = arc;
      point.promptCurveX = (-dy / distance) * arc;
      // Arc above the invitation, as though its top border were a wall.
      point.promptCurveY = -Math.abs((dx / distance) * arc);
      point.previousX = homeX + point.dx;
      point.previousY = homeY + point.dy;
      point.dx = point.dy = point.vx = point.vy = point.heat = 0;
    });
    wake();
  }

  function movePromptPoint(point, homeX, homeY, effect, elapsed) {
    const sinkX = point.promptSinkX - homeX,
      sinkY = point.promptSinkY - homeY;
    if (effect.kind === "charge") {
      const halo = 9 + point.seed * 19;
      const cursorX = effect.sinkX + point.orbitX * halo - homeX;
      const cursorY = effect.sinkY + point.orbitY * halo * 0.6 - homeY;
      const dx = cursorX - point.promptOriginX,
        dy = cursorY - point.promptOriginY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const curveX = (-dy / distance) * point.promptArc;
      const curveY = -Math.abs((dx / distance) * point.promptArc);
      const intake = ease(clamp((elapsed - point.seed * 70) / 440, 0, 1));
      // Follow the cursor horizontally while peeking above the top border.
      // Only those accent strands vibrate; the rest of the K stays legible.
      const reaching = point.seed < 0.36;
      const reach = reaching ? 0.88 + point.seed * 0.3 : 0.025;
      const travel = intake * reach;
      const origin = 1 - intake;
      const curl = Math.sin(travel * Math.PI);
      const vibration = reaching ? intake * (1.8 + point.seed * 2) : 0;
      const phase = elapsed * 0.032 + point.seed * TAU * 4;
      point.promptX =
        point.promptOriginX * origin +
        cursorX * travel +
        curveX * curl +
        Math.sin(phase) * vibration;
      point.promptY =
        point.promptOriginY * origin +
        cursorY * travel +
        curveY * curl +
        Math.cos(phase * 1.17 + point.orbitY) * vibration * 0.75;
      return travel * 1.4;
    }

    const age = Math.max(0, elapsed - point.seed * 140);
    if (age <= 620) {
      const progress = age / 620,
        travel = ease(progress);
      const curl = Math.sin(progress * Math.PI);
      point.promptX =
        point.promptOriginX * (1 - travel) +
        sinkX * travel +
        point.promptCurveX * curl;
      point.promptY =
        point.promptOriginY * (1 - travel) +
        sinkY * travel +
        point.promptCurveY * curl;
      return 0.18 + travel * 0.82;
    }

    const progress = clamp((age - 620) / 1080, 0, 1),
      returning = ease(progress);
    const burst =
      Math.sin(progress * Math.PI) *
      (1 - progress) *
      effect.burst *
      (0.55 + point.seed * 0.45);
    point.promptX = sinkX * (1 - returning) + point.orbitX * burst;
    point.promptY =
      sinkY * (1 - returning) - Math.abs(point.orbitY) * burst * 0.72;
    return 1 - returning;
  }

  function frame(time) {
    raf = 0;
    if (!enabled || document.hidden || !stages.length) return;
    const dt = previousTime
      ? clamp((time - previousTime) / 16.667, 0.25, 2)
      : 1;
    previousTime = time;
    const scroll = window.scrollY;
    const scene = sceneFor(scroll);
    const connectorsMoving = advancePortraitConnectors(
      scene,
      dt * 16.667,
      scroll,
    );
    if (
      promptEffect?.kind === "copy" &&
      time - promptEffect.started >= promptEffect.duration
    ) {
      clearPromptEffect(false);
      const stillHovered = promptHovered && copyPromptButton.matches(":hover");
      const stillFocused =
        document.activeElement === copyPromptButton &&
        copyPromptButton.matches(":focus-visible");
      if (stillHovered || stillFocused) startPromptEffect("charge");
    }
    const effect = promptEffect;
    const effectTime = effect ? time - effect.started : 0;
    if (effect?.kind === "charge") {
      // Frame-rate-independent easing runs once for the entire particle field.
      const follow = 1 - Math.pow(0.78, dt);
      effect.sinkX += (effect.targetX - effect.sinkX) * follow;
    }
    const fromPortrait = scene.from.id === "about-emblem";
    const toPortrait = scene.to.id === "about-emblem";
    const portraitMix = fromPortrait ? 1 - scene.t : toPortrait ? scene.t : 0;
    const sketchMix =
      portraitStyle && !effect
        ? ease(clamp((portraitMix - 0.35) / 0.65, 0, 1))
        : 0;
    const sketchWidth = fromPortrait
      ? scene.from.box.width
      : toPortrait
        ? scene.to.box.width
        : 0;
    const assembling = scene.assembly > 0 && scene.assembly < 1;
    const assemblyBox = toPortrait ? scene.to.box : null;
    const assemblySpread = assemblyBox
      ? Math.min(assemblyBox.width * 0.85, viewportWidth * 0.28)
      : 0;
    const assemblyPoint = {},
      assemblyTail = {};
    const radius =
      Math.min(135, heroBox.width * 0.23) * (pointer.down ? 1.3 : 1);
    const waveLimit = Math.hypot(heroBox.width, heroBox.height);
    waves.forEach((wave) => {
      wave.radius += 7 * dt;
    });
    waves = waves.filter((wave) => wave.radius < waveLimit);
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    const paths = inks.map(() => new Path2D());
    const portraitPaths = new Map();
    const trails = effect ? new Path2D() : null;
    const assemblyTrails = assembling && !effect ? new Path2D() : null;
    const connectorTrails = connectorsMoving ? new Path2D() : null;
    let moving = false;
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const from = scene.from.points[index];
      const to = scene.to.points[index];
      const fromRadius = from.radius;
      const toRadius = to.radius;
      let travel = scene.t,
        assemblyEnergy = 0;
      if (assembling && (fromRadius > 0 || toRadius > 0)) {
        portraitPosition(
          from,
          to,
          point,
          assemblyBox,
          scene.assembly,
          assemblySpread,
          assemblyPoint,
          scene.toOffset,
        );
        travel = assemblyPoint.progress;
        assemblyEnergy = assemblyPoint.energy;
      }
      let dotRadius = fromRadius + (toRadius - fromRadius) * travel;
      if (dotRadius <= 0) {
        // Invisible detail dots must not carry old interaction forces into the
        // next portrait transition. They cost no drawing or spring work here.
        point.dx = point.dy = point.vx = point.vy = point.heat = 0;
        point.promptX = point.promptY = 0;
        point.previousX = point.previousY = null;
        continue;
      }
      let targetX = assembling
        ? assemblyPoint.x
        : from.x + (to.x - from.x) * scene.t;
      let targetY = assembling
        ? assemblyPoint.y
        : from.y +
          scene.fromOffset +
          (to.y + scene.toOffset - from.y - scene.fromOffset) * scene.t;
      const connector = (toPortrait ? to : fromPortrait ? from : null)
        ?.connector;
      const connectorTravel =
        connector && !effect
          ? ease(
              clamp(
                (connectorProgress - connector.delay) / (1 - connector.delay),
                0,
                1,
              ),
            )
          : 0;
      if (connectorTravel > 0) {
        const curl = Math.sin(connectorTravel * Math.PI);
        targetX +=
          (connector.x - targetX) * connectorTravel + point.orbitX * 18 * curl;
        targetY +=
          (connector.y + scene.toOffset - targetY) * connectorTravel -
          (12 + point.seed * 20) * curl;
        dotRadius += (connector.radius - dotRadius) * connectorTravel;
      }
      const glow = effect
        ? movePromptPoint(point, targetX, targetY, effect, effectTime)
        : 0;
      targetX += point.promptX;
      targetY += point.promptY;
      const worldX = targetX + point.dx;
      const worldY = targetY + point.dy;
      if (pointer.active) {
        const dx = worldX - pointer.x,
          dy = worldY - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius) {
          const influence = 1 - distance / radius;
          const force = pointer.down ? -1.4 : 2.1;
          point.vx +=
            ((dx / Math.max(distance, 1)) * force +
              (pointer.down ? pointer.dx * 0.055 : 0)) *
            influence *
            dt;
          point.vy +=
            ((dy / Math.max(distance, 1)) * force +
              (pointer.down ? pointer.dy * 0.055 : 0)) *
            influence *
            dt;
          if (pointer.down) point.heat = Math.max(point.heat, influence);
        }
      }
      for (const wave of waves) {
        const dx = targetX - wave.x,
          dy = targetY - wave.y;
        const distance = Math.hypot(dx, dy);
        const band = Math.abs(distance - wave.radius);
        if (band < 26) {
          const influence = 1 - band / 26;
          point.vx += (dx / Math.max(distance, 1)) * influence * 1.7 * dt;
          point.vy += (dy / Math.max(distance, 1)) * influence * 1.7 * dt;
          point.heat = Math.max(point.heat, influence * 0.65);
        }
      }
      const spring = pointer.down ? 0.034 : 0.055;
      point.vx = (point.vx - point.dx * spring * dt) * Math.pow(0.83, dt);
      point.vy = (point.vy - point.dy * spring * dt) * Math.pow(0.83, dt);
      point.dx += point.vx * dt;
      point.dy += point.vy * dt;
      point.heat *= Math.pow(0.956, dt);
      if (
        Math.abs(point.vx) +
          Math.abs(point.vy) +
          Math.abs(point.dx) +
          Math.abs(point.dy) >
          0.06 ||
        point.heat > 0.08
      ) {
        moving = true;
      } else {
        point.dx = point.dy = point.vx = point.vy = point.heat = 0;
      }
      const documentX = targetX + point.dx;
      const x = documentX - window.scrollX;
      const documentY = targetY + point.dy;
      const y = documentY - scroll;
      const renderedRadius =
        dotRadius *
        (1 + glow * 0.38 + assemblyEnergy * (0.35 + point.seed * 0.5));
      if (trails && glow > 0.2 && index % 3 === 0 && point.previousX !== null) {
        const travel = Math.hypot(
          documentX - point.previousX,
          documentY - point.previousY,
        );
        if (travel > 1 && travel < 100) {
          trails.moveTo(
            point.previousX - window.scrollX,
            point.previousY - scroll,
          );
          trails.lineTo(x, y);
        }
      }
      if (
        connectorTrails &&
        connectorTravel > 0 &&
        connectorTravel < 1 &&
        point.previousX !== null
      ) {
        const distance = Math.hypot(
          documentX - point.previousX,
          documentY - point.previousY,
        );
        if (distance > 0.2 && distance < 48) {
          connectorTrails.moveTo(
            point.previousX - window.scrollX,
            point.previousY - scroll,
          );
          connectorTrails.lineTo(x, y);
        }
      }
      point.previousX = documentX;
      point.previousY = documentY;
      if (
        x < -renderedRadius ||
        x > viewportWidth + renderedRadius ||
        y < -renderedRadius ||
        y > viewportHeight + renderedRadius
      )
        continue;
      if (assemblyTrails && assemblyEnergy > 0.07 && index % 7 === 0) {
        // Sample the trajectory itself: trails reverse with scrolling and never
        // depend on old frames or keep the animation running after settling.
        portraitPosition(
          from,
          to,
          point,
          assemblyBox,
          Math.max(0, scene.assembly - 0.008 - point.seed * 0.008),
          assemblySpread,
          assemblyTail,
          scene.toOffset,
        );
        const dx = documentX - assemblyTail.x,
          dy = documentY - assemblyTail.y;
        const length = Math.hypot(dx, dy);
        if (length > 0.8) {
          const fraction = Math.min(1, 38 / length);
          assemblyTrails.moveTo(x - dx * fraction, y - dy * fraction);
          assemblyTrails.lineTo(x, y);
        }
      }
      // Dots adopt the ink of the section they are physically passing through.
      let color = documentY < aboutTop ? 0 : 1;
      const highlighted =
        (point.heat > 0.18 || glow > 0.2) && documentY < aboutTop;
      if (highlighted) color = 1;
      let path = paths[color];
      // Background destinations shrink away in the current ink; they never
      // introduce the pale colors removed from the portrait silhouette.
      const portraitRadius = fromPortrait
        ? fromRadius
        : toPortrait
          ? toRadius
          : 0;
      if (portraitMix > 0 && portraitRadius > 0 && !highlighted) {
        const portraitColor = (fromPortrait ? from : to).color;
        const connectorColorStep = Math.round(connectorTravel * 16);
        const key =
          (color + connectorColorStep * inks.length) * portrait.palette.length +
          portraitColor;
        let batch = portraitPaths.get(key);
        if (!batch) {
          const base = inkChannels[color],
            photo = portraitChannels[portraitColor];
          const channels = base.map((value, channel) => {
            const shade = value + (photo[channel] - value) * portraitMix;
            return Math.round(
              shade +
                ((inkChannels[1][channel] - shade) * connectorColorStep) / 16,
            );
          });
          batch = {
            path: new Path2D(),
            trails: new Path2D(),
            color: `rgb(${channels.join(",")})`,
          };
          portraitPaths.set(key, batch);
        }
        path = batch.path;
        const sketch = (fromPortrait ? from : to).sketch;
        const localSketchMix = sketchMix * (1 - connectorTravel);
        if (localSketchMix > 0 && sketch) {
          // Preserve a little of the assembly's wake as permanent pencil marks.
          // Geometry comes from the portrait samples, never previous frames.
          const tailX = sketch.tailX * localSketchMix,
            tailY = sketch.tailY * localSketchMix;
          batch.trails.moveTo(x - tailX, y - tailY);
          batch.trails.quadraticCurveTo(
            x - tailX * 0.5 + sketch.bendX * localSketchMix,
            y - tailY * 0.5 + sketch.bendY * localSketchMix,
            x,
            y,
          );
        }
      }
      path.moveTo(x + renderedRadius, y);
      path.arc(x, y, renderedRadius, 0, TAU);
    }
    if (trails) {
      context.strokeStyle = "#f43f5e";
      context.lineWidth = 0.7;
      context.globalAlpha = 0.35;
      context.stroke(trails);
      context.globalAlpha = 1;
    }
    if (assemblyTrails) {
      context.strokeStyle = "#fda4af";
      context.lineWidth = 0.8;
      context.globalAlpha = 0.42 * Math.sin(scene.assembly * Math.PI);
      context.stroke(assemblyTrails);
      context.globalAlpha = 1;
    }
    if (connectorTrails) {
      context.strokeStyle = inks[1];
      context.lineWidth = 0.7;
      context.globalAlpha = 0.35;
      context.stroke(connectorTrails);
      context.globalAlpha = 1;
    }
    inks.forEach((color, index) => {
      context.fillStyle = color;
      context.fill(paths[index]);
    });
    if (sketchMix > 0) {
      context.lineCap = "round";
      // A faint broad stroke supplies softness without a full-canvas blur.
      context.lineWidth = sketchWidth * portraitStyle.softWidth;
      context.globalAlpha = sketchMix * portraitStyle.softOpacity;
      portraitPaths.forEach((batch) => {
        context.strokeStyle = batch.color;
        context.stroke(batch.trails);
      });
      context.lineWidth = sketchWidth * portraitStyle.strokeWidth;
      context.globalAlpha = sketchMix * portraitStyle.trailOpacity;
      portraitPaths.forEach((batch) => {
        context.strokeStyle = batch.color;
        context.stroke(batch.trails);
      });
      context.lineCap = "butt";
    }
    context.globalAlpha =
      1 - sketchMix * (1 - (portraitStyle?.dotOpacity ?? 1));
    portraitPaths.forEach((batch) => {
      context.fillStyle = batch.color;
      context.fill(batch.path);
    });
    context.globalAlpha = 1;
    pointer.dx *= 0.7;
    pointer.dy *= 0.7;
    signal(
      effect
        ? effect.kind === "charge"
          ? "FORM / CHARGING"
          : effectTime < 760
            ? "FORM / GATHERING"
            : "FORM / REASSEMBLING"
        : pointer.down
          ? "FORM / IN FLUX"
          : moving || waves.length
            ? "FORM / REASSEMBLING"
            : scroll > 10
              ? "FORM / IN TRANSIT"
              : "FORM / INTACT",
    );
    if (effect || moving || waves.length || connectorsMoving) wake();
    else previousTime = 0;
  }

  function canInteract(event) {
    if (!enabled || promptEffect || !heroBox || event.isPrimary === false)
      return false;
    if (
      event.target.closest?.(
        "a, button, input, textarea, select, summary, [contenteditable]",
      )
    )
      return false;
    const x = event.clientX + window.scrollX,
      y = event.clientY + window.scrollY;
    return (
      x >= heroBox.x &&
      x <= heroBox.x + heroBox.width &&
      y >= heroBox.y &&
      y <= heroBox.y + heroBox.height
    );
  }
  function locate(event) {
    const x = event.clientX + window.scrollX,
      y = event.clientY + window.scrollY;
    pointer.dx = pointer.active ? clamp(x - pointer.x, -40, 40) : 0;
    pointer.dy = pointer.active ? clamp(y - pointer.y, -40, 40) : 0;
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (promptEffect && event.pointerType !== "touch") {
        const box = promptEffect.heroBounds;
        const x = event.clientX + window.scrollX,
          y = event.clientY + window.scrollY;
        if (
          x < box.x ||
          x > box.x + box.width ||
          y < box.y ||
          y > box.y + box.height
        ) {
          resetPromptPointer();
          clearPromptEffect();
          wake();
        }
      }
      if (pointer.id !== null && event.pointerId !== pointer.id) return;
      if (canInteract(event)) locate(event);
      else if (pointer.active) {
        pointer.active = false;
        pointer.down = false;
      } else return;
      wake();
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || !canInteract(event)) return;
      locate(event);
      pointer.down = true;
      pointer.id = event.pointerId;
      wake();
    },
    { passive: true },
  );
  function release(event) {
    if (pointer.id !== null && event.pointerId !== pointer.id) return;
    if (pointer.down && enabled && event.type !== "pointercancel")
      waves.push({ x: pointer.x, y: pointer.y, radius: 0 });
    pointer.down = false;
    pointer.id = null;
    if (event.pointerType !== "mouse" || event.type === "pointercancel")
      pointer.active = false;
    wake();
  }
  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("pointerleave", () => {
    resetPromptPointer();
    clearPromptEffect();
    resetInteraction();
    wake();
  });
  window.addEventListener("blur", () => {
    resetPromptPointer();
    clearPromptEffect();
    resetInteraction();
    wake();
  });
  window.addEventListener(
    "scroll",
    () => {
      // Native touch scrolling always takes precedence over letter manipulation.
      // A keyboard focus may already have scrolled before its gesture starts.
      if (
        promptEffect &&
        (window.scrollX !== promptEffect.scrollX ||
          window.scrollY !== promptEffect.scrollY)
      ) {
        resetPromptPointer();
        clearPromptEffect();
      }
      if (pointer.active || pointer.down) resetInteraction();
      wake();
    },
    { passive: true },
  );

  function scatterLetter() {
    if (!enabled || !stages.length) return;
    clearPromptEffect();
    const scene = sceneFor(window.scrollY);
    const fromBox = scene.from.box,
      toBox = scene.to.box;
    const centerX =
      (fromBox.x + fromBox.width * 0.5) * (1 - scene.t) +
      (toBox.x + toBox.width * 0.5) * scene.t;
    const centerY =
      (fromBox.y + scene.fromOffset + fromBox.height * 0.5) * (1 - scene.t) +
      (toBox.y + scene.toOffset + toBox.height * 0.5) * scene.t;
    const assembling = scene.assembly > 0 && scene.assembly < 1;
    const assemblyPoint = {};
    const assemblySpread = assembling
      ? Math.min(toBox.width * 0.85, viewportWidth * 0.28)
      : 0;
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const from = scene.from.points[index],
        to = scene.to.points[index];
      let x = from.x + (to.x - from.x) * scene.t;
      let y =
        from.y +
        scene.fromOffset +
        (to.y + scene.toOffset - from.y - scene.fromOffset) * scene.t;
      if (assembling) {
        portraitPosition(
          from,
          to,
          point,
          toBox,
          scene.assembly,
          assemblySpread,
          assemblyPoint,
          scene.toOffset,
        );
        x = assemblyPoint.x;
        y = assemblyPoint.y;
      }
      const dx = x + point.dx - centerX,
        dy = y + point.dy - centerY;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const force =
        (12 + noise(index + 77) * 21) * Math.min(1, heroBox.width / 600);
      point.vx += (dx / distance) * force;
      point.vy += (dy / distance) * force;
      point.heat = noise(index + 17) * 0.8;
    }
    waves.push({ x: centerX, y: centerY, radius: 0 });
    wake();
  }
  identityTriggers.forEach((trigger) =>
    trigger.addEventListener("click", scatterLetter),
  );
  function trackPromptCursor(event) {
    if (event.pointerType === "touch" || event.isPrimary === false) return;
    promptHovered = true;
    promptCursor = { x: event.clientX + window.scrollX };
    if (!promptEffect) startPromptEffect("charge");
    // Moving during a copy updates the next hover target, not the active burst.
    if (promptEffect?.kind === "charge") {
      const box = promptEffect.buttonBox;
      promptEffect.targetX = clamp(
        promptCursor.x,
        box.x + 28,
        box.x + box.width - 28,
      );
    }
  }
  copyPromptButton?.addEventListener("pointerenter", trackPromptCursor);
  copyPromptButton?.addEventListener("pointermove", trackPromptCursor, {
    passive: true,
  });
  copyPromptButton?.addEventListener("pointerleave", () => {
    resetPromptPointer();
    const promptFocused =
      document.activeElement === copyPromptButton &&
      copyPromptButton.matches(":focus-visible");
    if (!promptFocused && promptEffect?.kind === "charge") {
      clearPromptEffect();
      wake();
    } else if (promptEffect?.kind === "charge") {
      promptEffect.targetX =
        promptEffect.buttonBox.x + promptEffect.buttonBox.width * 0.5;
    }
  });
  copyPromptButton?.addEventListener("focus", () => {
    if (copyPromptButton.matches(":focus-visible")) startPromptEffect("charge");
  });
  copyPromptButton?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") resetPromptPointer();
    else trackPromptCursor(event);
  });
  copyPromptButton?.addEventListener("blur", () => {
    if (!promptHovered) {
      clearPromptEffect();
      wake();
    }
  });
  // Copying remains entirely owned by the button controller. This notification
  // starts only the visual gesture and never waits for or gates the clipboard.
  window.addEventListener("portfolio:prompt-copy", () =>
    startPromptEffect("copy"),
  );
  canvas.addEventListener("contextlost", disableAnimation);
  motionButton?.addEventListener("click", () => {
    enabled = !enabled;
    syncMotion();
  });
  reduceMotion.addEventListener("change", (event) => {
    enabled = !event.matches;
    syncMotion();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetPromptPointer();
      clearPromptEffect(false);
      resetInteraction();
      pause();
    } else if (needsLayout) scheduleLayout();
    else wake();
  });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("portfolio:layout", scheduleLayout);
  window.addEventListener("pageshow", scheduleLayout);
  window.addEventListener("load", scheduleLayout, { once: true });
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleLayout);
    anchors.forEach((anchor) => observer.observe(anchor));
    if (portraitLinks) observer.observe(portraitLinks);
    portraitLinkTargets.forEach((link) => observer.observe(link));
    observer.observe(document.body);
  }
  document.fonts?.ready.then(scheduleLayout);
  syncMotion();
})();
