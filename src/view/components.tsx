import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Result } from '../interface/money';
import { money } from '../utils/simulation';
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function NumberField({
  label,
  value,
  onChange,
  max = 1000000000,
  min = 0,
  suffix = '元',
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  min?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-input">
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          required
          value={value}
          onChange={(e) =>
            onChange(
              Math.min(max, Math.max(min, Math.round(Number(e.target.value)))),
            )
          }
        />
        <span>{suffix}</span>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Chart({
  results,
  selected,
  onSelect,
  goal,
}: {
  results: Result[];
  selected: string;
  onSelect: (s: string) => void;
  goal: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const current = results.find((r) => r.scenario.id === selected) || results[0];
  const values = results.flatMap((r) => [
    r.months[0].opening,
    ...r.months.map((m) => m.balance),
    ...r.months.map((m) => m.threshold),
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(100000, ...values) * 1.12;
  const x = (i: number) => 68 + (i / 12) * 770;
  const y = (v: number) => 250 - ((v - min) / (max - min)) * 218;
  const path = (r: Result) =>
    [r.months[0].opening, ...r.months.map((m) => m.balance)]
      .map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`)
      .join(' ');
  return (
    <>
      <div className="chart-legend">
        {results.map((r) => (
          <button
            className={
              selected === r.scenario.id ? 'legend selected' : 'legend'
            }
            key={r.scenario.id}
            onClick={() => onSelect(r.scenario.id)}
          >
            <i style={{ background: r.scenario.color }} />
            {r.scenario.name}
          </button>
        ))}
      </div>
      <div className="chart-scroll">
        <svg
          className="chart"
          viewBox="0 0 880 305"
          role="img"
          aria-label="未來十二個月各方案現金餘額折線圖"
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={current.scenario.color}
                stopOpacity=".15"
              />
              <stop
                offset="100%"
                stopColor={current.scenario.color}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = min + ((max - min) * i) / 4;
            return (
              <g key={i}>
                <line x1="68" x2="838" y1={y(v)} y2={y(v)} stroke="#edf0ed" />
                <text x="54" y={y(v) + 4} textAnchor="end" className="axis">
                  {money(v / 10000)} 萬
                </text>
              </g>
            );
          })}
          {goal >= min && goal <= max && (
            <g>
              <line
                x1="68"
                x2="838"
                y1={y(goal)}
                y2={y(goal)}
                stroke="#b3bdb7"
                strokeDasharray="3 5"
              />
              <text x="838" y={y(goal) - 7} textAnchor="end" className="axis">
                儲蓄目標
              </text>
            </g>
          )}
          <path
            d={`${path(current)} L${x(12)},250 L${x(0)},250 Z`}
            fill="url(#chartFill)"
          />
          <path
            d={current.months
              .map((m, i) => `${i ? 'L' : 'M'}${x(i + 1)},${y(m.threshold)}`)
              .join(' ')}
            fill="none"
            stroke="#dfad9b"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          {results.map((r) => (
            <path
              key={r.scenario.id}
              d={path(r)}
              fill="none"
              stroke={r.scenario.color}
              strokeWidth={r.scenario.id === selected ? 3.5 : 2}
              strokeLinecap="round"
              opacity={r.scenario.id === selected ? 1 : 0.7}
            />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i}>
              <text x={x(i + 1)} y="280" textAnchor="middle" className="axis">
                {Number(current.months[i].label.split('/')[1])}月
              </text>
              <rect
                x={x(i + 1) - 30}
                y="20"
                width="60"
                height="235"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${current.months[i].label} 餘額 ${money(current.months[i].balance)} 元`}
              />
            </g>
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line
                x1={x(hover + 1)}
                x2={x(hover + 1)}
                y1="24"
                y2="250"
                stroke="#a5b4ab"
                strokeDasharray="4 4"
              />
              {results.map((r) => (
                <circle
                  key={r.scenario.id}
                  cx={x(hover + 1)}
                  cy={y(r.months[hover].balance)}
                  r="5"
                  fill={r.scenario.color}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>
      </div>
      <div className="chart-caption">
        <span>
          <i /> 虛線為所選方案的預備金門檻
        </span>
        <span>
          {hover !== null
            ? `${current.months[hover].label} · NT$ ${money(current.months[hover].balance)}`
            : '移動游標或聚焦圖表，查看每月餘額'}
        </span>
      </div>
    </>
  );
}
export function Metric({
  label,
  value,
  unit = '元',
  icon,
  note,
  accent,
  progress,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  note: string;
  accent?: boolean;
  progress?: number;
}) {
  return (
    <Card className={`metric ${accent ? 'accent' : ''}`}>
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">
        {unit === '元' && <small>NT$</small>}
        {value}
        {unit !== '元' && <small>{unit}</small>}
      </div>
      <p>{note}</p>
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </Card>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Ledger({ result }: { result: Result }) {
  return (
    <div className="ledger">
      <p>期末餘額 ＝ 期初餘額 ＋ 收入 − 生活支出 − 負債付款 ＋ 其他現金流</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>月份</th>
              <th>期初餘額</th>
              <th>收入</th>
              <th>生活支出</th>
              <th>負債付款</th>
              <th>其他現金流</th>
              <th>月淨現金流</th>
              <th>期末餘額</th>
              <th>安全門檻</th>
              <th>覆蓋月數</th>
              <th>事件依據</th>
            </tr>
          </thead>
          <tbody>
            {result.months.map((m) => (
              <tr key={m.month}>
                <td>{m.label}</td>
                {[
                  m.opening,
                  m.income,
                  m.expenses,
                  m.debt,
                  m.other,
                  m.net,
                  m.balance,
                  m.threshold,
                ].map((v, i) => (
                  <td key={i} className={v < 0 ? 'red' : ''}>
                    {money(v)}
                  </td>
                ))}
                <td>
                  {m.coverage === null ? '無經常支出' : m.coverage.toFixed(1)}
                </td>
                <td>{m.details.join('；') || '基礎收支'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
