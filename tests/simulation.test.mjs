import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate,
  initialProfile,
  initialScenarios,
  maxAffordableRent,
  explain,
} from '../src/utils/simulation.ts';

const p = { ...initialProfile, start: '2026-11' };
const scenario = (events) => ({
  id: 'test',
  name: '測試',
  color: '#328775',
  events,
});
const event = (kind, extra = {}) => ({
  id: 'event',
  kind,
  amount: 0,
  start: 1,
  duration: 12,
  upfront: 0,
  ...extra,
});
test('proposal reference: 35k income, 18k expenses, 100k cash yields 304k', () => {
  const r = simulate(p, initialScenarios[0]);
  assert.equal(r.end, 304000);
  assert.equal(r.months.length, 12);
  assert.equal(r.months[2].label, '2027/01');
});
test('proposal reference: 12k monthly rent without upfront yields 160k', () =>
  assert.equal(
    simulate(p, scenario([event('rent', { amount: 12000 })])).end,
    160000,
  ));
test('deposit paid once; 3-month job gap removes exactly 105k', () => {
  const rent = simulate(p, initialScenarios[1]);
  const stress = simulate(p, initialScenarios[2]);
  assert.equal(rent.end, 136000);
  assert.equal(stress.end, 31000);
  assert.equal(stress.minimum, 1000);
  assert.equal(stress.minimumMonth, 6);
  assert.equal(stress.maxNegativeRun, 3);
  assert.equal(rent.firstWarning, 1);
});
test('overlapping unemployment does not double subtract income', () =>
  assert.equal(
    simulate(
      p,
      scenario([
        event('unemployment', { duration: 3 }),
        event('unemployment', { start: 2, duration: 2 }),
      ]),
    ).end,
    199000,
  ));
test('single expense is charged once even with longer duration', () =>
  assert.equal(
    simulate(p, scenario([event('expense', { amount: 10000, duration: 12 })]))
      .end,
    294000,
  ));
test('event starts in final month and stays within simulation horizon', () =>
  assert.equal(
    simulate(
      p,
      scenario([event('rent', { amount: 10000, start: 12, upfront: 20000 })]),
    ).end,
    274000,
  ));
test('income cannot become negative, debt is included in cash and threshold', () => {
  const r = simulate(
    { ...p, debt: 3000 },
    scenario([event('income', { amount: -50000 })]),
  );
  assert.equal(r.months[0].income, 0);
  assert.equal(r.end, -152000);
  assert.equal(r.months[0].threshold, 63000);
  assert.equal(r.firstDeficit, 5);
});
test('each ledger row reconciles and minimum excludes initial cash', () => {
  for (const s of initialScenarios)
    for (const m of simulate(p, s).months)
      assert.equal(
        m.balance,
        m.opening + m.income - m.expenses - m.debt + m.other,
      );
});
test('rent threshold is safe and one more dollar fails', () => {
  const s = initialScenarios[1];
  const max = maxAffordableRent(p, s);
  assert.equal(max, 9750);
  const withRent = (amount) =>
    simulate(p, { ...s, events: [{ ...s.events[0], amount }] }).months.every(
      (m) => m.balance >= m.threshold,
    );
  assert.ok(withRent(max));
  assert.ok(!withRent(max + 1));
});
test('zero spending and no income is finite and stable', () => {
  const r = simulate(
    { ...p, income: 0, fixed: 0, variable: 0, debt: 0 },
    scenario([]),
  );
  assert.equal(r.end, 100000);
  assert.equal(r.firstWarning, null);
  assert.ok(r.months.every((m) => m.coverage === null));
});
test('explanations use computed results', () => {
  const b = simulate(p, initialScenarios[0]);
  const r = simulate(p, initialScenarios[2]);
  const text = explain(r, b, p).join(' ');
  assert.ok(text.includes('31,000'));
  assert.ok(text.includes('273,000'));
  assert.ok(text.includes('1,000'));
});
