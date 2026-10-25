// Targeted local performance trace. No account, provider calls or browser suite.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { defaultSettings } from '../src/workspaceActions.ts';
import { emptyDocument } from '../src/graph/structural.ts';
import { emptyController, applyValue } from '../src/appearance/model.ts';
import { controllerTargets, instanceId } from '../src/appearance/registry.ts';
import template from '../src/ui/default-template.json' with { type: 'json' };
const arg = (name, fallback) => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const url = arg('url', 'http://127.0.0.1:4173'), label = arg('label', 'current'), out = arg('out', `/tmp/omnia-profile-${label}`);
const localTargets = Number(arg('targets', '300'));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const rows = [];
try {
  for (const scenario of arg('scenarios', 'off,brightness,glow,electric-text,lightning,selector').split(',')) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
    const settings = defaultSettings(); settings.appearance.effect = 'off'; settings.appearance.atmosphere = false;
    let state = emptyController();
    for (let i = 0; i < localTargets; i++) { const id = instanceId('text.ui.buttons', `function:perf-${i}`); state.instances[id] = { base: 'text.ui.buttons', owner: `function:perf-${i}`, label: `Text ${i}`, path: ['window:theme'] }; }
    const targets = controllerTargets(state);
    state = applyValue(state, targets, 'effect', ['electric-text', 'lightning'].includes(scenario) ? scenario : 'off', 'text');
    if (scenario === 'brightness') state = applyValue(state, targets, 'brightness', 3, 'text');
    if (scenario === 'glow') state = applyValue(state, targets, 'glow', 2, 'text');
    settings.appearance.controller = state;
    const layout = structuredClone(template.layout); layout.panels['@theme'] = true;
    const graph = emptyDocument();
    graph.entities = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, label: `Synthetic node ${i}`, aliases: [], notes: '' }));
    graph.placements = graph.entities.map((entity, i) => ({ id: `p${i}`, entityId: entity.id, parentId: null, position: { x: 0, y: 0 }, spatialPosition: { x: (i % 4) * 2, y: Math.floor(i / 4) * 2, z: 0 }, collapsed: false, hidden: false }));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ settings, layout, graph }) => {
      localStorage.clear(); localStorage.setItem('omnium.workspace.settings.v1', JSON.stringify(settings)); localStorage.setItem('omnium.ui.layout.v1', JSON.stringify(layout)); localStorage.setItem('omnium.atlas.v2', JSON.stringify(graph));
    }, { settings, layout, graph });
    await page.goto(url);
    await page.locator('[data-ui-inline-handle][data-ui-name="Visuals"]').first().waitFor({ state: 'attached', timeout: 30000 });
    await page.locator('[data-ui-inline-handle][data-ui-name="Visuals"]').first().evaluate(button => { if (button.getAttribute('aria-expanded') === 'false') button.click(); });
    await page.locator('.appearance-row').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(Number(arg('warmup', '3500')));
    if (scenario === 'selector') { await page.keyboard.press('q'); await page.keyboard.press('e'); await page.mouse.move(90, 30); await page.mouse.click(90, 30); }
    const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    const before = (await cdp.send('Performance.getMetrics')).metrics;
    const frame = await page.evaluate(() => new Promise(resolve => {
      const gaps = [], start = performance.now(); let previous = start;
      const tick = now => { gaps.push(now - previous); previous = now; if (now - start < 1800) requestAnimationFrame(tick); else { gaps.sort((a, b) => a - b); resolve({ frames: gaps.length, p95_ms: gaps[Math.floor(gaps.length * .95)], max_ms: gaps.at(-1) }); } }; requestAnimationFrame(tick);
    }));
    let pointer_ms;
    if (scenario === 'selector') { const start = Date.now(); for (let i = 0; i < 12; i++) await page.mouse.move(60 + i * 65, 30 + (i % 2) * 80); pointer_ms = Date.now() - start; }
    const click = await page.evaluate(() => new Promise(resolve => {
      const button = document.querySelector('[data-appearance-target="ui"] > .appearance-row > .appearance-target');
      const start = performance.now(); button.click(); requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
    }));
    const after = (await cdp.send('Performance.getMetrics')).metrics;
    const { profile } = await cdp.send('Profiler.stop'); writeFileSync(`${out}/${scenario}.cpuprofile`, JSON.stringify(profile));
    const metrics = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount'].map(name => [name, (after.find(item => item.name === name)?.value ?? 0) - (before.find(item => item.name === name)?.value ?? 0)]));
    const rendering = await page.evaluate(() => ({ uiEffectSources: document.querySelector(".window-sparkles")?.getAttribute("data-effect-sources"),
      elements: document.getElementsByTagName("*").length, textNodes: (() => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let count = 0; while (walker.nextNode()) count++; return count; })() }));
    rows.push({ scenario, pointer_ms, frame, click_to_two_raf_ms: click, metrics, rendering, errors });
    console.log(JSON.stringify(rows.at(-1))); await context.close();
  }
} finally { await browser.close(); }
writeFileSync(`${out}/summary.json`, JSON.stringify({ label, url, localTargets, viewport: '1366x900 DPR1', gpu: 'SwiftShader software rendering; relative local comparison only', rows }, null, 2));
