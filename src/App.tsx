import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import type { Page } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Journal } from './pages/Journal'
import { Analytics } from './pages/Analytics'
import { Accounts } from './pages/Accounts'
import { DailyJournal } from './pages/DailyJournal'
import { Settings } from './pages/Settings'
import { AuthScreen } from './components/AuthScreen'
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import './index.css'

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: 16 }}>
      {label} — coming soon
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [journalDate, setJournalDate] = useState<string | undefined>()
  const [diaryInitialDate, setDiaryInitialDate] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const {
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
  } = useStore()

  // Apply theme on mount and when settings change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appSettings.darkMode ? 'dark' : 'light')
  }, [appSettings.darkMode])

  const navigateToJournal = (date?: string) => {
    setJournalDate(date)
    setPage('trades')
  }

  const navigateToDiary = (date: string) => {
    setDiaryInitialDate(date)
    setPage('diary')
  }

  const diaryDates = Object.keys(diaryEntries).filter(k => diaryEntries[k]?.trim())

  // Still checking session
  if (session === undefined) {
    return <div style={{ minHeight: '100vh', background: '#0e0e0e' }} />
  }

  // Not logged in
  if (session === null) {
    return <AuthScreen />
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar
        page={page}
        onNavigate={p => { setPage(p); if (p !== 'trades') setJournalDate(undefined); if (p === 'diary') setDiaryInitialDate(undefined) }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
        onLogout={handleLogout}
        userEmail={session.user.email}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {page === 'dashboard' && (
          <div className="h-full overflow-y-auto">
            <Dashboard
              journalEntries={journalEntries}
              monthlyGoals={monthlyGoals}
              tradingRules={tradingRules}
              onSetGoal={setMonthlyGoal}
              onNavigateToJournal={navigateToJournal}
              onNavigateToDiary={navigateToDiary}
              diaryDates={diaryDates}
            />
          </div>
        )}
        {page === 'trades' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
            <Journal
              entries={journalEntries}
              confluenceTags={confluenceTags}
              tradingRules={tradingRules}
              tradingAccounts={tradingAccounts}
              onSave={upsertJournalEntry}
              onDelete={deleteJournalEntry}
              onAddConfluenceTag={addConfluenceTag}
              onDeleteConfluenceTag={deleteConfluenceTag}
              onAddTradingRule={addTradingRule}
              onRemoveTradingRule={removeTradingRule}
              onUpdateTradingRule={updateTradingRule}
              initialDate={journalDate}
            />
          </div>
        )}
        {page === 'analytics' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Analytics
              journalEntries={journalEntries}
              tradingAccounts={tradingAccounts}
            />
          </div>
        )}
        {page === 'news' && <Placeholder label="News" />}
        {page === 'accounts' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Accounts
              accounts={tradingAccounts}
              entries={journalEntries}
              onAdd={addTradingAccount}
              onUpdate={updateTradingAccount}
              onDelete={deleteTradingAccount}
            />
          </div>
        )}
        {page === 'diary' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <DailyJournal
              diaryEntries={diaryEntries}
              onSave={saveDiaryEntry}
              initialDate={diaryInitialDate}
              templates={diaryTemplates}
              onSaveTemplate={saveDiaryTemplate}
              onDeleteTemplate={deleteDiaryTemplate}
            />
          </div>
        )}
        {page === 'settings' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Settings
              settings={appSettings}
              onUpdate={updateAppSettings}
              journalEntries={journalEntries}
              diaryEntries={diaryEntries}
              tradingAccounts={tradingAccounts}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
