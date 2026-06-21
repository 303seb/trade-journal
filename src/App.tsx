import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import type { Page } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Journal } from './pages/Journal'
import { useStore } from './store/useStore'
import './index.css'

function Strategies() {
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Strategies — coming soon
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const {
    trades,
    journalEntries,
    monthlyGoals,
    confluenceTags,
    addTrade,
    deleteTrade,
    upsertJournalEntry,
    setMonthlyGoal,
    addConfluenceTag,
    deleteConfluenceTag,
  } = useStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[#0e0e0e]">
      <Sidebar
        page={page}
        onNavigate={setPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {page === 'dashboard' && (
          <div className="h-full overflow-y-auto">
            <Dashboard
              trades={trades}
              monthlyGoals={monthlyGoals}
              onAddTrade={addTrade}
              onDeleteTrade={deleteTrade}
              onSetGoal={setMonthlyGoal}
            />
          </div>
        )}
        {page === 'journal' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
            <Journal
              entries={journalEntries}
              confluenceTags={confluenceTags}
              onSave={upsertJournalEntry}
              onAddConfluenceTag={addConfluenceTag}
              onDeleteConfluenceTag={deleteConfluenceTag}
            />
          </div>
        )}
        {page === 'strategies' && <Strategies />}
      </main>
    </div>
  )
}

export default App
