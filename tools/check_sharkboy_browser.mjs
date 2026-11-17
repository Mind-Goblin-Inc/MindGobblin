// Run with Playwright installed separately; see SharkBoyEmulator.md.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir} from 'node:fs/promises';

const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:8080';
const artifacts = process.env.SHARKBOY_ARTIFACTS || '/tmp/sharkboy-browser-results';
await mkdir(artifacts, {recursive: true});

async function instrument(page) {
  await page.addInitScript(() => {
    window.__audio = {callbacks: 0, nonzero: 0, peak: 0};
    const Original = window.AudioContext || window.webkitAudioContext;
    if (!Original) return;
    const create = Original.prototype.createScriptProcessor;
    Original.prototype.createScriptProcessor = function (...args) {
      const node = create.apply(this, args);
      // SDL assigns its callback immediately after createScriptProcessor returns.
      // Attach after that assignment, then read the buffer after SDL has filled it.
      queueMicrotask(() => node.addEventListener('audioprocess', event => {
        const samples = event.outputBuffer.getChannelData(0);
        const data = window.__audio;
        data.callbacks++;
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        data.peak = peak;
        if (peak > 0.00001) data.nonzero++;
      }));
      return node;
    };
  });
}
async function boot(page) {
  await page.goto(base + '/SharkBoyEmulator/');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#game').dataset.screen === '1', {timeout: 30000});
  assert.equal(await page.locator('#cartridge option').count(), 16);
  await page.waitForTimeout(400);
}
async function selected(page, index, screen) {
  await page.locator('#cartridge').selectOption(String(index));
  await page.waitForFunction(({index, screen}) => {
    const state = document.querySelector('#game').dataset;
    return state.selected === String(index) && state.screen === String(screen);
  }, {index, screen}, {timeout: 15000});
  await page.waitForTimeout(250);
}
async function tap(page, code, duration = 100) {
  await page.keyboard.down(code);
  await page.waitForTimeout(duration);
  await page.keyboard.up(code);
  await page.waitForTimeout(100);
}
async function menu(page) {
  await page.locator('#menu').click();
  await page.waitForFunction(() => document.querySelector('#game').dataset.screen === '1');
  await page.waitForTimeout(250);
}

async function gameLinks(engine, mobile = false) {
  const browser = await engine.launch({headless: true});
  try {
    const page = await browser.newPage(mobile ? {
      viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true
    } : {viewport: {width: 1200, height: 1050}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base + '/');
    const links = await page.locator('a[data-project][href^="SharkBoyEmulator/?game="]').evaluateAll(
      elements => elements.map(element => ({href: element.getAttribute('href'), title: element.querySelector('.project-name-text').textContent}))
    );
    assert.equal(links.length, 13);
    assert.equal(new Set(links.map(link => link.href)).size, 13);
    await page.waitForFunction(() => document.querySelector('#searchCount').textContent === '47 games & projects');
    assert.equal(await page.locator('#Games [data-section-count]').textContent(), '27 games');
    await page.locator('#projectSearch').fill('Deep Vector');
    assert.equal(await page.locator('[data-project]:visible').count(), 1);
    await page.locator('#clearSearch').click();
    for (const {href, title} of links) {
      await page.locator(`a[data-project][href="${href}"]`).click();
      // No click on Play arcade: the homepage link must launch the game itself.
      await page.waitForFunction(() => document.querySelector('#game')?.dataset.screen === '2', {timeout: 30000});
      assert.equal(await page.locator('#cartridge option:checked').textContent(), title.toUpperCase());
      assert.equal(await page.locator('#overlay').isVisible(), false);
      assert.equal(await page.locator('#game').getAttribute('data-paused'), 'false');
      await page.locator('#game').press('d');
      await menu(page);
      assert.equal(await page.locator('#cartridge option:checked').textContent(), title.toUpperCase());
      await page.goto(base + '/');
    }
    // Reloading a bookmark keeps the requested game; unrelated query keys work too.
    await page.goto(base + '/SharkBoyEmulator/?from=home&game=deep-vector');
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.waitForFunction(() => document.querySelector('#game')?.dataset.screen === '2', {timeout: 30000});
      assert.equal(await page.locator('#cartridge option:checked').textContent(), 'DEEP VECTOR');
      if (!attempt) await page.reload();
    }
    // Unrecognized names and tool names must retain the normal manual start screen.
    for (const value of ['', 'unknown', 'settings', 'music-player', '0', '<img src=x onerror=alert(1)>']) {
      await page.goto(base + '/SharkBoyEmulator/?game=' + encodeURIComponent(value));
      await page.waitForTimeout(200);
      assert(await page.locator('#start').isEnabled());
      assert.match(await page.locator('#start').textContent(), /Play arcade/);
      assert.equal(await page.locator('#game').getAttribute('data-screen'), null);
    }
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.screen === '1', {timeout: 30000});
    assert.deepEqual(errors, []);
    console.log(`${engine.name()}${mobile ? ' mobile' : ''}: all 13 homepage links auto-launch, search/counts, reload and invalid names passed`);
  } finally { await browser.close(); }
}

async function desktop() {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1200, height: 1050}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await instrument(page);
    await boot(page);
    await page.screenshot({path: artifacts + '/desktop.png', fullPage: true});
    const names = await page.locator('#cartridge option').allTextContents();
    // Real keyboard navigation and the native insertion animation.
    await tap(page, 'ArrowDown');
    await page.waitForFunction(() => document.querySelector('#game').dataset.selected === '1');
    await tap(page, 'd');
    await page.waitForFunction(() => document.querySelector('#game').dataset.screen === '2');
    await menu(page);
    console.log('Chromium: boot, 16 cartridges, keyboard navigation and insertion passed');
    for (let index = 0; index < 13; index++) {
      await selected(page, index, 2);
      const before = createHash('sha256').update(await page.locator('#game').screenshot()).digest('hex');
      await tap(page, 'd');
      await tap(page, 'd');
      await tap(page, 'w', 220);
      await tap(page, 'ArrowDown', 220);
      await tap(page, 'a');
      await page.waitForTimeout(450);
      const after = createHash('sha256').update(await page.locator('#game').screenshot()).digest('hex');
      assert.notEqual(after, before, names[index] + ': no visible response to controls');
      assert.equal(await page.locator('#game').getAttribute('data-screen'), '2', names[index]);
      await page.locator('#restart').click();
      await page.waitForFunction(() => document.querySelector('#game').dataset.screen === '1');
      await page.waitForFunction(index => {
        const state = document.querySelector('#game').dataset;
        return state.screen === '2' && state.selected === String(index);
      }, index);
      await menu(page);
      console.log('Chromium game launch/input/restart/return:', names[index]);
    }
    // Music produces nonzero output, then mute and pause produce silence.
    await selected(page, 13, 3);
    await page.waitForFunction(() => window.__audio.nonzero > 3, {timeout: 10000});
    const sounding = await page.evaluate(() => ({...window.__audio}));
    assert(sounding.callbacks > 0);
    await page.locator('#sound').click();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__audio.peak), 0);
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.__audio.peak > 0);
    await page.locator('#pause').click();
    await page.waitForTimeout(250);
    const time = Number(await page.locator('#game').getAttribute('data-time'));
    await page.waitForTimeout(1000);
    assert.equal(Number(await page.locator('#game').getAttribute('data-time')), time, 'Paused game clock advanced');
    assert.equal(await page.evaluate(() => window.__audio.peak), 0);
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.paused === 'false');
    await page.waitForFunction(() => window.__audio.peak > 0);
    await selected(page, 14, 4);
    await page.locator('#game').click({position: {x: 100, y: 110}});
    await selected(page, 15, 5);
    // Held aliases and focus loss must release the actual simulated pins.
    await page.locator('#game').focus();
    await page.keyboard.down('a'); await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('a');
    await page.waitForFunction(() => Number(document.querySelector('#game').dataset.input) === 16);
    await page.locator('#sound').focus();
    await page.waitForFunction(() => document.querySelector('#game').dataset.input === '0');
    await page.keyboard.up('ArrowLeft');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('#game').dataset.paused === 'true');
    await page.locator('#start').click();
    await menu(page);
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.deepEqual(errors, []);
    console.log('Chromium: music output, mute, frozen pause clock, resume, tools, alias release, blur, fullscreen passed');
  } finally { await browser.close(); }
}

async function mobile() {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await boot(page);
    await selected(page, 15, 5);
    await page.locator('.touch-controls').scrollIntoViewIfNeeded();
    const session = await page.context().newCDPSession(page);
    const point = async selector => {
      const box = await page.locator(selector).boundingBox();
      return {x: box.x + box.width / 2, y: box.y + box.height / 2, radiusX: 4, radiusY: 4, force: 1};
    };
    const left = {...await point('[data-control="0"]'), id: 1};
    const right = {...await point('[data-control="5"]'), id: 2};
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [left, right]});
    await page.waitForFunction(() => document.querySelector('#game').dataset.input === '33');
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: [left]});
    await page.waitForFunction(() => document.querySelector('#game').dataset.input === '32');
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForFunction(() => document.querySelector('#game').dataset.input === '0');
    await menu(page);
    await page.screenshot({path: artifacts + '/mobile.png', fullPage: true});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({width: 320, height: 740});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow mobile overflow');
    console.log('Mobile Chromium: simultaneous real touch, independent release, 390px and 320px layout passed');
  } finally { await browser.close(); }
}

async function safariEngine() {
  const browser = await webkit.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1100, height: 1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await instrument(page);
    await boot(page);
    await selected(page, 1, 2);
    await tap(page, 'd');
    await menu(page);
    await selected(page, 13, 3);
    await page.waitForFunction(() => window.__audio.nonzero > 2, {timeout: 10000});
    await page.locator('#pause').click();
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.paused === 'false');
    assert.deepEqual(errors, []);
    console.log('WebKit: boot, Pong, return, audible-sample generation, pause/resume passed');
  } finally { await browser.close(); }
}

async function fallbacks() {
  const browser = await chromium.launch({headless: true});
  try {
    const blocked = await browser.newPage();
    await blocked.route('**/sharkboy.wasm', route => route.abort());
    await blocked.goto(base + '/SharkBoyEmulator/');
    await blocked.locator('#start').click();
    await blocked.waitForFunction(() => document.querySelector('#start').textContent === 'Reload arcade');
    assert.match(await blocked.locator('#status').textContent(), /could not|couldn’t|stopped|Could not/);
    await blocked.close();
    const silent = await browser.newPage();
    await silent.addInitScript(() => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    });
    await boot(silent);
    assert(await silent.locator('#audio-status').isVisible());
    await selected(silent, 1, 2);
    await tap(silent, 'd');
    console.log('Chromium fallback checks: failed download has a retry message; missing Web Audio permits muted play');
  } finally { await browser.close(); }
}

const checks = (process.env.SHARKBOY_CHECKS || 'links,desktop,mobile,webkit,fallbacks').split(',');
if (checks.includes('links')) {
  await gameLinks(chromium);
  await gameLinks(chromium, true);
  await gameLinks(webkit);
}
if (checks.includes('desktop')) await desktop();
if (checks.includes('mobile')) await mobile();
if (checks.includes('webkit')) await safariEngine();
if (checks.includes('fallbacks')) await fallbacks();
console.log('SharkBoy browser checks passed. Screenshots:', artifacts);
