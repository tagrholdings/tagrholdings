// Turns content/presentation/index.html (the source — edit that file) into the module the platform tour (/tour)
// serves. Run after every edit:  npm run presentation:build
// presentation.test.ts fails while the two are out of step.
import { readFileSync, writeFileSync } from "node:fs";

const source = "content/presentation/index.html";
const target = "app/tour/presentation-html.ts";

const html = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
writeFileSync(
  target,
  `// GENERATED from ${source} by scripts/build-presentation.mjs — edit the HTML, then run \`npm run presentation:build\`.\n` +
    `export const PRESENTATION_HTML = ${JSON.stringify(html)};\n`
);
console.log(`Wrote ${target} (${Math.round(html.length / 1024)} KB)`);
