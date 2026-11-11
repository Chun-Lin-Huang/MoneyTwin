import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('report safely escapes user text and includes all monthly calculations', async () => {
  // Transpile the HTML exporter in memory; replace its one runtime import with an absolute URL.
  const source = await readFile(
    new URL('../src/utils/report.ts', import.meta.url),
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
      JSON.stringify(
        new URL('../src/utils/simulation.ts', import.meta.url).href,
      ),
    );
  const { renderReport } = await import(
    'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  );
  const { initialProfile, initialScenarios } =
    await import('../src/utils/simulation.ts');
  const html = renderReport({
    id: 'a',
    date: '2026-11-11T00:00:00Z',
    name: '<script>alert(1)</script>',
    profile: initialProfile,
    scenarios: initialScenarios,
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('304,000'));
  assert.ok(html.includes('136,000'));
  assert.ok(html.includes('31,000'));
  assert.equal((html.match(/<tr>/g) || []).length, 43);
});
