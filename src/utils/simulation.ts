import type { LifeEvent, Profile, Result, Scenario } from '../interface/money';

export const money = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);
export const initialProfile: Profile = {
  name: '我的財務分身',
  income: 35000,
  fixed: 12000,
  variable: 6000,
  savings: 100000,
  debt: 0,
  reserve: 3,
  goal: 300000,
  goalName: '第一桶金',
  start: new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()),
};
export const kinds = {
  rent: {
    label: '搬家租屋',
    icon: '⌂',
    description: '租金、押金與搬遷支出',
    amount: 12000,
    duration: 12,
    upfront: 24000,
  },
  unemployment: {
    label: '短期失業',
    icon: '↘',
    description: '暫停薪資，測試財務韌性',
    amount: 0,
    duration: 3,
    upfront: 0,
  },
  income: {
    label: '收入變動',
    icon: '↗',
    description: '加薪、轉職或收入減少',
    amount: -5000,
    duration: 12,
    upfront: 0,
  },
  expense: {
    label: '突發支出',
    icon: '✚',
    description: '醫療、維修與一次性開銷',
    amount: 30000,
    duration: 1,
    upfront: 0,
  },
  cost: {
    label: '生活成本增加',
    icon: '◈',
    description: '交通、物價或固定費用',
    amount: 3000,
    duration: 12,
    upfront: 0,
  },
  study: {
    label: '進修計畫',
    icon: '▤',
    description: '每月學費與報名費',
    amount: 5000,
    duration: 6,
    upfront: 10000,
  },
};
export const newEvent = (kind: LifeEvent['kind']): LifeEvent => ({
  id: crypto.randomUUID(),
  kind,
  amount: kinds[kind].amount,
  start: 1,
  duration: kinds[kind].duration,
  upfront: kinds[kind].upfront,
});
export const initialScenarios: Scenario[] = [
  { id: 'base', name: '維持現況', color: '#8c9aa7', events: [] },
  {
    id: 'rent',
    name: '搬出去，開始新生活',
    color: '#328775',
    events: [
      {
        id: 'rent-event',
        kind: 'rent',
        amount: 12000,
        start: 1,
        duration: 12,
        upfront: 24000,
      },
    ],
  },
  {
    id: 'stress',
    name: '租屋＋3 個月職涯空窗',
    color: '#d39955',
    events: [
      {
        id: 'stress-rent',
        kind: 'rent',
        amount: 12000,
        start: 1,
        duration: 12,
        upfront: 24000,
      },
      {
        id: 'stress-job',
        kind: 'unemployment',
        amount: 0,
        start: 4,
        duration: 3,
        upfront: 0,
      },
    ],
  },
];
export function simulate(profile: Profile, scenario: Scenario): Result {
  let balance = profile.savings;
  let negativeRun = 0;
  let maxNegativeRun = 0;
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    let income = profile.income;
    let expenses = profile.fixed + profile.variable;
    let other = 0;
    const details: string[] = [];
    const active = scenario.events.filter(
      (e) => month >= e.start && month < e.start + e.duration,
    );
    for (const e of active) {
      if (e.kind === 'income') {
        income += e.amount;
        details.push(`收入調整 ${money(e.amount)}`);
      }
      if (e.kind === 'rent' || e.kind === 'cost' || e.kind === 'study') {
        expenses += e.amount;
        details.push(`${kinds[e.kind].label} −${money(e.amount)}`);
      }
      if (e.kind === 'expense' && month === e.start) {
        other -= e.amount;
        details.push(`一次性支出 −${money(e.amount)}`);
      }
      if (month === e.start && e.upfront) {
        other -= e.upfront;
        details.push(`前期費用 −${money(e.upfront)}`);
      }
    }
    income = Math.max(0, income);
    if (active.some((e) => e.kind === 'unemployment')) {
      income = 0;
      details.push('失業期間：薪資收入歸零');
    }
    const opening = balance;
    const net = income - expenses - profile.debt + other;
    balance = Math.round(balance + net);
    negativeRun = net < 0 ? negativeRun + 1 : 0;
    maxNegativeRun = Math.max(maxNegativeRun, negativeRun);
    const cost = expenses + profile.debt;
    const date = new Date(`${profile.start}-01T12:00:00`);
    date.setMonth(date.getMonth() + i);
    return {
      month,
      label: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`,
      opening,
      income,
      expenses,
      debt: profile.debt,
      other,
      net,
      balance,
      threshold: cost * profile.reserve,
      coverage: cost > 0 ? Math.max(0, balance / cost) : null,
      details,
    };
  });
  const minimum = Math.min(...months.map((m) => m.balance));
  return {
    scenario,
    months,
    end: balance,
    minimum,
    minimumMonth: months.find((m) => m.balance === minimum)!.month,
    firstWarning: months.find((m) => m.balance < m.threshold)?.month ?? null,
    firstDeficit: months.find((m) => m.balance < 0)?.month ?? null,
    warningMonths: months.filter((m) => m.balance < m.threshold).length,
    maxNegativeRun,
  };
}
export function explain(
  result: Result,
  baseline: Result,
  profile: Profile,
): string[] {
  return [
    `「${result.scenario.name}」12 個月後預估餘額為 NT$ ${money(result.end)}，比維持現況${result.end >= baseline.end ? '增加' : '減少'} NT$ ${money(Math.abs(result.end - baseline.end))}。`,
    `最低餘額出現在第 ${result.minimumMonth} 個月，為 NT$ ${money(result.minimum)}。${result.firstWarning ? `第 ${result.firstWarning} 個月起低於 ${profile.reserve} 個月支出的預備金門檻，全年共 ${result.warningMonths} 個月低於門檻。` : `每個月皆維持在 ${profile.reserve} 個月支出的預備金門檻以上。`}`,
    result.firstDeficit
      ? `第 ${result.firstDeficit} 個月首次出現資金缺口。若要維持每月安全水位，起始存款至少需要再增加 NT$ ${money(Math.max(0, ...result.months.map((m) => m.threshold - m.balance)))}。`
      : `維持每月安全水位所需的額外起始準備金為 NT$ ${money(Math.max(0, ...result.months.map((m) => m.threshold - m.balance)))}。可嘗試降低固定支出或延後高額事件，再比較結果。`,
    `目標「${profile.goalName}」：期末${result.end >= profile.goal ? '已達標' : `仍差 NT$ ${money(profile.goal - result.end)}`}。此結果未計入利息、投資報酬、稅額變化或未建檔事件；押金視為支出，未假設退還。`,
  ];
}
export function maxAffordableRent(profile: Profile, scenario: Scenario) {
  const rent = scenario.events.find((e) => e.kind === 'rent');
  if (!rent) return null;
  let lo = 0;
  let hi = 1000000000;
  const safe = (amount: number) =>
    simulate(profile, {
      ...scenario,
      events: scenario.events.map((e) =>
        e.id === rent.id ? { ...e, amount } : e,
      ),
    }).months.every((m) => m.balance >= m.threshold);
  if (!safe(0)) return -1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (safe(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
