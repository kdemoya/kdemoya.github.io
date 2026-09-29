import { mkdir, readFile, writeFile } from "node:fs/promises";

// The profile reuses the portfolio's K, with self-contained SVGs for GitHub.
// Text uses system fonts so the image needs no font, script, or service requests.
const root = new URL("../", import.meta.url);
const source = await readFile(
  new URL("assets/images/monogram.svg", root),
  "utf8",
);
const path = source.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];
const attribution = source.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1];
if (!path || !attribution) {
  throw new Error("The source monogram must include its path and attribution.");
}

const colors = {
  background: "#171815",
  ink: "#edeade",
  muted: "#a2a397",
  line: "#3b3d34",
  accent: "#f43f5e",
};

const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function text(x, y, value, options = {}) {
  const {
    size = 18,
    fill = colors.ink,
    weight = 400,
    spacing = 0,
    mono = false,
  } = options;
  const family = mono
    ? "'Courier New', Courier, monospace"
    : "Arial, Helvetica, sans-serif";
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escape(value)}</text>`;
}

function mark(x, y, scale) {
  return `<g transform="translate(${x} ${y}) scale(${scale}) translate(-101 -108)">
  <use href="#letter" transform="translate(9 6)" fill="none" stroke="${colors.accent}" stroke-width="0.8" opacity="0.7"/>
  <use href="#letter" fill="url(#letter-dots)"/>
</g>`;
}

function render(mobile = false) {
  const width = mobile ? 640 : 1280;
  const height = mobile ? 620 : 600;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">Kelvin De Moya — Staff Engineer / Engineering Manager</title>',
    '<desc id="description">Systems that hold up. Teams that grow. Fully remote, EST. Cream typography and a dotted K lettermark on charcoal, with a pink accent.</desc>',
    `<metadata>${attribution}</metadata>`,
    `<defs>
  <path id="letter" fill-rule="evenodd" d="${path}"/>
  <pattern id="letter-dots" width="${mobile ? 7 : 4.8}" height="${mobile ? 7 : 4.8}" patternUnits="userSpaceOnUse">
    <circle cx="${mobile ? 3.5 : 2.4}" cy="${mobile ? 3.5 : 2.4}" r="${mobile ? 2.3 : 1.35}" fill="${colors.ink}"/>
  </pattern>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="0.8" fill="${colors.muted}" opacity="0.25"/>
  </pattern>
</defs>`,
    `<path fill="${colors.background}" d="M0 0h${width}v${height}H0z"/>`,
    `<path fill="${colors.accent}" d="M0 0h8v${height}H0z"/>`,
  ];

  if (mobile) {
    parts.push(
      text(32, 44, "PEOPLE. SYSTEMS. A LITTLE CURIOSITY.", {
        size: 16,
        mono: true,
        spacing: 0.3,
        fill: colors.muted,
      }),
      `<path d="M32 72H608M32 412H608" stroke="${colors.line}"/>`,
      `<path fill="url(#grid)" d="M430 94h178v214H430z"/>`,
      mark(445, 113, 0.4),
      text(28, 179, "Kelvin", { size: 94, weight: 700, spacing: -5 }),
      text(28, 278, "De Moya", { size: 94, weight: 700, spacing: -5 }),
      `<circle cx="397" cy="270" r="7" fill="${colors.accent}"/>`,
      text(32, 341, "Staff Engineer /", { size: 26 }),
      text(32, 376, "Engineering Manager", { size: 26 }),
      text(32, 470, "Systems that hold up.", { size: 34, spacing: -0.7 }),
      text(32, 513, "Teams that grow.", { size: 34, spacing: -0.7 }),
      `<circle cx="38" cy="574" r="4" fill="${colors.accent}"/>`,
      text(54, 580, "14+ YEARS BUILDING · FULLY REMOTE / EST", {
        size: 15,
        mono: true,
        fill: colors.muted,
      }),
    );
  } else {
    parts.push(
      text(64, 57, "PEOPLE. SYSTEMS. A LITTLE CURIOSITY.", {
        size: 17,
        mono: true,
        spacing: 1,
        fill: colors.muted,
      }),
      text(1130, 57, "K / 01", { size: 17, mono: true, fill: colors.muted }),
      `<path d="M64 88H1216M64 485H1216" stroke="${colors.line}"/>`,
      `<path fill="url(#grid)" d="M800 112h416v346H800z"/>`,
      `<path d="M789 125v321" stroke="${colors.line}"/>`,
      mark(827, 126, 0.98),
      text(58, 236, "Kelvin", { size: 142, weight: 700, spacing: -7 }),
      text(58, 371, "De Moya", { size: 142, weight: 700, spacing: -7 }),
      `<circle cx="612" cy="359" r="11" fill="${colors.accent}"/>`,
      text(64, 436, "Staff Engineer / Engineering Manager", {
        size: 27,
        spacing: -0.4,
      }),
      text(64, 537, "Systems that hold up. Teams that grow.", {
        size: 28,
        spacing: -0.7,
      }),
      `<circle cx="985" cy="530" r="4" fill="${colors.accent}"/>`,
      text(1001, 536, "FULLY REMOTE / EST", {
        size: 17,
        mono: true,
        fill: colors.muted,
      }),
      text(64, 571, "14+ YEARS BUILDING SOFTWARE & TEAMS", {
        size: 13,
        mono: true,
        spacing: 1.3,
        fill: colors.muted,
      }),
    );
  }

  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

const output = new URL("github-profile/assets/", root);
await mkdir(output, { recursive: true });
await writeFile(new URL("hero.svg", output), render());
await writeFile(new URL("hero-mobile.svg", output), render(true));
console.log("Rendered desktop and mobile GitHub profile banners.");
