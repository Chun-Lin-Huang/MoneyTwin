import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
test('coach rejects financial numbers absent from engine facts', async () =>
  withServer(
    {
      endpoint: 'http://model/api/chat',
      model: 'test',
      fetchModel: async () =>
        Response.json({ message: { content: '保證獲得 999999 元' } }),
    },
    async (url) =>
      assert.equal(
        (
          await post(url + '/api/coach', {
            scenario: 'test',
            facts: ['a', 'b', 'c', 'd'],
          })
        ).status,
        502,
      ),
  ));
async function withServer(options, run) {
  const app = createApp(options);
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${app.address().port}`);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}
const post = (url, data) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
test('unconfigured provider returns honest 503 and health status', async () =>
  withServer({ endpoint: '', model: '' }, async (url) => {
    assert.equal(
      (await (await fetch(url + '/api/health')).json()).ready,
      false,
    );
    assert.equal((await post(url + '/api/coach', {})).status, 503);
  }));
test('coach adapter sends supplied facts and returns model metadata', async () =>
  withServer(
    {
      endpoint: 'http://model/api/chat',
      model: 'test',
      fetchModel: async (_url, init) => {
        const body = JSON.parse(init.body);
        assert.equal(body.stream, false);
        assert.equal(body.model, 'test');
        return Response.json({ message: { content: '模型說明' } });
      },
    },
    async (url) => {
      const r = await post(url + '/api/coach', {
        scenario: '租屋',
        facts: ['a', 'b', 'c', 'd'],
      });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).promptVersion, 'coach-v1');
    },
  ));
test('parser rejects invalid model parameters before reaching UI', async () =>
  withServer(
    {
      endpoint: 'http://model/api/chat',
      model: 'test',
      fetchModel: async () =>
        Response.json({
          message: {
            content: JSON.stringify({
              events: [
                {
                  kind: 'rent',
                  amount: -1,
                  start: 50,
                  duration: 1,
                  upfront: 0,
                },
              ],
              questions: [],
            }),
          },
        }),
    },
    async (url) =>
      assert.equal(
        (await post(url + '/api/parse', { prompt: '租屋' })).status,
        502,
      ),
  ));
test('valid parser response is available for user confirmation', async () =>
  withServer(
    {
      endpoint: 'http://model/api/chat',
      model: 'test',
      fetchModel: async () =>
        Response.json({
          message: {
            content: JSON.stringify({
              events: [
                {
                  kind: 'rent',
                  amount: 12000,
                  start: 1,
                  duration: 12,
                  upfront: 24000,
                },
              ],
              questions: ['請確認押金'],
            }),
          },
        }),
    },
    async (url) => {
      const r = await post(url + '/api/parse', { prompt: '租屋' });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).events[0].amount, 12000);
    },
  ));
test('invalid requests and external origins are rejected', async () =>
  withServer(
    { endpoint: 'http://model/api/chat', model: 'test' },
    async (url) => {
      assert.equal((await post(url + '/api/coach', null)).status, 400);
      assert.equal((await post(url + '/api/parse', { prompt: 3 })).status, 400);
      assert.equal(
        (
          await fetch(url + '/api/coach', {
            method: 'POST',
            headers: { Origin: 'https://untrusted.example' },
          })
        ).status,
        403,
      );
    },
  ));
