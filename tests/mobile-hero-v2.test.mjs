import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const marker = "/* BOISSY-UJ MOBILE POLISH v2";
const mobile = css.slice(css.indexOf(marker));

test("hero polish follows prior mobile flow correction", () => {
  assert.ok(css.indexOf("BOISSY-UJ MOBILE HOTFIX") >= 0);
  assert.ok(css.indexOf(marker) > css.indexOf("BOISSY-UJ MOBILE HOTFIX"));
  assert.match(mobile, /@media \(max-width: 760px\)/);
});
test("mobile hero crest and titles are proportioned for narrow screens", () => {
  assert.match(mobile, /\.chapter-identity \.crest-halo\s*\{\s*width:\s*clamp\(82px, 22vw, 108px\)/s);
  assert.match(mobile, /\.chapter\.chapter-identity \.hero-content h1\s*\{[^}]*font-size:\s*clamp\(27px, 7\.7vw, 35px\)/s);
  assert.match(mobile, /\.chapter-identity \.hero-content \.eyebrow\s*\{[^}]*text-wrap:\s*balance/s);
  assert.match(js, /tag\('Boissy-UJ · Union Jeunes'\)/);
});
test("short-height phones have a compact hero variant", () => {
  assert.match(mobile, /@media \(max-width: 760px\) and \(max-height: 650px\)/);
  assert.match(mobile, /\.chapter-identity \.crest-halo\s*\{\s*width:\s*76px;\s*height:\s*76px;/);
  assert.match(mobile, /padding-top:\s*74px;/);
});
test("hero controls remain accessible and stay in document flow", () => {
  assert.match(mobile, /\.chapter-identity \.hero-ctas\s*\{[^}]*width:\s*min\(100%, 340px\)/s);
  assert.match(mobile, /\.chapter-identity \.chapter-next\s*\{[^}]*position:\s*relative;/s);
  assert.match(mobile, /\.chapter\.chapter-identity\s*\{[^}]*height:\s*auto;/s);
});
