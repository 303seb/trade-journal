import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { JournalEntry, MonthlyGoal, TradingRule, TradingAccount, DiaryEntries, AppSettings, DiaryTemplate } from '../types'
import { normalizeJournalEntries } from '../utils/stats'

const DEFAULT_CONFLUENCES = [
  'Order Block', 'Fair Value Gap', 'Breaker Block', 'MSS', 'ChoCh',
  'Liquidity Sweep', 'Displacement', 'OTE', 'Power of 3',
  'NWOG', 'NDOG', 'Mitigation Block', 'Rejection Block',
]

const DEFAULT_SETTINGS: AppSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  darkMode: true,
  dailyReminder: false,
  dateFormat: 'MM/DD/YYYY',
  reduceMotion: false,
  weeklySummary: false,
  ruleBreakAlerts: false,
}

// Read from localStorage for one-time migration of existing data
const LOCAL_KEYS = {
  journal: 'tj_journal', goals: 'tj_goals', confluences: 'tj_confluences',
  rules: 'tj_rules', accounts: 'tj_accounts', diary: 'tj_diary',
  settings: 'tj_settings', templates: 'tj_diary_templates',
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useStore(userId: string) {
  const [loading, setLoading] = useState(true)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([])
  const [confluenceTags, setConfluenceTags] = useState<string[]>(DEFAULT_CONFLUENCES)
  const [tradingRules, setTradingRules] = useState<TradingRule[]>([])
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccount[]>([])
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntries>({})
  const [diaryTemplates, setDiaryTemplates] = useState<DiaryTemplate[]>([])
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // Load from Supabase on mount; migrate localStorage if first login
  useEffect(() => {
    if (!userId) return  // wait until we have a real user ID
    const load = async () => {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load user data:', error)
      }

      if (data) {
        if (data.journal_entries) setJournalEntries(normalizeJournalEntries(data.journal_entries))
        if (data.monthly_goals)   setMonthlyGoals(data.monthly_goals)
        if (data.confluence_tags) setConfluenceTags(data.confluence_tags)
        if (data.trading_rules)   setTradingRules(data.trading_rules)
        if (data.trading_accounts) setTradingAccounts(data.trading_accounts)
        if (data.diary_entries)   setDiaryEntries(data.diary_entries)
        if (data.diary_templates) setDiaryTemplates(data.diary_templates)
        if (data.app_settings)    setAppSettings(data.app_settings)
      } else {
        // First login — migrate any existing localStorage data
        const localData = {
          journal_entries:  normalizeJournalEntries(readLocal<JournalEntry[]>(LOCAL_KEYS.journal, [])),
          monthly_goals:    readLocal<MonthlyGoal[]>(LOCAL_KEYS.goals, []),
          confluence_tags:  readLocal<string[]>(LOCAL_KEYS.confluences, DEFAULT_CONFLUENCES),
          trading_rules:    readLocal<TradingRule[]>(LOCAL_KEYS.rules, []),
          trading_accounts: readLocal<TradingAccount[]>(LOCAL_KEYS.accounts, []),
          diary_entries:    readLocal<DiaryEntries>(LOCAL_KEYS.diary, {}),
          diary_templates:  readLocal<DiaryTemplate[]>(LOCAL_KEYS.templates, []),
          app_settings:     readLocal<AppSettings>(LOCAL_KEYS.settings, DEFAULT_SETTINGS),
        }
        setJournalEntries(localData.journal_entries)
        setMonthlyGoals(localData.monthly_goals)
        setConfluenceTags(localData.confluence_tags)
        setTradingRules(localData.trading_rules)
        setTradingAccounts(localData.trading_accounts)
        setDiaryEntries(localData.diary_entries)
        setDiaryTemplates(localData.diary_templates)
        setAppSettings(localData.app_settings)

        await supabase.from('user_data').insert({ id: userId, ...localData })
      }

      setLoading(false)
    }
    load()
  }, [userId])

  const save = useCallback(async (patch: Record<string, unknown>) => {
    await supabase.from('user_data').upsert({
      id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    })
  }, [userId])

  const upsertJournalEntry = useCallback((entry: JournalEntry) => {
    setJournalEntries(prev => {
      const exists = prev.some(e => e.date === entry.date)
      const next = exists
        ? prev.map(e => e.date === entry.date ? { ...entry, updatedAt: new Date().toISOString() } : e)
        : [...prev, { ...entry, updatedAt: new Date().toISOString() }]
      save({ journal_entries: next })
      return next
    })
  }, [save])

  const deleteJournalEntry = useCallback((date: string) => {
    setJournalEntries(prev => {
      const next = prev.filter(e => e.date !== date)
      save({ journal_entries: next })
      return next
    })
  }, [save])

  const setMonthlyGoal = useCallback((month: string, amount: number) => {
    setMonthlyGoals(prev => {
      const next = prev.some(g => g.month === month)
        ? prev.map(g => g.month === month ? { ...g, amount } : g)
        : [...prev, { month, amount }]
      save({ monthly_goals: next })
      return next
    })
  }, [save])

  const addConfluenceTag = useCallback((tag: string) => {
    setConfluenceTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      save({ confluence_tags: next })
      return next
    })
  }, [save])

  const deleteConfluenceTag = useCallback((tag: string) => {
    setConfluenceTags(prev => {
      const next = prev.filter(t => t !== tag)
      save({ confluence_tags: next })
      return next
    })
  }, [save])

  const addTradingRule = useCallback((text: string) => {
    setTradingRules(prev => {
      const next = [...prev, { id: genId(), text }]
      save({ trading_rules: next })
      return next
    })
  }, [save])

  const removeTradingRule = useCallback((id: string) => {
    setTradingRules(prev => {
      const next = prev.filter(r => r.id !== id)
      save({ trading_rules: next })
      return next
    })
  }, [save])

  const updateTradingRule = useCallback((id: string, text: string) => {
    setTradingRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, text } : r)
      save({ trading_rules: next })
      return next
    })
  }, [save])

  const addTradingAccount = useCallback((account: TradingAccount) => {
    setTradingAccounts(prev => {
      const next = [...prev, account]
      save({ trading_accounts: next })
      return next
    })
  }, [save])

  const updateTradingAccount = useCallback((account: TradingAccount) => {
    setTradingAccounts(prev => {
      const next = prev.map(a => a.id === account.id ? account : a)
      save({ trading_accounts: next })
      return next
    })
  }, [save])

  const deleteTradingAccount = useCallback((id: string) => {
    setTradingAccounts(prev => {
      const next = prev.filter(a => a.id !== id)
      save({ trading_accounts: next })
      return next
    })
  }, [save])

  const saveDiaryEntry = useCallback((date: string, text: string) => {
    setDiaryEntries(prev => {
      const next = { ...prev }
      if (text.trim()) next[date] = text
      else delete next[date]
      save({ diary_entries: next })
      return next
    })
  }, [save])

  const saveDiaryTemplate = useCallback((name: string, content: string) => {
    setDiaryTemplates(prev => {
      const next = [...prev, { id: genId(), name, content }]
      save({ diary_templates: next })
      return next
    })
  }, [save])

  const deleteDiaryTemplate = useCallback((id: string) => {
    setDiaryTemplates(prev => {
      const next = prev.filter(t => t.id !== id)
      save({ diary_templates: next })
      return next
    })
  }, [save])

  const updateAppSettings = useCallback((settings: AppSettings) => {
    setAppSettings(settings)
    save({ app_settings: settings })
  }, [save])

  return {
    loading,
    journalEntries,
    monthlyGoals,
    confluenceTags,
    tradingRules,
    upsertJournalEntry,
    deleteJournalEntry,
    setMonthlyGoal,
    addConfluenceTag,
    deleteConfluenceTag,
    addTradingRule,
    removeTradingRule,
    updateTradingRule,
    tradingAccounts,
    addTradingAccount,
    updateTradingAccount,
    deleteTradingAccount,
    diaryEntries,
    saveDiaryEntry,
    diaryTemplates,
    saveDiaryTemplate,
    deleteDiaryTemplate,
    appSettings,
    updateAppSettings,
  }
}
