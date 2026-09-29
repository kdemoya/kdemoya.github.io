import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";

// Keep the static fallback in sync with the canvas portrait's source and style.
const assets = new URL("../assets/", import.meta.url);
const context = vm.createContext({ window: {} });
for (const filename of ["data/portrait.js", "js/portrait-style.js"]) {
  const source = await readFile(new URL(filename, assets), "utf8");
  vm.runInContext(source, context, { filename });
}

const portrait = context.window.PORTRAIT_DOTS;
const style = context.window.PORTRAIT_STYLE;
const { width, height, palette } = portrait;
const format = (value) => String(Number(value.toFixed(3)));
const groups = palette.map((color) => ({ color, trails: [], dots: [] }));
let visibleCount = 0;

portrait.points.forEach((point, index) => {
  const alpha = point.alpha ?? 1;
  if (alpha <= 0) return;

  // The source row-major index is the shared style seed in both renderers.
  const sample = style.sample(point.x, point.y, index, alpha);
  const x = sample.x * width;
  const y = sample.y * height;
  const tailX = sample.tailX * width;
  const tailY = sample.tailY * height;
  const bendX = sample.bendX * width;
  const bendY = sample.bendY * height;
  const radius =
    portrait.radius * width * Math.sqrt(alpha) * sample.radiusScale;
  const group = groups[point.color];

  group.trails.push(
    `M${format(x - tailX)} ${format(y - tailY)}` +
      `Q${format(x - tailX * 0.5 + bendX)} ${format(y - tailY * 0.5 + bendY)} ${format(x)} ${format(y)}`,
  );
  group.dots.push(
    `<circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}"/>`,
  );
  visibleCount += 1;
});

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="portrait-title portrait-description">`,
  '<title id="portrait-title">Kelvin De Moya</title>',
  '<desc id="portrait-description">A black-and-white dotted sketch of Kelvin with curly hair, glasses and a beard, looking to the side. Loose dots and faint curved strokes form the portrait on a transparent background.</desc>',
  "<defs>",
];

groups.forEach((group, index) => {
  if (!group.trails.length) return;
  svg.push(
    `<path id="portrait-trails-${index}" d="${group.trails.join("")}"/>`,
  );
});
svg.push("</defs>");

function addTrails(opacity, strokeWidth) {
  svg.push(
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" stroke-width="${format(strokeWidth * width)}">`,
  );
  groups.forEach((group, index) => {
    if (!group.trails.length) return;
    svg.push(`<use href="#portrait-trails-${index}" stroke="${group.color}"/>`);
  });
  svg.push("</g>");
}

addTrails(style.softOpacity, style.softWidth);
addTrails(style.trailOpacity, style.strokeWidth);
svg.push(`<g opacity="${style.dotOpacity}">`);
groups.forEach((group) => {
  if (!group.dots.length) return;
  svg.push(`<g fill="${group.color}">`, ...group.dots, "</g>");
});
svg.push("</g>", "</svg>");

const output = new URL("images/portrait.svg", assets);
await writeFile(output, `${svg.join("\n")}\n`);
console.log(
  `Rendered ${visibleCount.toLocaleString("en-US")} portrait dots with the shared sketch style.`,
);
