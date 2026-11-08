import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthKey,
  monthLabel,
  normalizeAmount,
  isValidAmount,
  daysElapsedInMonth,
  sumByType,
  monthSummary,
  averageDailyExpense,
  getBudget,
  setBudget,
  isValidTransaction,
  normalizeData,
  parseImport,
  exportPayload
} from '../src/ledger.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
};

const now = new Date(2026, 10, 8, 12, 0, 0);

const transactions = [
  { id: '1', type: 'expense', amount: 100, category: 'food', note: '早餐', date: new Date(2026, 10, 1, 9).toISOString() },
  { id: '2', type: 'expense', amount: 50, category: 'transport', note: '打车', date: new Date(2026, 10, 8, 8).toISOString() },
  { id: '3', type: 'income', amount: 5000, category: 'salary', note: '', date: new Date(2026, 10, 5, 10).toISOString() },
  { id: '4', type: 'expense', amount: 999, category: 'shopping', note: '旧月份', date: new Date(2026, 9, 20, 10).toISOString() },
  { id: '5', type: 'expense', amount: 30, category: 'food', note: '昨天', date: new Date(2026, 10, 7, 20).toISOString() }
];

test('monthKey and monthLabel', () => {
  assert.equal(monthKey(now), '2026-11');
  assert.equal(monthKey('2026-01-15T00:00:00'), '2026-01');
  assert.equal(monthLabel('2026-11'), '2026年11月');
  assert.equal(monthLabel('bad'), 'bad');
});

test('amount normalization and validation', () => {
  assert.equal(normalizeAmount('12.345'), 12.35);
  assert.equal(normalizeAmount(-1), 0);
  assert.equal(normalizeAmount('abc'), 0);
  assert.equal(normalizeAmount(Infinity), 0);
  assert.equal(isValidAmount('0.01'), true);
  assert.equal(isValidAmount(0), false);
  assert.equal(isValidAmount(-5), false);
  assert.equal(isValidAmount('x'), false);
  assert.equal(isValidAmount('12abc'), false);
  assert.equal(normalizeAmount('12abc'), 0);
});

test('monthly totals only include the requested month', () => {
  assert.equal(daysElapsedInMonth(now), 8);
  assert.equal(sumByType(transactions, 'expense', '2026-11'), 180);
  assert.equal(sumByType(transactions, 'income', '2026-11'), 5000);
  assert.deepEqual(monthSummary(transactions, '2026-11'), {
    income: 5000,
    expense: 180,
    balance: 4820
  });
});

test('average daily expense uses current month expense and elapsed days', () => {
  closeTo(averageDailyExpense(transactions, now), 180 / 8);
  closeTo(averageDailyExpense(transactions, new Date(2026, 10, 30, 12)), 180 / 30);
  closeTo(averageDailyExpense([], now), 0);
  closeTo(averageDailyExpense(transactions, new Date(2025, 0, 1, 12)), 0);
});

test('budgets are stored per month and can be cleared', () => {
  let budgets = {};
  budgets = setBudget(budgets, '2026-11', 3000);
  budgets = setBudget(budgets, '2026-12', '1500.555');
  assert.equal(getBudget(budgets, '2026-11'), 3000);
  assert.equal(getBudget(budgets, '2026-12'), 1500.56);
  assert.equal(getBudget(budgets, '2026-10'), 0);

  budgets = setBudget(budgets, '2026-11', 0);
  assert.equal(getBudget(budgets, '2026-11'), 0);
  assert.equal('2026-11' in budgets, false);
});

test('transaction validation rejects malformed entries', () => {
  assert.equal(isValidTransaction(transactions[0]), true);
  assert.equal(isValidTransaction({ ...transactions[0], type: 'other' }), false);
  assert.equal(isValidTransaction({ ...transactions[0], amount: 0 }), false);
  assert.equal(isValidTransaction({ ...transactions[0], category: '' }), false);
  assert.equal(isValidTransaction({ ...transactions[0], date: 'not-a-date' }), false);
  assert.equal(isValidTransaction(null), false);
});

test('normalizeData migrates legacy budget and sanitizes records', () => {
  const migrated = normalizeData({
    budget: 2000,
    transactions: [
      transactions[0],
      { ...transactions[1], id: undefined },
      { id: 'bad', type: 'expense', amount: -1, category: 'food', date: new Date().toISOString() }
    ]
  }, now);

  assert.equal(migrated.transactions.length, 2);
  assert.equal(migrated.transactions[0].note, '早餐');
  assert.equal(migrated.transactions[1].id, 'imported-1');
  assert.equal(migrated.budgets['2026-11'], 2000);

  const modern = normalizeData({
    budgets: { '2026-11': 1200, 'bad-key': 50, '2026-12': -1 },
    transactions: []
  }, now);
  assert.deepEqual(modern.budgets, { '2026-11': 1200 });
});

test('parseImport validates JSON payloads', () => {
  assert.throws(() => parseImport(''), /文件内容为空/);
  assert.throws(() => parseImport('{bad json'), /JSON 格式错误/);
  assert.throws(() => parseImport('{"foo":1}'), /缺少 transactions 数组/);
  assert.throws(() => parseImport('{"transactions":[{"type":"bad"}]}'), /没有可导入的有效记录/);

  const imported = parseImport(JSON.stringify({
    transactions: [transactions[0]],
    budgets: { '2026-11': 800 }
  }));
  assert.equal(imported.transactions.length, 1);
  assert.equal(imported.transactions[0].amount, 100);
  assert.equal(imported.budgets['2026-11'], 800);
});

test('exportPayload produces a restorable snapshot', () => {
  const payload = exportPayload({ transactions, budgets: { '2026-11': 3000 } }, now);
  assert.equal(payload.app, 'easy-ledger');
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, now.toISOString());

  const restored = parseImport(JSON.stringify(payload));
  assert.equal(restored.transactions.length, transactions.length);
  assert.equal(restored.budgets['2026-11'], 3000);
});
