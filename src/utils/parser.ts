import type { EventKind, LifeEvent } from '../interface/money';
import { newEvent } from './simulation';

/** Deliberately limited local parser. Every inferred/default parameter is disclosed. */
export function parseLocalScenario(prompt: string) {
  const events: LifeEvent[] = [];
  const questions: string[] = [];
  const count = (value: string) =>
    Number(value) ||
    (
      {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
        十一: 11,
        十二: 12,
      } as Record<string, number>
    )[value] ||
    1;
  const monthMatch = prompt.match(
    /第\s*(\d+|十二|十一|[一二三四五六七八九十])\s*個?月/,
  );
  const month = monthMatch
    ? Math.max(1, Math.min(12, count(monthMatch[1])))
    : 1;
  const amount = (pattern: RegExp) => {
    const m = prompt.replace(/(\d),(?=\d{3})/g, '$1').match(pattern);
    return m
      ? Math.min(
          1e9,
          Math.round(
            Number(m[1]) * (m[2] === '萬' ? 10000 : m[2] === '千' ? 1000 : 1),
          ),
        )
      : null;
  };
  const add = (kind: EventKind) => {
    const event = newEvent(kind);
    event.start = month;
    if (kind !== 'expense' && kind !== 'unemployment')
      event.duration = 13 - month;
    events.push(event);
    return event;
  };
  if (/租|搬/.test(prompt)) {
    const event = add('rent');
    const rent = amount(/(?:租金|房租|月租)\s*(\d+(?:\.\d+)?)\s*(萬|千)?/);
    event.amount = rent ?? 12000;
    event.upfront =
      amount(/(?:押金|搬遷費|前期費用)\s*(\d+(?:\.\d+)?)\s*(萬|千)?/) ?? 24000;
    if (rent === null)
      questions.push('未提供明確租金，暫填每月額外 12,000 元，請確認。');
    questions.push(
      `押金與搬遷費合計暫採 ${event.upfront.toLocaleString('zh-TW')} 元，不假設退還；請確認。`,
    );
  }
  if (/失業|空窗|沒工作/.test(prompt)) {
    const event = add('unemployment');
    const duration = prompt.match(
      /(?:失業|空窗|沒工作)\s*(\d+|十二|十一|[一二三四五六七八九十])\s*個?月/,
    );
    event.duration = duration
      ? Math.max(1, Math.min(12, count(duration[1])))
      : 3;
    questions.push(
      `失業期間採 ${event.duration} 個月，薪資全部歸零，不計補助；請確認。`,
    );
  }
  if (/醫療|突發|維修/.test(prompt)) {
    const event = add('expense');
    event.amount =
      amount(
        /(?:醫療(?:費用|費)?|突發(?:支出)?|維修(?:費用|費)?)\s*(\d+(?:\.\d+)?)\s*(萬|千)?/,
      ) ?? 30000;
    questions.push(
      `一次性支出暫採 ${event.amount.toLocaleString('zh-TW')} 元，請確認。`,
    );
  }
  if (/加薪|減薪|收入下降|收入減少/.test(prompt)) {
    const event = add('income');
    const change = amount(
      /(?:加薪|減薪|收入下降|收入減少)\s*(\d+(?:\.\d+)?)\s*(萬|千)?/,
    );
    event.amount =
      (change ?? 5000) * (/減薪|收入下降|收入減少/.test(prompt) ? -1 : 1);
    questions.push(
      `收入每月調整 ${event.amount.toLocaleString('zh-TW')} 元。百分比尚不支援，請確認實際金額。`,
    );
  }
  if (!events.length)
    questions.push(
      '本機解析支援租屋、失業、收入變動及突發支出。其他事件請用範本或 AI 解析。',
    );
  questions.push(
    monthMatch
      ? `所有辨識到的事件暫採第 ${month} 個月生效，不同事件的日期請在編輯器逐一調整。`
      : '未指定月份，所有事件暫從第 1 個月開始。',
  );
  questions.push(
    '本機規則僅擷取有限格式；複雜條件請直接編輯參數，或使用 AI 解析後確認。',
  );
  return { events, questions };
}
