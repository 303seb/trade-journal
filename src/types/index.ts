// ── Dashboard types ───────────────────────────────────────────────────────────
export interface Trade {
  id: string
  date: string // YYYY-MM-DD
  symbol: string
  side: 'Long' | 'Short'
  contracts: number
  entryPrice: number
  exitPrice: number
  pnl: number
  notes: string
  createdAt: string
}

export interface MonthlyGoal {
  amount: number
  month: string // YYYY-MM
}

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
  entryPrice: string
  exitPrice: string
  confluences: string[]
}

export interface JournalEntry {
  id: string
  date: string // YYYY-MM-DD
  // Premarket
  premktImgKey?: string
  premktAnalysis: string
  // Trades
  trades: TradeLog[]
  // Post Market
  emotion?: Emotion
  postMarketNotes: string
  updatedAt: string
}
