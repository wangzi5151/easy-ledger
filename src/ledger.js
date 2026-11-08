export function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function monthKey(value = new Date()) {
  const date = toDate(value) || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!match) return String(key || '');
  return `${match[1]}年${Number(match[2])}月`;
}

export function normalizeAmount(value) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100) / 100;
}

export function isValidAmount(value) {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function daysElapsedInMonth(value = new Date()) {
  const date = toDate(value) || new Date();
  return date.getDate();
}

export function sumByType(transactions, type, key) {
  if (!Array.isArray(transactions)) return 0;
  return transactions
    .filter(t => t && t.type === type && monthKey(t.date) === key)
    .reduce((sum, t) => sum + normalizeAmount(t.amount), 0);
}

export function monthSummary(transactions, key = monthKey(new Date())) {
  const income = sumByType(transactions, 'income', key);
  const expense = sumByType(transactions, 'expense', key);
  return { income, expense, balance: income - expense };
}

export function averageDailyExpense(transactions, now = new Date()) {
  const key = monthKey(now);
  const elapsedDays = daysElapsedInMonth(now);
  if (elapsedDays <= 0) return 0;
  return sumByType(transactions, 'expense', key) / elapsedDays;
}

export function getBudget(budgets, key) {
  if (!budgets || typeof budgets !== 'object') return 0;
  const value = Number(budgets[key]);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

export function setBudget(budgets, key, value) {
  const next = budgets && typeof budgets === 'object' && !Array.isArray(budgets)
    ? { ...budgets }
    : {};
  const amount = normalizeAmount(value);
  if (amount > 0) {
    next[key] = amount;
  } else {
    delete next[key];
  }
  return next;
}

export function isValidTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') return false;
  if (transaction.type !== 'income' && transaction.type !== 'expense') return false;
  if (!isValidAmount(transaction.amount)) return false;
  if (typeof transaction.category !== 'string' || !transaction.category) return false;
  if (typeof transaction.date !== 'string' || Number.isNaN(Date.parse(transaction.date))) return false;
  return true;
}

export function normalizeData(raw, now = new Date()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const transactions = Array.isArray(source.transactions)
    ? source.transactions.filter(isValidTransaction).map((transaction, index) => ({
        id: typeof transaction.id === 'string' && transaction.id
          ? transaction.id
          : `imported-${index}`,
        type: transaction.type,
        amount: normalizeAmount(transaction.amount),
        category: transaction.category,
        note: typeof transaction.note === 'string' ? transaction.note : '',
        date: new Date(transaction.date).toISOString()
      }))
    : [];

  let budgets = {};
  const hasBudgets = source.budgets
    && typeof source.budgets === 'object'
    && !Array.isArray(source.budgets);

  if (hasBudgets) {
    for (const [key, value] of Object.entries(source.budgets)) {
      if (/^\d{4}-\d{2}$/.test(key) && isValidAmount(value)) {
        budgets[key] = normalizeAmount(value);
      }
    }
  } else if (isValidAmount(source.budget)) {
    budgets[monthKey(now)] = normalizeAmount(source.budget);
  }

  return { transactions, budgets };
}

export function parseImport(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('文件内容为空');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error('JSON 格式错误');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
    throw new Error('缺少 transactions 数组');
  }

  const validCount = parsed.transactions.filter(isValidTransaction).length;
  if (parsed.transactions.length > 0 && validCount === 0) {
    throw new Error('没有可导入的有效记录');
  }

  return normalizeData(parsed);
}

export function exportPayload(data, now = new Date()) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    app: 'easy-ledger',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    budgets: source.budgets && typeof source.budgets === 'object' ? source.budgets : {}
  };
}
