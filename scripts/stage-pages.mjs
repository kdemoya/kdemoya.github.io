import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("_site/", root);
const publicFiles = [
  "index.html",
  "profile.html",
  "profile.md",
  "context.md",
  "llms.txt",
  "404.html",
  "assets",
];

// Rebuild the generated artifact from an explicit list of public content.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of publicFiles) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
await writeFile(new URL(".nojekyll", output), "");

// Preserve shared /me/ links after moving the portfolio to the domain root.
const legacy = new URL("me/", output);
await mkdir(legacy, { recursive: true });
for (const path of ["profile.md", "context.md", "llms.txt"]) {
  await cp(new URL(path, root), new URL(path, legacy));
}

for (const [file, destination] of [
  ["index.html", "/"],
  ["profile.html", "/profile.html"],
]) {
  await writeFile(
    new URL(file, legacy),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kelvin De Moya — Portfolio moved</title>
    <link rel="canonical" href="https://kdemoya.github.io${destination}" />
    <meta http-equiv="refresh" content="0;url=${destination}" />
    <script>
      window.location.replace(${JSON.stringify(destination)} + window.location.search + window.location.hash);
    </script>
  </head>
  <body>
    <p>The portfolio has moved. <a href="${destination}">Continue to the new address</a>.</p>
  </body>
</html>
`,
  );
}

console.log("Staged public pages, assets, and legacy /me/ links in _site/.");
