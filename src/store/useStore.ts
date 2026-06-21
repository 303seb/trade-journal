import { useState, useCallback } from 'react'
import type { JournalEntry, MonthlyGoal } from '../types'

const KEYS = {
  journal: 'tj_journal',
  goals: 'tj_goals',
  confluences: 'tj_confluences',
}

const DEFAULT_CONFLUENCES = [
  'VWAP', 'Supply Zone', 'Demand Zone', 'Trend', 'Key Level',
  'Breakout', 'Opening Range', 'Gap Fill', 'Volume', 'News',
]

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useStore() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() =>
    load(KEYS.journal, [])
  )
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>(() => load(KEYS.goals, []))
  const [confluenceTags, setConfluenceTags] = useState<string[]>(() => {
    const stored = localStorage.getItem(KEYS.confluences)
    if (stored === null) {
      save(KEYS.confluences, DEFAULT_CONFLUENCES)
      return DEFAULT_CONFLUENCES
    }
    return JSON.parse(stored) as string[]
  })

  const upsertJournalEntry = useCallback((entry: JournalEntry) => {
    setJournalEntries(prev => {
      const exists = prev.some(e => e.date === entry.date)
      const next = exists
        ? prev.map(e => (e.date === entry.date ? { ...entry, updatedAt: new Date().toISOString() } : e))
        : [...prev, { ...entry, updatedAt: new Date().toISOString() }]
      save(KEYS.journal, next)
      return next
    })
  }, [])

  const setMonthlyGoal = useCallback((month: string, amount: number) => {
    setMonthlyGoals(prev => {
      const next = prev.some(g => g.month === month)
        ? prev.map(g => (g.month === month ? { ...g, amount } : g))
        : [...prev, { month, amount }]
      save(KEYS.goals, next)
      return next
    })
  }, [])

  const addConfluenceTag = useCallback((tag: string) => {
    setConfluenceTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      save(KEYS.confluences, next)
      return next
    })
  }, [])

  const deleteConfluenceTag = useCallback((tag: string) => {
    setConfluenceTags(prev => {
      const next = prev.filter(t => t !== tag)
      save(KEYS.confluences, next)
      return next
    })
  }, [])

  return {
    journalEntries,
    monthlyGoals,
    confluenceTags,
    upsertJournalEntry,
    setMonthlyGoal,
    addConfluenceTag,
    deleteConfluenceTag,
  }
}
