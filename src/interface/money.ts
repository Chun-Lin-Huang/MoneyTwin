export interface Profile {
  name: string;
  income: number;
  fixed: number;
  variable: number;
  savings: number;
  debt: number;
  reserve: number;
  goal: number;
  goalName: string;
  start: string;
}
export type EventKind =
  'rent' | 'unemployment' | 'income' | 'expense' | 'cost' | 'study';
export interface LifeEvent {
  id: string;
  kind: EventKind;
  amount: number;
  start: number;
  duration: number;
  upfront: number;
}
export interface Scenario {
  id: string;
  name: string;
  color: string;
  events: LifeEvent[];
}
export interface Month {
  month: number;
  label: string;
  opening: number;
  income: number;
  expenses: number;
  debt: number;
  other: number;
  net: number;
  balance: number;
  threshold: number;
  coverage: number | null;
  details: string[];
}
export interface Result {
  scenario: Scenario;
  months: Month[];
  end: number;
  minimum: number;
  minimumMonth: number;
  firstWarning: number | null;
  firstDeficit: number | null;
  warningMonths: number;
  maxNegativeRun: number;
}
export interface SavedReport {
  id: string;
  date: string;
  name: string;
  profile: Profile;
  scenarios: Scenario[];
}
