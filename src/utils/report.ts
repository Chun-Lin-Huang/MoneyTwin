import type { SavedReport } from '../interface/money';
import { explain, money, simulate } from './simulation';

const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
export function renderReport(report: SavedReport) {
  const results = report.scenarios.map((s) => simulate(report.profile, s));
  const { profile } = report;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MoneyTwin 模擬報告</title><style>body{font:14px/1.9 system-ui,sans-serif;color:#2f4939;background:#f7f8f3;max-width:1000px;margin:40px auto;padding:25px}h1{font-size:30px}h2{margin-top:40px}section{background:white;padding:25px;border:1px solid #dfe6d9;border-radius:12px;margin:22px 0}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:right;padding:9px;border-bottom:1px solid #e4e9dd}th:first-child,td:first-child{text-align:left}.muted{color:#7c8c70;font-size:12px}.scroll{overflow:auto}li{margin:10px 0}@media print{body{background:white;margin:0;padding:0}section{break-inside:avoid}table{font-size:10px}h2{break-after:avoid}a{color:inherit}.scroll{overflow:visible}}@page{size:A4;margin:15mm}</style></head><body><p class="muted">MONEYTWIN · 先模擬，再決策</p><h1>個人財務平行未來模擬報告</h1><p>${escape(report.name)}</p><p class="muted">快照時間：${escape(new Date(report.date).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))} · 引擎 v1.0 · 可使用瀏覽器列印功能另存 PDF</p><section><h2>共同財務起點</h2><p>起始月份 ${escape(profile.start)} ｜存款 NT$ ${money(profile.savings)} ｜月收入 NT$ ${money(profile.income)}<br>固定支出 NT$ ${money(profile.fixed)} ｜變動支出 NT$ ${money(profile.variable)} ｜負債付款 NT$ ${money(profile.debt)}<br>預備金門檻 ${profile.reserve} 個月支出 ｜目標「${escape(profile.goalName)}」NT$ ${money(profile.goal)}</p></section><section><h2>方案比較</h2><div class="scroll"><table><thead><tr><th>方案</th><th>期末餘額</th><th>最低餘額</th><th>首次預備金不足</th><th>首次資金缺口</th></tr></thead><tbody>${results.map((r) => `<tr><td>${escape(r.scenario.name)}</td><td>${money(r.end)}</td><td>${money(r.minimum)}</td><td>${r.firstWarning ? `第 ${r.firstWarning} 月` : '無'}</td><td>${r.firstDeficit ? `第 ${r.firstDeficit} 月` : '無'}</td></tr>`).join('')}</tbody></table></div></section>${results
    .map(
      (r) =>
        `<section><h2>${escape(r.scenario.name)}</h2><h3>情境假設</h3><pre style="white-space:pre-wrap;font-family:inherit;font-size:11px">${escape(JSON.stringify(r.scenario.events, null, 2))}</pre><h3>可追溯規則分析</h3><ol>${explain(
          r,
          results[0],
          profile,
        )
          .map((s) => `<li>${escape(s)}</li>`)
          .join(
            '',
          )}</ol><h3>逐月現金流</h3><p class="muted">期末餘額 = 期初餘額 + 收入 − 支出 − 負債付款 + 其他現金流</p><div class="scroll"><table><thead><tr><th>月份</th><th>期初</th><th>收入</th><th>支出</th><th>負債</th><th>其他</th><th>期末</th><th>安全門檻</th></tr></thead><tbody>${r.months.map((m) => `<tr>${[m.label, money(m.opening), money(m.income), money(m.expenses), money(m.debt), money(m.other), money(m.balance), money(m.threshold)].map((v) => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`,
    )
    .join(
      '',
    )}<p class="muted">本報告為情境模擬，並非預測、投資建議或保證結果。無利息與投資報酬假設，使用稅後收入，未另外推算稅額；押金不假設退還。本報告使用本機規則分析，不包含語言模型生成內容。</p></body></html>`;
}
