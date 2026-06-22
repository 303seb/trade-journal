export type TradeResult = 'Win' | 'Loss' | 'BE' | 'Faded'
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
  htfBias?: string                  // 'Long' | 'Short' | ''
  internalRangeLiquidity?: string[] // e.g. ["FVG (5m)", "FVG (15m)"]
  externalRangeLiquidity?: string[] // e.g. ["Swing High (Daily)"]
  liquiditySwept?: string[]         // e.g. ["Swing Low (15m)"]
  smtPresent?: string[]             // e.g. ["SMT (5m)"]
  cisdPresent?: string[]            // e.g. ["CISD (15m)"]
  displacement?: string             // 'Yes' | 'No' | ''
  fvgPresent?: string[]             // e.g. ["FVG (5m)"]
  ifvgPresent?: string[]            // e.g. ["iFVG (1m)"]
  rejectionBlock?: string[]         // e.g. ["Rejection Block (15m)"]
  entryModel?: string
  setupType?: string
  timeframeExecuted?: string        // e.g. "5m"
  marketCondition?: string          // 'Consolidation' | 'Distribution' | ''
  exitReason?: string[]             // ["Full TP", "Swept Internal High/Low", "SMT"]
  newsPresent?: string              // 'Yes' | 'No' | ''
  newsType?: string
  screenshots?: string[]            // base64 encoded images (dynamic list)
  orderBlock?: string[]             // e.g. ["OB (5m)"]
  bprPresent?: string[]             // e.g. ["BPR (15m)"]
  stdvPresent?: string[]            // e.g. ["STDV (5m)", "STDV -1"]
  otePresent?: string[]             // e.g. ["OTE (1hr)"]
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

export interface AppSettings {
  timezone: string         // e.g. "America/New_York"
  darkMode: boolean
  dailyReminder: boolean
}

export interface DashTrade {
  id: string
  date: string
  pnl: number
  result: TradeResult
  symbol: string
  side: 'Long' | 'Short'
}
