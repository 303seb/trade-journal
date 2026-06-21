import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import type { Page } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Journal } from './pages/Journal'
import { useStore } from './store/useStore'
import './index.css'

function Strategies() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: 14 }}>
      Strategies — coming soon
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [journalDate, setJournalDate] = useState<string | undefined>()

  const {
    journalEntries,
    monthlyGoals,
    confluenceTags,
    tradingRules,
    upsertJournalEntry,
    setMonthlyGoal,
    addConfluenceTag,
    deleteConfluenceTag,
    addTradingRule,
    removeTradingRule,
    updateTradingRule,
  } = useStore()

  const navigateToJournal = (date?: string) => {
    setJournalDate(date)
    setPage('journal')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0e0e0e]">
      <Sidebar
        page={page}
        onNavigate={p => { setPage(p); if (p !== 'journal') setJournalDate(undefined) }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {page === 'dashboard' && (
          <div className="h-full overflow-y-auto">
            <Dashboard
              journalEntries={journalEntries}
              monthlyGoals={monthlyGoals}
              onSetGoal={setMonthlyGoal}
              onNavigateToJournal={navigateToJournal}
            />
          </div>
        )}
        {page === 'journal' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
            <Journal
              entries={journalEntries}
              confluenceTags={confluenceTags}
              tradingRules={tradingRules}
              onSave={upsertJournalEntry}
              onAddConfluenceTag={addConfluenceTag}
              onDeleteConfluenceTag={deleteConfluenceTag}
              onAddTradingRule={addTradingRule}
              onRemoveTradingRule={removeTradingRule}
              onUpdateTradingRule={updateTradingRule}
              initialDate={journalDate}
            />
          </div>
        )}
        {page === 'strategies' && <Strategies />}
      </main>
    </div>
  )
}

export default App
