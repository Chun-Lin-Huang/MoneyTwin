import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('built UI: create scenario, change profile, save and restore report, reload persistence', async () => {
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  const script = await readFile(
    new URL(
      `../dist/assets/${assets.find((name) => name.endsWith('.js'))}`,
      import.meta.url,
    ),
    'utf8',
  );
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3001/#/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.structuredClone = structuredClone;
  w.fetch = async () => new Response('{}', { status: 503 });
  w.AbortSignal = AbortSignal;
  w.AbortController = AbortController;
  w.Request = Request;
  w.Response = Response;
  w.Headers = Headers;
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.eval(script);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
  const button = (text) =>
    [...w.document.querySelectorAll('button')].find(
      (b) =>
        b.textContent.includes(text) || b.getAttribute('aria-label') === text,
    );
  const click = async (text) => {
    const b = button(text);
    assert.ok(b, `Missing button: ${text}`);
    b.click();
    await settle();
  };
  const input = async (el, value) => {
    assert.ok(el);
    const proto =
      el.tagName === 'TEXTAREA'
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await settle();
  };
  await settle();
  assert.ok(w.document.body.textContent.includes('304,000'));
  assert.equal(w.document.querySelectorAll('.chart path[stroke]').length, 4);
  await click('建立新情境');
  await input(
    w.document.querySelector('textarea'),
    '第4個月搬出去住，每月租金12000，失業3個月',
  );
  await click('本機解析');
  assert.ok(
    w.document
      .querySelector('.parsed-result')
      .textContent.includes('辨識到 2 個事件'),
  );
  await click('確認並建立情境');
  assert.equal(
    w.document.querySelectorAll('.event-card').length,
    2,
    w.location.href + '\n' + w.document.body.textContent.slice(-2500),
  );
  assert.equal(
    w.document.querySelectorAll('.scenario-tabs .scenario-tab').length,
    5,
  );
  await click('財務數位分身');
  const income = [...w.document.querySelectorAll('label')]
    .find((el) => el.textContent.includes('每月實領收入'))
    .querySelector('input');
  await input(income, '40000');
  w.document
    .querySelector('form')
    .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(
    JSON.parse(w.localStorage.getItem('moneytwin-v1')).profile.income,
    40000,
  );
  await click('我的財務宇宙');
  assert.ok(w.document.body.textContent.includes('364,000'));
  await click('保存報告');
  await click('我的模擬報告');
  assert.equal(w.document.querySelectorAll('.reports-grid>.card').length, 1);
  assert.equal(
    JSON.parse(w.localStorage.getItem('moneytwin-v1')).reports.length,
    1,
  );
  await click('載入快照');
  assert.ok(w.document.body.textContent.includes('364,000'));
  await click('決策教練');
  await click('生成 AI 決策說明');
  assert.ok(
    w.document
      .querySelector('[role="alert"]')
      .textContent.includes('尚未設定模型服務'),
  );
  await click('資料與隱私設定');
  assert.ok(
    w.document
      .querySelector('[role="dialog"]')
      .textContent.includes('沒有加密'),
  );
  await click('關閉');
  assert.equal(w.document.querySelector('[role="dialog"]'), null);
  const stored = w.localStorage.getItem('moneytwin-v1');
  const reload = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3001/#/?view=reports',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  reload.window.localStorage.setItem('moneytwin-v1', stored);
  reload.window.scrollTo = () => {};
  reload.window.eval(script);
  await settle();
  assert.equal(
    reload.window.document.querySelectorAll('.reports-grid>.card').length,
    1,
  );
  assert.ok(reload.window.document.body.textContent.includes('364,000'));
  reload.window.close();
  dom.window.close();
});
