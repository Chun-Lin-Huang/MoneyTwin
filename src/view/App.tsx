import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Card,
  NumberField,
  Chart,
  Metric,
  SectionTitle,
  Ledger,
} from './components';
import type {
  EventKind,
  LifeEvent,
  Profile,
  SavedReport,
  Scenario,
} from '../interface/money';
import {
  explain,
  initialProfile,
  initialScenarios,
  kinds,
  maxAffordableRent,
  money,
  newEvent,
  simulate,
} from '../utils/simulation';
import '../style/App.css';
import { renderReport } from '../utils/report';
import { parseLocalScenario } from '../utils/parser';

type Page =
  'overview' | 'profile' | 'scenarios' | 'stress' | 'coach' | 'reports';
const navigation: { id: Page; icon: string; label: string }[] = [
  { id: 'overview', icon: '◫', label: '我的財務宇宙' },
  { id: 'profile', icon: '◎', label: '財務數位分身' },
  { id: 'scenarios', icon: '⑂', label: '平行未來模擬' },
  { id: 'stress', icon: '⌁', label: '財務壓力測試' },
  { id: 'coach', icon: '✧', label: '決策教練' },
  { id: 'reports', icon: '▤', label: '我的模擬報告' },
];
const storageKey = 'moneytwin-v1';
function validProfile(p: Profile) {
  return (
    p &&
    typeof p.name === 'string' &&
    typeof p.goalName === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(p.start) &&
    ['income', 'fixed', 'variable', 'savings', 'debt', 'reserve', 'goal'].every(
      (k) =>
        typeof p[k as keyof Profile] === 'number' &&
        Number.isSafeInteger(p[k as keyof Profile]) &&
        Number(p[k as keyof Profile]) >= 0 &&
        Number(p[k as keyof Profile]) <= 1e9,
    ) &&
    p.reserve <= 24
  );
}
function validScenario(s: Scenario) {
  return (
    s &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    /^#[a-fA-F0-9]{6}$/.test(s.color) &&
    Array.isArray(s.events) &&
    s.events.length <= 30 &&
    s.events.every(
      (e) =>
        e &&
        Object.prototype.hasOwnProperty.call(kinds, e.kind) &&
        typeof e.id === 'string' &&
        [e.amount, e.start, e.duration, e.upfront].every(
          Number.isSafeInteger,
        ) &&
        e.start >= 1 &&
        e.start <= 12 &&
        Number.isInteger(e.start) &&
        e.duration >= 1 &&
        e.duration <= 12 &&
        Number.isInteger(e.duration) &&
        e.upfront >= 0 &&
        e.upfront <= 1e9 &&
        Math.abs(e.amount) <= 1e9 &&
        (e.kind === 'income' || e.amount >= 0),
    )
  );
}
function validScenarios(s: Scenario[]) {
  return (
    Array.isArray(s) &&
    s.length >= 1 &&
    s.length <= 8 &&
    s[0].id === 'base' &&
    s[0].events.length === 0 &&
    s.every(validScenario) &&
    new Set(s.map((x) => x.id)).size === s.length
  );
}
function validReport(r: SavedReport) {
  return (
    r &&
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    !isNaN(Date.parse(r.date)) &&
    validProfile(r.profile) &&
    validScenarios(r.scenarios)
  );
}
function load(): {
  profile: Profile;
  scenarios: Scenario[];
  reports: SavedReport[];
} {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (data && validProfile(data.profile) && validScenarios(data.scenarios))
      return {
        ...data,
        reports: Array.isArray(data.reports)
          ? data.reports.filter(validReport)
          : [],
      };
  } catch {
    /* Damaged data falls back to demonstration data. */
  }
  return { profile: initialProfile, scenarios: initialScenarios, reports: [] };
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [initial] = useState(load);
  const [profile, setProfile] = useState(initial.profile);
  const [scenarios, setScenarios] = useState(initial.scenarios);
  const [reports, setReports] = useState(initial.reports);
  const [searchParams, setSearchParams] = useSearchParams();
  const page: Page = navigation.some(
    (item) => item.id === searchParams.get('view'),
  )
    ? (searchParams.get('view') as Page)
    : 'overview';
  const [selected, setSelected] = useState(scenarios[1]?.id || 'base');
  const [draft, setDraft] = useState(profile);
  const modalElement = useRef<HTMLElement>(null);
  const modelRequest = useRef(0);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'scenario' | 'privacy' | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [eventKind, setEventKind] = useState<EventKind>('rent');
  const [prompt, setPrompt] = useState('');
  const [parsed, setParsed] = useState<{
    events: LifeEvent[];
    questions: string[];
  } | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showLedger, setShowLedger] = useState(false);
  const results = useMemo(
    () => scenarios.map((s) => simulate(profile, s)),
    [profile, scenarios],
  );
  const active = results.find((r) => r.scenario.id === selected) || results[0];
  const base = results[0];
  const affordableRent = maxAffordableRent(profile, active.scenario);
  const summary = explain(active, base, profile);
  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(''), 4500);
  }
  function persist(p = profile, s = scenarios, r = reports) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ profile: p, scenarios: s, reports: r }),
      );
      return true;
    } catch {
      notify('瀏覽器儲存空間不足或已停用，請匯出備份。');
      return false;
    }
  }
  function updateScenarios(next: Scenario[]) {
    modelRequest.current++;
    setScenarios(next);
    persist(profile, next);
    setAiText('');
    setAiError('');
  }
  function updateEvent(id: string, changes: Partial<LifeEvent>) {
    updateScenarios(
      scenarios.map((s) =>
        s.id === selected
          ? {
              ...s,
              events: s.events.map((e) =>
                e.id === id ? { ...e, ...changes } : e,
              ),
            }
          : s,
      ),
    );
  }
  function navigate(next: Page) {
    modelRequest.current++;
    setSearchParams(next === 'overview' ? {} : { view: next });
    setAiText('');
    setAiError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function saveReport() {
    const report: SavedReport = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: `${profile.name}｜${active.scenario.name}`,
      profile: structuredClone(profile),
      scenarios: structuredClone(scenarios),
    };
    const next = [report, ...reports];
    setReports(next);
    if (persist(profile, scenarios, next))
      notify('已保存完整模擬快照，可至「我的模擬報告」查看。');
  }
  function exportCSV(p = profile, ss = scenarios) {
    const rows = [
      [
        '方案',
        '月份',
        '期初餘額',
        '收入',
        '生活支出',
        '負債付款',
        '其他現金流',
        '淨現金流',
        '期末餘額',
        '預備金門檻',
      ],
      ...ss.flatMap((s) =>
        simulate(p, s).months.map((m) => [
          s.name,
          m.label,
          m.opening,
          m.income,
          m.expenses,
          m.debt,
          m.other,
          m.net,
          m.balance,
          m.threshold,
        ]),
      ),
    ];
    download(
      'MoneyTwin-逐月現金流.csv',
      '\uFEFF' +
        rows
          .map((row) =>
            row
              .map(
                (v) =>
                  `"${String(v)
                    .replace(/"/g, '""')
                    .replace(/^[=+@-]/, "'$&")}"`,
              )
              .join(','),
          )
          .join('\r\n'),
      'text/csv;charset=utf-8',
    );
  }
  function createScenario() {
    if (!scenarioName.trim()) return;
    if (scenarios.length >= 8) {
      notify('最多同時比較 8 個方案，請先保存報告並移除不需要的方案。');
      return;
    }
    const id = crypto.randomUUID();
    updateScenarios([
      ...scenarios,
      {
        id,
        name: scenarioName.trim(),
        color: ['#6486b5', '#9575a7', '#b67f74', '#7b945a', '#4c939e'][
          scenarios.length % 5
        ],
        events: parsed ? parsed.events : [newEvent(eventKind)],
      },
    ]);
    setSelected(id);
    setModal(null);
    setScenarioName('');
    setParsed(null);
    setPrompt('');
    navigate('scenarios');
    notify('已建立平行未來，請確認事件參數。');
  }
  function parsePrompt() {
    if (!prompt.trim()) return;
    setParsed(parseLocalScenario(prompt));
    setScenarioName(prompt.slice(0, 24));
  }
  async function parseAI() {
    setAiBusy(true);
    setAiError('');
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? '尚未設定模型。請使用本機解析，或依 README 啟動 Ollama 模型。'
            : 'AI 解析失敗，請使用本機解析或事件範本。',
        );
      const data = await response.json();
      const events = Array.isArray(data.events)
        ? data.events.map((e: LifeEvent) => ({ ...e, id: crypto.randomUUID() }))
        : null;
      if (
        !events ||
        !validScenario({
          id: 'preview',
          name: 'preview',
          color: '#328775',
          events,
        }) ||
        !Array.isArray(data.questions) ||
        !data.questions.every((q: unknown) => typeof q === 'string')
      )
        throw new Error('模型回傳的參數未通過驗證，請改用本機解析。');
      setParsed({
        events,
        questions: ['AI 解析結果，請逐項確認後再建立。', ...data.questions],
      });
      setScenarioName(prompt.slice(0, 24));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '模型無法連線。');
    } finally {
      setAiBusy(false);
    }
  }
  async function askAI() {
    const request = ++modelRequest.current;
    setAiBusy(true);
    setAiError('');
    setAiText('');
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts: summary,
          scenario: active.scenario.name,
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? '尚未設定模型服務。左側仍可使用完整的本機分析；模型設定方式請參考 README。'
            : '模型服務目前無法回應，請稍後再試。',
        );
      const data = await response.json();
      if (typeof data.text !== 'string')
        throw new Error('模型服務未回傳有效文字。請確認已啟動 API 服務。');
      if (request === modelRequest.current) setAiText(data.text);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '連線失敗，請檢查模型服務。');
    } finally {
      setAiBusy(false);
    }
  }
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = modalElement.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea:not(:disabled), [tabindex="0"]',
        ) || [],
      );
    (
      focusable().find((el) => el.tagName === 'TEXTAREA') || focusable()[0]
    )?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [modal]);
  const pageTitle = navigation.find((n) => n.id === page)!.label;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#/"
          aria-label="MoneyTwin 首頁"
          onClick={() => navigate('overview')}
        >
          <span className="brand-symbol">
            m<span>✦</span>
          </span>
          <span>
            MoneyTwin<small>未來有錢途</small>
          </span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {navigation.map((n) => (
            <button
              aria-label={n.label}
              title={n.label}
              key={n.id}
              className={page === n.id ? 'nav-item active' : 'nav-item'}
              onClick={() => navigate(n.id)}
            >
              <span>{n.icon}</span>
              {n.label}
              {n.id === 'coach' && <small>NEW</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-spark">✧</span>
          <strong>
            人生不能重來，
            <br />
            財務可以先模擬。
          </strong>
          <p>每個選擇，都有值得探索的未來。</p>
          <button
            onClick={() => {
              setParsed(null);
              setModal('scenario');
            }}
          >
            探索我的可能性 <span>↗</span>
          </button>
        </div>
        <button
          className="privacy-link"
          aria-label="資料與隱私設定"
          onClick={() => setModal('privacy')}
        >
          ♧ 資料與隱私設定
        </button>
        <div className="user">
          <div className="avatar">M</div>
          <div>
            <strong>我的個人空間</strong>
            <small>本機儲存 · 無帳戶連結</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            個人工作室 <span>/</span> <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              本機模式
            </span>
            <button
              className="privacy-top"
              aria-label="資料與隱私設定"
              onClick={() => setModal('privacy')}
            >
              ♧
            </button>
            <span className="top-date">
              {new Intl.DateTimeFormat('zh-TW', {
                month: 'long',
                day: 'numeric',
              }).format(new Date())}
            </span>
            <div className="avatar small">M</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR NEXT CHAPTER, SIMULATED.</div>
              <h1>
                {page === 'overview' ? '讓每一個選擇，都更有底氣。' : pageTitle}
                <span className="heading-dot">✦</span>
              </h1>
              <p>
                {page === 'overview'
                  ? '和你的財務分身一起，看見不同選擇下的未來。'
                  : page === 'profile'
                    ? '建立共同起點，讓每一條平行未來都有一致的依據。'
                    : page === 'scenarios'
                      ? '如果人生有另一種選擇？先在這裡試著走一遍。'
                      : page === 'stress'
                        ? '不是預測壞事發生，而是為不確定的未來多做一點準備。'
                        : page === 'coach'
                          ? '從可驗證的數字出發，理解風險、假設與下一步。'
                          : '把當下的假設與結果保存下來，讓每次決策都有跡可循。'}
              </p>
            </div>
            <div className="heading-actions">
              {page !== 'profile' && (
                <button className="button secondary" onClick={saveReport}>
                  ↓ 保存報告
                </button>
              )}
              <button
                className="button primary"
                onClick={() => {
                  setParsed(null);
                  setModal('scenario');
                }}
              >
                ＋ 建立新情境
              </button>
            </div>
          </div>
          {page === 'overview' && (
            <>
              <div className="overview-banner">
                <div className="banner-orbit">
                  <span>◎</span>
                  <i>✧</i>
                </div>
                <div>
                  <span className="banner-kicker">
                    MEET YOUR FINANCIAL TWIN
                  </span>
                  <h2>現在的你，連結未來的無限可能。</h2>
                  <p>
                    已根據財務資料建立{' '}
                    <strong>{scenarios.length} 個平行未來</strong>
                    。調整一個選擇，看看未來會有什麼不同。
                  </p>
                  <button onClick={() => navigate('profile')}>
                    查看我的財務分身 <span>↗</span>
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="orbit one" />
                  <div className="orbit two" />
                  <div className="orbit three" />
                  <div className="orb">
                    <span>m</span>
                  </div>
                  <span className="float-label label-one">
                    ✧ 未來，由你定義
                  </span>
                  <span className="float-label label-two">
                    <i /> TWIN CONNECTED
                  </span>
                  <span className="art-spark">✦</span>
                </div>
              </div>
              <div className="metric-grid">
                <Metric
                  label="目前可用存款"
                  value={money(profile.savings)}
                  icon="◈"
                  note="所有情境的共同起點"
                />
                <Metric
                  label="每月可儲蓄金額"
                  value={money(
                    profile.income -
                      profile.fixed -
                      profile.variable -
                      profile.debt,
                  )}
                  icon="↗"
                  note={`基準儲蓄率 ${profile.income ? Math.round(((profile.income - profile.fixed - profile.variable - profile.debt) / profile.income) * 100) : 0}%`}
                />
                <Metric
                  label="目前預備金覆蓋"
                  value={
                    profile.fixed + profile.variable + profile.debt > 0
                      ? (
                          profile.savings /
                          (profile.fixed + profile.variable + profile.debt)
                        ).toFixed(1)
                      : '—'
                  }
                  unit="個月"
                  icon="♧"
                  note={`安全目標 ${profile.reserve} 個月生活支出`}
                  accent
                />
                <Metric
                  label="財務目標進度"
                  value={Math.min(
                    100,
                    profile.goal > 0
                      ? Math.round((profile.savings / profile.goal) * 100)
                      : 100,
                  ).toString()}
                  unit="%"
                  icon="⚑"
                  note={`${profile.goalName} · NT$ ${money(profile.goal)}`}
                  progress={
                    profile.goal > 0
                      ? (profile.savings / profile.goal) * 100
                      : 100
                  }
                />
              </div>
              <div className="dashboard-grid">
                <Card className="forecast-card">
                  <SectionTitle
                    eyebrow="PARALLEL FUTURES"
                    title="你的未來，不只一種可能"
                    action={
                      <button
                        className="text-button"
                        onClick={() => navigate('scenarios')}
                      >
                        編輯情境 ↗
                      </button>
                    }
                  />
                  <div className="chart-meta">
                    <span>未來 12 個月 · 可用現金餘額</span>
                    <span className="soft-badge">{profile.start} 起</span>
                  </div>
                  <Chart
                    results={results}
                    selected={selected}
                    onSelect={setSelected}
                    goal={profile.goal}
                  />
                  <div className="chart-insight">
                    <span>✧</span>
                    <p>
                      選擇「{active.scenario.name}」，一年後比維持現況
                      {active.end >= base.end ? '多' : '少'}{' '}
                      <strong>
                        NT$ {money(Math.abs(active.end - base.end))}
                      </strong>
                      。
                      <button onClick={() => navigate('coach')}>
                        了解差異原因 →
                      </button>
                    </p>
                  </div>
                </Card>
                <Card className="coach-preview">
                  <div className="coach-icon">✧</div>
                  <span className="eyebrow">YOUR DECISION COACH</span>
                  <h2>讓數字，變成方向。</h2>
                  <div className="mode-label">本機規則分析 · 計算可追溯</div>
                  <p>
                    {active.firstWarning
                      ? `在「${active.scenario.name}」中，第 ${active.firstWarning} 個月會低於預備金安全水位。`
                      : `在「${active.scenario.name}」中，未來 12 個月皆維持在預備金安全水位以上。`}
                  </p>
                  <div className="coach-fact">
                    <span>最低資金水位</span>
                    <strong>NT$ {money(active.minimum)}</strong>
                    <small>第 {active.minimumMonth} 個月</small>
                  </div>
                  <button
                    className="button primary full"
                    onClick={() => navigate('coach')}
                  >
                    查看決策分析 <span>↗</span>
                  </button>
                  <small className="muted">依你的資料與情境假設計算</small>
                </Card>
              </div>
              <SectionTitle
                eyebrow="EXPLORE POSSIBILITIES"
                title="人生大事，先模擬一下"
                action={
                  <button
                    className="text-button"
                    onClick={() => navigate('stress')}
                  >
                    探索壓力測試 →
                  </button>
                }
              />
              <div className="template-grid">
                {(
                  ['rent', 'unemployment', 'income', 'study'] as EventKind[]
                ).map((k) => (
                  <button
                    className={`template-card ${k}`}
                    key={k}
                    onClick={() => {
                      setEventKind(k);
                      setScenarioName(kinds[k].label);
                      setParsed(null);
                      setModal('scenario');
                    }}
                  >
                    <span className="template-icon">{kinds[k].icon}</span>
                    <div>
                      <h3>{kinds[k].label}</h3>
                      <p>{kinds[k].description}</p>
                    </div>
                    <span className="template-arrow">↗</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === 'profile' && (
            <div className="form-layout">
              <Card>
                <SectionTitle
                  eyebrow="FINANCIAL IDENTITY"
                  title="建立你的財務數位分身"
                />
                <div className="info-strip">
                  示範資料已預填。金額單位為新臺幣，更新後會同步重算全部情境。
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!validProfile(draft)) {
                      notify('請檢查資料範圍與起始月份。');
                      return;
                    }
                    setProfile(draft);
                    persist(draft);
                    setAiText('');
                    notify('財務分身已更新，所有平行未來已重新計算。');
                  }}
                >
                  <div className="form-grid">
                    <label className="field">
                      <span>分身名稱</span>
                      <input
                        value={draft.name}
                        maxLength={40}
                        required
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>模擬起始月份</span>
                      <input
                        type="month"
                        value={draft.start}
                        min="2020-01"
                        max="2100-12"
                        required
                        onChange={(e) =>
                          setDraft({ ...draft, start: e.target.value })
                        }
                      />
                    </label>
                    <NumberField
                      label="每月實領收入"
                      value={draft.income}
                      onChange={(income) => setDraft({ ...draft, income })}
                      hint="使用稅後收入；目前不另外推算所得稅"
                    />
                    <NumberField
                      label="目前可用現金與存款"
                      value={draft.savings}
                      onChange={(savings) => setDraft({ ...draft, savings })}
                      hint="不含房產與無法立即動用的資產"
                    />
                    <NumberField
                      label="每月固定支出"
                      value={draft.fixed}
                      onChange={(fixed) => setDraft({ ...draft, fixed })}
                      hint="目前的房租、保費、訂閱等"
                    />
                    <NumberField
                      label="每月變動支出"
                      value={draft.variable}
                      onChange={(variable) => setDraft({ ...draft, variable })}
                      hint="飲食、交通、娛樂等"
                    />
                    <NumberField
                      label="每月負債付款"
                      value={draft.debt}
                      onChange={(debt) => setDraft({ ...draft, debt })}
                      hint="學貸、車貸及其他固定還款"
                    />
                    <NumberField
                      label="預備金安全門檻"
                      value={draft.reserve}
                      max={24}
                      suffix="個月"
                      onChange={(reserve) => setDraft({ ...draft, reserve })}
                    />
                    <label className="field">
                      <span>財務目標名稱</span>
                      <input
                        value={draft.goalName}
                        required
                        maxLength={40}
                        onChange={(e) =>
                          setDraft({ ...draft, goalName: e.target.value })
                        }
                      />
                    </label>
                    <NumberField
                      label="目標存款金額"
                      value={draft.goal}
                      onChange={(goal) => setDraft({ ...draft, goal })}
                    />
                  </div>
                  <div className="form-footer">
                    <span>資料只會儲存在目前使用的瀏覽器</span>
                    <button className="button primary" type="submit">
                      儲存並更新分身 ↗
                    </button>
                  </div>
                </form>
              </Card>
              <Card className="profile-summary">
                <div className="twin-avatar">
                  m<span>✦</span>
                </div>
                <h2>{draft.name}</h2>
                <p className="muted">你的財務狀態，即時映照。</p>
                <div className="summary-row">
                  <span>每月收入</span>
                  <strong>NT$ {money(draft.income)}</strong>
                </div>
                <div className="summary-row">
                  <span>每月總支出</span>
                  <strong>
                    NT$ {money(draft.fixed + draft.variable + draft.debt)}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>每月結餘</span>
                  <strong className="green">
                    NT${' '}
                    {money(
                      draft.income - draft.fixed - draft.variable - draft.debt,
                    )}
                  </strong>
                </div>
                <div className="info-strip">
                  新事件的費用是「額外增加」的金額。若已在固定支出填入租金，新增租屋事件時請只輸入增加的租金。
                </div>
              </Card>
            </div>
          )}
          {(page === 'scenarios' || page === 'stress') && (
            <>
              {page === 'stress' && (
                <Card className="stress-intro">
                  <div>
                    <span className="eyebrow">
                      HOW RESILIENT IS YOUR FUTURE?
                    </span>
                    <h2>如果生活突然轉彎，你準備好了嗎？</h2>
                    <p>
                      從現有方案加上不利事件，看看安全緩衝能支撐多久。所有測試均為假設，並非事件發生機率。
                    </p>
                  </div>
                  <div className="stress-actions">
                    {(
                      [
                        'unemployment',
                        'income',
                        'expense',
                        'cost',
                      ] as EventKind[]
                    ).map((k) => (
                      <button
                        className="button secondary"
                        key={k}
                        onClick={() => {
                          if (active.scenario.id === 'base') {
                            notify('請先選擇或建立一個非基準方案。');
                            return;
                          }
                          if (active.scenario.events.length >= 30) {
                            notify('單一方案最多 30 個事件。');
                            return;
                          }
                          updateScenarios(
                            scenarios.map((s) =>
                              s.id === selected
                                ? { ...s, events: [...s.events, newEvent(k)] }
                                : s,
                            ),
                          );
                          notify(`已加入${kinds[k].label}，可在下方調整參數。`);
                        }}
                      >
                        {kinds[k].icon} {kinds[k].label}
                      </button>
                    ))}
                  </div>
                </Card>
              )}
              <div className="scenario-tabs">
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    className={
                      active.scenario.id === s.id
                        ? 'scenario-tab active'
                        : 'scenario-tab'
                    }
                    onClick={() => {
                      setSelected(s.id);
                      setAiText('');
                    }}
                  >
                    <i style={{ background: s.color }} />
                    {s.name}
                    {s.id === 'base' && <small>基準</small>}
                  </button>
                ))}
                <button
                  className="scenario-tab add"
                  onClick={() => {
                    setParsed(null);
                    setModal('scenario');
                  }}
                >
                  ＋ 新增方案
                </button>
              </div>
              <div className="scenario-layout">
                <Card>
                  <SectionTitle
                    eyebrow="SCENARIO BUILDER"
                    title={active.scenario.name}
                    action={
                      active.scenario.id !== 'base' && (
                        <button
                          className="danger-link"
                          onClick={() => {
                            if (
                              confirm('確定刪除此方案？已保存的報告不受影響。')
                            ) {
                              updateScenarios(
                                scenarios.filter((s) => s.id !== selected),
                              );
                              setSelected('base');
                            }
                          }}
                        >
                          刪除方案
                        </button>
                      )
                    }
                  />
                  {active.scenario.id === 'base' ? (
                    <div className="empty-state">
                      <span>◎</span>
                      <h3>所有未來的共同起點</h3>
                      <p>
                        基準方案不包含額外事件。請至財務數位分身修改基本收支，或建立分支情境探索新的可能。
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => navigate('profile')}
                      >
                        編輯財務分身
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span>方案名稱</span>
                        <input
                          maxLength={50}
                          value={active.scenario.name}
                          onChange={(e) =>
                            updateScenarios(
                              scenarios.map((s) =>
                                s.id === selected
                                  ? { ...s, name: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="event-list">
                        {active.scenario.events.map((ev, i) => (
                          <div className="event-card" key={ev.id}>
                            <div className="event-header">
                              <strong>
                                <span>{kinds[ev.kind].icon}</span>{' '}
                                {kinds[ev.kind].label}{' '}
                                <small>事件 {i + 1}</small>
                              </strong>
                              <button
                                aria-label={`移除事件 ${i + 1}`}
                                className="icon-button"
                                onClick={() =>
                                  updateScenarios(
                                    scenarios.map((s) =>
                                      s.id === selected
                                        ? {
                                            ...s,
                                            events: s.events.filter(
                                              (e) => e.id !== ev.id,
                                            ),
                                          }
                                        : s,
                                    ),
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                            <div className="form-grid">
                              <NumberField
                                label="生效月份"
                                value={ev.start}
                                min={1}
                                max={12}
                                suffix="第幾月"
                                onChange={(start) =>
                                  updateEvent(ev.id, {
                                    start: Math.round(start),
                                  })
                                }
                              />
                              {ev.kind !== 'expense' && (
                                <NumberField
                                  label="持續期間"
                                  value={ev.duration}
                                  min={1}
                                  max={12}
                                  suffix="個月"
                                  onChange={(duration) =>
                                    updateEvent(ev.id, {
                                      duration: Math.round(duration),
                                    })
                                  }
                                />
                              )}
                              {ev.kind !== 'unemployment' && (
                                <NumberField
                                  label={
                                    ev.kind === 'income'
                                      ? '每月收入增減（減少請填負數）'
                                      : ev.kind === 'expense'
                                        ? '一次性支出金額'
                                        : '每月額外支出'
                                  }
                                  value={ev.amount}
                                  min={ev.kind === 'income' ? -1000000000 : 0}
                                  onChange={(amount) =>
                                    updateEvent(ev.id, { amount })
                                  }
                                />
                              )}
                              {(ev.kind === 'rent' || ev.kind === 'study') && (
                                <NumberField
                                  label="前期一次性費用"
                                  value={ev.upfront}
                                  onChange={(upfront) =>
                                    updateEvent(ev.id, { upfront })
                                  }
                                />
                              )}
                            </div>
                            {ev.kind === 'unemployment' && (
                              <p className="event-note">
                                期間內薪資歸零，其他支出照常發生；未假設失業補助。
                              </p>
                            )}
                            {ev.start + ev.duration > 13 &&
                              ev.kind !== 'expense' && (
                                <p className="event-note">
                                  超過第 12 個月的部分不列入本次模擬。
                                </p>
                              )}
                          </div>
                        ))}
                      </div>
                      <div className="add-event-row">
                        <select
                          aria-label="事件類型"
                          value={eventKind}
                          onChange={(e) =>
                            setEventKind(e.target.value as EventKind)
                          }
                        >
                          {Object.entries(kinds).map(([key, v]) => (
                            <option key={key} value={key}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button secondary"
                          onClick={() => {
                            if (active.scenario.events.length >= 30) {
                              notify('單一方案最多 30 個事件。');
                              return;
                            }
                            updateScenarios(
                              scenarios.map((s) =>
                                s.id === selected
                                  ? {
                                      ...s,
                                      events: [
                                        ...s.events,
                                        newEvent(eventKind),
                                      ],
                                    }
                                  : s,
                              ),
                            );
                          }}
                        >
                          ＋ 加入事件
                        </button>
                      </div>
                    </>
                  )}
                </Card>
                <div>
                  <Card>
                    <SectionTitle
                      eyebrow="LIVE SIMULATION"
                      title="每次調整，未來即時更新"
                    />
                    <Chart
                      results={results}
                      selected={selected}
                      onSelect={setSelected}
                      goal={profile.goal}
                    />
                    <div className="mini-metrics">
                      <div>
                        <span>12 個月後餘額</span>
                        <strong>NT$ {money(active.end)}</strong>
                      </div>
                      <div>
                        <span>最低水位 · 第 {active.minimumMonth} 月</span>
                        <strong className={active.minimum < 0 ? 'red' : ''}>
                          NT$ {money(active.minimum)}
                        </strong>
                      </div>
                    </div>
                  </Card>
                  <Card className="risk-panel">
                    <h3>♧ 風險臨界點分析</h3>
                    <div className="summary-row">
                      <span>首次低於預備金門檻</span>
                      <strong>
                        {active.firstWarning
                          ? `第 ${active.firstWarning} 個月`
                          : '未觸及'}
                      </strong>
                    </div>
                    <div className="summary-row">
                      <span>首次資金缺口</span>
                      <strong>
                        {active.firstDeficit
                          ? `第 ${active.firstDeficit} 個月`
                          : '無缺口'}
                      </strong>
                    </div>
                    <div className="summary-row">
                      <span>最長連續負現金流</span>
                      <strong>{active.maxNegativeRun} 個月</strong>
                    </div>
                    {affordableRent !== null && (
                      <div className="rent-insight">
                        <small>在目前其他條件下，全期不低於預備金門檻的</small>
                        <p>
                          額外月租上限{' '}
                          <strong>
                            {affordableRent < 0
                              ? '無安全租金'
                              : `NT$ ${money(affordableRent)}`}
                          </strong>
                        </p>
                        <small>
                          {affordableRent < 0
                            ? '即使額外月租為零，仍需改善其他收支條件。'
                            : '僅調整第一筆租屋事件月租，押金等其他條件不變。'}
                        </small>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}
          {(page === 'overview' ||
            page === 'scenarios' ||
            page === 'stress') && (
            <Card className="comparison-card">
              <SectionTitle
                eyebrow="SIDE BY SIDE"
                title="把不同未來，放在一起看"
                action={
                  <button className="text-button" onClick={() => exportCSV()}>
                    匯出逐月 CSV ↓
                  </button>
                }
              />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>平行未來</th>
                      <th>12 個月後餘額</th>
                      <th>最低資金水位</th>
                      <th>預備金不足</th>
                      <th>與基準差異</th>
                      <th>財務韌性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr
                        key={r.scenario.id}
                        className={
                          selected === r.scenario.id ? 'selected-row' : ''
                        }
                      >
                        <td>
                          <button
                            className="table-scenario"
                            onClick={() => {
                              setSelected(r.scenario.id);
                              navigate('scenarios');
                            }}
                          >
                            <i style={{ background: r.scenario.color }} />
                            {r.scenario.name}
                          </button>
                        </td>
                        <td className="amount">NT$ {money(r.end)}</td>
                        <td>
                          NT$ {money(r.minimum)}
                          <small className="cell-sub">
                            第 {r.minimumMonth} 個月
                          </small>
                        </td>
                        <td>
                          {r.warningMonths ? `${r.warningMonths} 個月` : '—'}
                        </td>
                        <td>
                          {r.scenario.id === 'base'
                            ? '基準情境'
                            : `${r.end >= base.end ? '+' : '−'} ${money(Math.abs(r.end - base.end))}`}
                        </td>
                        <td>
                          <span
                            className={`status ${r.firstDeficit ? 'danger' : r.firstWarning ? 'warning' : 'safe'}`}
                          >
                            <i />
                            {r.firstDeficit
                              ? '出現資金缺口'
                              : r.firstWarning
                                ? '需要多些準備'
                                : '安全緩衝充足'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ledger-toggle">
                <button
                  className="text-button"
                  onClick={() => setShowLedger(!showLedger)}
                >
                  {showLedger ? '收起' : '展開'}「{active.scenario.name}
                  」逐月計算明細 {showLedger ? '↑' : '↓'}
                </button>
              </div>
              {showLedger && <Ledger result={active} />}
            </Card>
          )}
          {page === 'coach' && (
            <div className="coach-layout">
              <Card>
                <SectionTitle
                  eyebrow="EXPLAINABLE BY DESIGN"
                  title="每個建議，都有數字依據"
                />
                <label className="field">
                  <span>分析方案</span>
                  <select
                    value={selected}
                    onChange={(e) => {
                      modelRequest.current++;
                      setSelected(e.target.value);
                      setAiText('');
                      setAiError('');
                    }}
                  >
                    {scenarios.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="mode-label">本機規則分析 · 引擎 v1.0</span>
                <div className="explanation-list">
                  {summary.map((s, i) => (
                    <div key={i}>
                      <span>0{i + 1}</span>
                      <div>
                        <h3>
                          {
                            [
                              '選擇的代價',
                              '安全緩衝與警戒月份',
                              '下一步可以怎麼做',
                              '目標與模擬限制',
                            ][i]
                          }
                        </h3>
                        <p>{s}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="button secondary"
                  onClick={() => setShowLedger(!showLedger)}
                >
                  ⌕ {showLedger ? '收起' : '查看'}計算依據
                </button>
                {showLedger && <Ledger result={active} />}
              </Card>
              <div>
                <Card className="llm-card">
                  <div className="coach-icon">✧</div>
                  <h2>AI 決策教練</h2>
                  <p>
                    將已驗證的模擬摘要交給語言模型，協助整理風險與行動方向。只傳送方案名稱與計算摘要，不傳送個人姓名。
                  </p>
                  <div className="info-strip">
                    需先啟動並設定模型服務。模型不負責計算財務數字；回覆仍需對照左側依據。
                  </div>
                  <button
                    className="button primary full"
                    disabled={aiBusy}
                    onClick={askAI}
                  >
                    {aiBusy ? '正在整理分析…' : '✧ 生成 AI 決策說明'}
                  </button>
                  {aiError && (
                    <p className="error-message" role="alert">
                      {aiError}
                    </p>
                  )}
                  {aiText && (
                    <div className="ai-response">
                      <span className="mode-label">
                        語言模型生成 · 請對照計算依據
                      </span>
                      <div className="ai-response-copy">
                        {aiText.split('\n').map((line, index) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div className="ai-response-gap" key={index} />;
                          const heading = /^\*\*(.+)\*\*$/.exec(trimmed);
                          if (heading)
                            return <h3 key={index}>{heading[1]}</h3>;
                          const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
                          return (
                            <p key={index}>
                              {parts.map((part, partIndex) =>
                                part.startsWith('**') && part.endsWith('**') ? (
                                  <strong key={partIndex}>{part.slice(2, -2)}</strong>
                                ) : (
                                  part
                                ),
                              )}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
                <Card>
                  <h3>探索一個更穩健的未來</h3>
                  <p className="muted">
                    試試降低每月費用、縮短收入空窗或延後大筆支出，並觀察最低資金水位如何改變。
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate('scenarios')}
                  >
                    回到情境編輯器 →
                  </button>
                </Card>
              </div>
            </div>
          )}
          {page === 'reports' && (
            <>
              <div className="report-toolbar">
                <p>{reports.length} 份已保存報告 · 每份保留當時的資料與情境</p>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      'MoneyTwin-備份.json',
                      JSON.stringify({ profile, scenarios, reports }, null, 2),
                      'application/json',
                    )
                  }
                >
                  ↓ 匯出完整備份
                </button>
                <label className="button secondary import-label">
                  ↑ 匯入備份
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 5000000) throw new Error();
                        const data = JSON.parse(await file.text());
                        if (
                          !validProfile(data.profile) ||
                          !validScenarios(data.scenarios) ||
                          !Array.isArray(data.reports) ||
                          !data.reports.every(validReport)
                        )
                          throw new Error();
                        if (!confirm('匯入將取代目前資料與報告，是否繼續？'))
                          return;
                        setProfile(data.profile);
                        setDraft(data.profile);
                        setScenarios(data.scenarios);
                        setReports(data.reports);
                        setSelected(data.scenarios[1]?.id || 'base');
                        persist(data.profile, data.scenarios, data.reports);
                        notify('已還原備份。');
                      } catch {
                        notify(
                          '檔案格式或資料範圍不正確，請選擇 MoneyTwin 匯出的 JSON 備份。',
                        );
                      } finally {
                        input.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {!reports.length ? (
                <Card>
                  <div className="empty-state">
                    <span>▤</span>
                    <h2>把值得思考的未來，留存下來。</h2>
                    <p>點擊「保存報告」，保存全部情境與財務分身的完整快照。</p>
                    <button className="button primary" onClick={saveReport}>
                      保存第一份報告
                    </button>
                  </div>
                </Card>
              ) : (
                <div className="reports-grid">
                  {reports.map((r) => (
                    <Card key={r.id}>
                      <div className="report-card-head">
                        <span className="report-icon">▤</span>
                        <small>
                          {new Date(r.date).toLocaleString('zh-TW')}
                        </small>
                      </div>
                      <h3>{r.name}</h3>
                      <p className="muted">
                        {r.scenarios.length} 個平行未來 · 起始存款 NT${' '}
                        {money(r.profile.savings)}
                      </p>
                      <div className="report-values">
                        {r.scenarios.map((s) => (
                          <div className="summary-row" key={s.id}>
                            <span>{s.name}</span>
                            <strong>
                              NT$ {money(simulate(r.profile, s).end)}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div className="report-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            if (
                              confirm(
                                '載入此快照將取代目前分身與情境，是否繼續？',
                              )
                            ) {
                              setProfile(r.profile);
                              setDraft(r.profile);
                              setScenarios(r.scenarios);
                              setSelected(r.scenarios[1]?.id || 'base');
                              persist(r.profile, r.scenarios);
                              navigate('overview');
                              notify('已載入報告快照。');
                            }
                          }}
                        >
                          載入快照 ↗
                        </button>
                        <button
                          className="text-button"
                          onClick={() => exportCSV(r.profile, r.scenarios)}
                        >
                          CSV ↓
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            download(
                              'MoneyTwin-分析報告.html',
                              renderReport(r),
                              'text/html;charset=utf-8',
                            )
                          }
                        >
                          完整報告 ↓
                        </button>
                        <button
                          className="danger-link"
                          onClick={() => {
                            if (confirm('確定刪除此報告？')) {
                              const next = reports.filter((x) => x.id !== r.id);
                              setReports(next);
                              persist(profile, scenarios, next);
                            }
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              <span className="footer-mark">✦</span> MoneyTwin <span>·</span>{' '}
              先模擬，再決策。
            </span>
            <small>
              模擬依據使用者假設，不代表保證結果；本工具提供財務教育與決策輔助。
            </small>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
          <button onClick={() => setToast('')} aria-label="關閉通知">
            ×
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <section
            ref={modalElement}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'scenario' ? '建立新情境' : '資料與隱私設定'}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setModal(null);
            }}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setModal(null)}
              aria-label="關閉"
            >
              ×
            </button>
            {modal === 'scenario' ? (
              <>
                <span className="eyebrow">A NEW POSSIBILITY</span>
                <h2>開啟一條平行未來。</h2>
                <p className="muted">
                  從生活事件開始，或用一句話描述你的計畫。
                </p>
                <label className="field">
                  <span>用一句話描述未來計畫</span>
                  <textarea
                    autoFocus
                    disabled={aiBusy}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setParsed(null);
                    }}
                    maxLength={500}
                    placeholder="例如：第4個月搬出去住，每月租金12000，失業3個月"
                    rows={3}
                  />
                </label>
                <div className="parse-actions">
                  <button
                    className="button secondary"
                    onClick={parsePrompt}
                    disabled={!prompt.trim() || aiBusy}
                  >
                    本機解析
                  </button>
                  <button
                    className="button primary"
                    onClick={parseAI}
                    disabled={!prompt.trim() || aiBusy}
                  >
                    {aiBusy ? '解析中…' : '✧ AI 理解情境'}
                  </button>
                </div>
                {aiError && (
                  <p className="error-message" role="alert">
                    {aiError}
                  </p>
                )}
                {parsed && (
                  <div className="parsed-result">
                    <strong>
                      {parsed.events.length
                        ? `辨識到 ${parsed.events.length} 個事件：${parsed.events.map((e) => kinds[e.kind].label).join('、')}`
                        : '請補充情境描述'}
                    </strong>
                    {parsed.questions.map((q) => (
                      <p key={q}>· {q}</p>
                    ))}
                    {parsed.events.length > 0 && (
                      <>
                        <div className="preview-events">
                          {parsed.events.map((ev) => (
                            <div key={ev.id}>
                              <strong>{kinds[ev.kind].label}</strong>
                              <span>
                                第 {ev.start} 月起 · {ev.duration} 個月 ·{' '}
                                {ev.kind === 'unemployment'
                                  ? '薪資歸零'
                                  : `金額 ${money(ev.amount)} 元`}{' '}
                                · 前期 {money(ev.upfront)} 元
                              </span>
                            </div>
                          ))}
                        </div>
                        <small>
                          以上參數將用於試算，請確認後再建立；建立後仍可編輯。
                        </small>
                      </>
                    )}
                  </div>
                )}
                <div className="divider-label">或從範本開始</div>
                <div className="modal-templates">
                  {Object.entries(kinds).map(([key, v]) => (
                    <button
                      key={key}
                      className={eventKind === key && !parsed ? 'active' : ''}
                      onClick={() => {
                        setEventKind(key as EventKind);
                        setParsed(null);
                        setScenarioName(v.label);
                      }}
                    >
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>情境名稱</span>
                  <input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="為這個未來取個名字"
                    maxLength={50}
                  />
                </label>
                <button
                  className="button primary full"
                  disabled={
                    !scenarioName.trim() ||
                    (parsed !== null && !parsed.events.length)
                  }
                  onClick={createScenario}
                >
                  確認並建立情境 ↗
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">YOUR DATA, YOUR CHOICE</span>
                <h2>資料與隱私</h2>
                <p>
                  財務資料與報告保存在目前瀏覽器的
                  localStorage，不會自動上傳。這份儲存沒有加密，同一瀏覽器使用者可存取，請避免在共用電腦輸入真實財務資料。
                </p>
                <p>
                  只有點選「生成 AI 決策說明」時，方案名稱與分析摘要才會透過本機
                  API 轉送至設定的模型服務。其他功能可完全在本機執行。
                </p>
                <button
                  className="button secondary full"
                  onClick={() =>
                    download(
                      'MoneyTwin-備份.json',
                      JSON.stringify({ profile, scenarios, reports }, null, 2),
                      'application/json',
                    )
                  }
                >
                  下載資料備份 ↓
                </button>
                <button
                  className="button danger-button full"
                  onClick={() => {
                    if (
                      confirm(
                        '將刪除此瀏覽器全部 MoneyTwin 資料，並恢復示範資料。此操作無法復原。',
                      )
                    ) {
                      try {
                        localStorage.removeItem(storageKey);
                      } catch {
                        notify(
                          '無法清除瀏覽器儲存，請由瀏覽器設定刪除此網站資料。',
                        );
                        return;
                      }
                      setProfile(initialProfile);
                      setDraft(initialProfile);
                      setScenarios(initialScenarios);
                      setReports([]);
                      setSelected('rent');
                      setAiText('');
                      setModal(null);
                      navigate('overview');
                      notify('已刪除本機資料，目前顯示合成示範案例。');
                    }
                  }}
                >
                  清除所有資料並重設
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
export default App;
