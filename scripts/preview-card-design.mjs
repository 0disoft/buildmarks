import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  privateLocalSignalVisibility,
  renderUserSignalCard,
  scoreUserProfile
} from "../dist/index.js";

// The preview tooling is supplied locally; it is not a production dependency.
const { chromium } = createRequire(process.argv[2] ?? import.meta.url)("playwright");
const output = resolve("out/card-previews");
await mkdir(output, { recursive: true });
const names = ["built-to-last", "ready-to-use", "well-rounded", "ships-steadily", "easy-to-pick-up", "project-snapshot"];
const gallery = await Promise.all(names.map(async (name) => ({
  name, svg: await readFile(resolve(`examples/assets/types/${name}.svg`), "utf8")
})));
const fixture = JSON.parse(await readFile(resolve("fixtures/example-public-profile.json"), "utf8"));
const report = scoreUserProfile(fixture, { now: new Date(fixture.generatedAt) });
const states = [
  { name: "fixture", svg: renderUserSignalCard(report) },
  { name: "long-name", svg: renderUserSignalCard({ ...report, username: "W".repeat(100) }) },
  { name: "wide-unicode-name", svg: renderUserSignalCard({ ...report, username: "名".repeat(100) }) },
  { name: "private-local", svg: renderUserSignalCard({ ...report, signalVisibility: privateLocalSignalVisibility }) },
  { name: "missing-areas", svg: renderUserSignalCard({ ...report, unavailableDimensions: ["shipping"], notApplicableDimensions: ["consistency"], resultStatus: "provisional", coverage: { observed: 8, expected: 10, ratio: .8 } }) },
  { name: "insufficient", svg: renderUserSignalCard({ ...report, evidenceStatus: "insufficient" }) }
];

const browser = await chromium.launch({ channel: "msedge", headless: true, timeout: 20_000 });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 420 }, deviceScaleFactor: 1 });
  await context.route("**/*", (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const entry of [...gallery, ...states]) {
      const validation = await page.evaluate((svg) => {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        if (doc.querySelector("parsererror")) throw new Error("Invalid SVG XML");
        if (doc.doctype) throw new Error("SVG must not contain a document type");
        if (doc.documentElement.localName !== "svg") throw new Error("Missing SVG root");
        const nodes = [...doc.querySelectorAll("*")];
        if (nodes.length > 180) throw new Error("SVG exceeds the element budget");
        const allowed = new Set(["svg", "title", "desc", "style", "g", "path", "rect", "text", "tspan", "circle", "defs", "linearGradient", "stop", "filter", "feDropShadow"]);
        const ids = new Set();
        for (const node of nodes) {
          if (!allowed.has(node.localName)) throw new Error(`Disallowed SVG element: ${node.localName}`);
          if (node.id) {
            if (ids.has(node.id)) throw new Error(`Duplicate id: ${node.id}`);
            ids.add(node.id);
          }
          for (const attribute of node.attributes) {
            if (/^on/i.test(attribute.name)) throw new Error("Executable SVG attribute");
            if (attribute.localName === "href" && !attribute.value.startsWith("#")) throw new Error("External SVG reference");
            if (["x", "y", "width", "height", "rx", "ry", "cx", "cy", "r"].includes(attribute.name)
              && (!/^-?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(attribute.value) || !Number.isFinite(parseFloat(attribute.value)))) {
              throw new Error(`Invalid coordinate: ${node.localName}.${attribute.name}=${attribute.value}`);
            }
          }
        }
        for (const match of svg.matchAll(/url\(\s*["']?#([^\s)"']+)["']?\s*\)/g)) {
          if (!ids.has(match[1])) throw new Error(`Broken SVG reference: ${match[1]}`);
        }
        if (/url\(\s*["']?(?!#)/.test(svg)) throw new Error("External CSS reference");
        return { elements: nodes.length };
      }, entry.svg);
      await page.setContent(`<style>body{margin:0}</style>${entry.svg.replace(/^<\?xml[^>]*\?>\s*/u, "")}`);
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const svg = document.querySelector("svg");
        const textBounds = [...svg.querySelectorAll("text")].map((node) => {
          const box = node.getBBox();
          return { text: node.textContent, x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
        });
        const clipped = textBounds.filter((box) => box.x < 16 || box.y < 0 || box.right > 744 || box.bottom > 418);
        const overlaps = textBounds.flatMap((first, index) => textBounds.slice(index + 1)
          .filter((second) => first.x < second.right && first.right > second.x && first.y < second.bottom && first.bottom > second.y)
          .map((second) => [first.text, second.text]));
        const surface = svg.querySelector(".surface, .bg");
        return { clipped, overlaps, background: getComputedStyle(surface).fill };
      });
      assert.deepEqual(metrics.clipped, [], `${entry.name} (${scheme}) has clipped text`);
      assert.deepEqual(metrics.overlaps, [], `${entry.name} (${scheme}) has overlapping text`);
      results.push({ name: entry.name, scheme, ...validation, ...metrics });
      if (scheme === "dark") await page.screenshot({ path: resolve(output, `${entry.name}.png`) });
    }
  }

  const galleryHtml = (entries) => `<!doctype html><html><head><meta charset="utf-8"><title>Buildmarks SVG covers</title><style>
    :root{color-scheme:light dark}body{margin:0;padding:24px;background:light-dark(#e4e9f0,#101820);color:light-dark(#17365d,#f3f0df);font:16px system-ui}
    h1{margin:0 0 8px;font-size:25px}p{margin:0 0 24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{margin:8px 0 0;font-size:14px}
    @media(max-width:600px){main{grid-template-columns:1fr}}
  </style></head><body><h1>Buildmarks · SVG cover gallery</h1><p>Sample data · Real vector geometry · Six project descriptions</p><main>${entries.map(({ name, svg }) => `<figure><img alt="${name}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"><figcaption>${name}</figcaption></figure>`).join("")}</main></body></html>`;
  const html = galleryHtml(gallery);
  await writeFile(resolve(output, "gallery.html"), html, "utf8");
  await page.setViewportSize({ width: 1600, height: 1400 });
  for (const scheme of ["dark", "light"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setContent(html);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
    await page.screenshot({ path: resolve(output, `gallery-${scheme}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 420 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setContent(galleryHtml([gallery[0]]));
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({ path: resolve(output, "narrow.png"), fullPage: true });
  assert.deepEqual(errors, [], "Browser errors during card preview");
  await writeFile(resolve(output, "validation.json"), JSON.stringify({ renderer: "Edge / Playwright", results, browserErrors: errors }, null, 2) + "\n");
  console.log(JSON.stringify({ checked: results.length, output, browserErrors: errors.length }));
} finally {
  await browser.close();
}
