export type TradeResult = 'Win' | 'Loss' | 'BE' | "Didn't take"
export type AccountType = 'Live' | 'Funded' | 'Eval'
export type SessionType = 'NY' | 'Asia' | 'London'

// ── Trading Accounts ──────────────────────────────────────────────────────────

export interface LiveAccount {
  id: string
  type: 'Live'
  name: string
  broker: string
  balance: number
  createdAt: string
}

export interface EvalAccount {
  id: string
  type: 'Eval'
  name: string
  propFirm: string
  size: number
  maxDrawdown: number
  profitTarget: number
  startingBalance?: number  // balance when account was added to app (if different from size)
  createdAt: string
}

export interface FundedAccount {
  id: string
  type: 'Funded'
  name: string
  propFirm: string
  size: number
  createdAt: string
}

export type TradingAccount = LiveAccount | EvalAccount | FundedAccount

export type Emotion =
  | 'very_happy'
  | 'happy'
  | 'neutral'
  | 'frustrated'
  | 'angry'
  | 'very_angry'

export interface TradeLog {
  id: string
  result: TradeResult
  accounts: string[]
  symbol: string
  side: 'Long' | 'Short'
  contracts: string
  entryPrice: string
  exitPrice: string
  targetPrice: string      // actual target price level
  takeProfit: string       // TP in points
  stopLoss: string         // SL in points
  pnl: string              // gross P&L, auto-calculated from symbol/entry/exit/contracts
  fees: string             // trading fees in dollars
  drawdown: string         // points of drawdown — shown for Win / BE / Faded
  duration: string         // trade duration e.g. "45m", "2h"
  tradeNumber: string      // trade # for the day
  confluences: string[]
  sessions: string[]       // session tags (flexible strings)
  dol: string[]            // draw on liquidity tags
  htfImgKey?: string       // high timeframe screenshot (base64)
  execImgKey?: string      // execution screenshot (base64)
  setup?: string           // setup description e.g. "5m FVG entry"
  grade?: string           // trade grade: A+, A, B, C, D, F (auto-calculated)
  time?: string            // trade time HH:MM
  notes?: string           // post-trade reflections

  // ICT / Trade Context
  htfBias?: string                  // 'Bullish' | 'Bearish' | 'Neutral' | ''
  internalRangeLiquidity?: string[] // e.g. ["FVG (5m)", "FVG (15m)"]
  externalRangeLiquidity?: string[] // e.g. ["Swing High (Daily)"]
  liquiditySwept?: string[]         // e.g. ["Swing Low (15m)"]
  smtPresent?: string[]             // e.g. ["SMT (5m)"]
  cisdPresent?: string[]            // e.g. ["CISD (15m)"]
  displacement?: string             // 'Yes' | 'No' | ''
  fvgPresent?: string[]             // e.g. ["FVG (5m)"]
  ifvgPresent?: string[]            // e.g. ["iFVG (1m)"]
  rejectionBlock?: string[]         // e.g. ["Rejection Block (15m)"]
  entryModel?: string[]             // custom entry models (library-backed multi-select)
  setupType?: string
  timeframeExecuted?: string        // e.g. "5m"
  marketCondition?: string          // 'ERL to IRL' | 'IRL to ERL' | ''
  exitReason?: string[]             // ["Full TP", "Partials", "Trailed Out", "BE", "Stop Loss"]
  newsPresent?: string              // 'Yes' | 'No' | ''
  newsType?: string
  screenshots?: string[]            // base64 encoded images (dynamic list)
  orderBlock?: string[]             // e.g. ["OB (5m)"]
  bprPresent?: string[]             // e.g. ["BPR (15m)"]
  exitPartials?: { price: string; qty: string }[]  // partial exits: price + contracts taken off
  stdvPresent?: string[]            // e.g. ["STDV -2 (5m)", "STDV -4 (15m)"]
  otePresent?: string[]             // e.g. ["OTE (1hr)"]
  propFirm?: string
  copyTraded?: string               // 'Yes' | 'No' | ''
  copyTradedAccounts?: string[]     // accounts the trade was copy traded to (P&L multiplies per account)
  playbookUsed?: string
  aplusSetup?: string               // 'Yes' | 'No' | ''
  targetLogic?: string
  paybackUsed?: string              // 'Yes' | 'No' | ''
  riskPlacementLogic?: string
  ipvdPresent?: string              // 'Yes' | 'No' | ''
  newsImpact?: string
}

export interface TradingRule {
  id: string
  text: string
}

export interface JournalEntry {
  id: string
  date: string             // YYYY-MM-DD
  premktImgKey?: string
  premktAnalysis: string
  redFolderNews: boolean
  redFolderNewsText: string
  trades: TradeLog[]
  emotion?: Emotion
  postMarketNotes: string
  rulesFollowed: string[]  // IDs of TradingRules followed this day
  updatedAt: string
}

export interface MonthlyGoal {
  amount: number
  month: string            // YYYY-MM
}

export type DiaryEntries = Record<string, string> // date (YYYY-MM-DD) → diary text

export interface DiaryTemplate {
  id: string
  name: string
  content: string
}

export interface AppSettings {
  timezone: string         // e.g. "America/New_York"
  darkMode: boolean
  dailyReminder: boolean
  dateFormat: string       // 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  reduceMotion: boolean
  weeklySummary: boolean
  ruleBreakAlerts: boolean
}

export interface DashTrade {
  id: string
  date: string
  pnl: number
  result: TradeResult
  symbol: string
  side: 'Long' | 'Short'
}
