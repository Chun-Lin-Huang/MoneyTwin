import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(
  new URL('../src/utils/parser.ts', import.meta.url),
  'utf8',
);
const js = ts
  .transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  })
  .outputText.replace(
    /['"]\.\/simulation['"]/,
    JSON.stringify(new URL('../src/utils/simulation.ts', import.meta.url).href),
  );
const { parseLocalScenario } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);
test('local parser keeps amounts separate across rent, salary and emergencies', () => {
  const r = parseLocalScenario(
    '第4個月租金1.2萬，押金24000，失業三個月，醫療費30000，減薪5000',
  );
  assert.deepEqual(
    r.events.map((e) => e.amount),
    [12000, 0, 30000, -5000],
  );
  assert.equal(r.events[1].duration, 3);
  assert.ok(r.events.every((e) => e.start === 4));
  assert.ok(r.questions.length > 0);
});
test('unknown requests are not silently turned into financial events', () =>
  assert.equal(parseLocalScenario('我想過更好的生活').events.length, 0));
test('missing parameters explicitly disclose defaults', () => {
  const r = parseLocalScenario('想搬家');
  assert.equal(r.events[0].amount, 12000);
  assert.ok(r.questions.some((q) => q.includes('未提供')));
  assert.ok(r.questions.some((q) => q.includes('未指定')));
});
