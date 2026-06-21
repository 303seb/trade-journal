// ── Journal types ─────────────────────────────────────────────────────────────
export type TradeResult = 'Win' | 'Loss' | 'BE' | "Didn't take"

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
  symbol: string           // NQ | ES | GC | MNQ | MES | MGC
  side: 'Long' | 'Short'
  pnl: string              // dollar P&L entered by user, e.g. "250" or "-150"
  entryPrice: string
  exitPrice: string
  confluences: string[]
}

export interface JournalEntry {
  id: string
  date: string             // YYYY-MM-DD
  premktImgKey?: string
  premktAnalysis: string
  trades: TradeLog[]
  emotion?: Emotion
  postMarketNotes: string
  updatedAt: string
}

export interface MonthlyGoal {
  amount: number
  month: string            // YYYY-MM
}

// ── Derived dashboard trade (computed from JournalEntry.trades) ───────────────
export interface DashTrade {
  id: string
  date: string
  pnl: number
  result: TradeResult
  symbol: string
  side: 'Long' | 'Short'
}
