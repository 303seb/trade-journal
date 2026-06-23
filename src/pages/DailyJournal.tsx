import { useState, useRef, useEffect } from 'react'
import { CalendarDays, FileText, Plus } from 'lucide-react'
import type { DiaryEntries } from '../types'

interface DailyJournalProps {
  diaryEntries: DiaryEntries
  onSave: (date: string, text: string) => void
  initialDate?: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateFull(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function DailyJournal({ diaryEntries, onSave, initialDate }: DailyJournalProps) {
  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState(initialDate ?? today)
  const [draft, setDraft] = useState(diaryEntries[initialDate ?? today] || '')
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Jump to a new initialDate when navigated from calendar
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate)
    }
  }, [initialDate])

  // Sync draft when selecting a different date
  useEffect(() => {
    setDraft(diaryEntries[selectedDate] || '')
    setTimeout(() => textRef.current?.focus(), 50)
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save on every change (localStorage is fast)
  const handleChange = (v: string) => {
    setDraft(v)
    onSave(selectedDate, v)
  }

  const selectDate = (d: string) => {
    setSelectedDate(d)
  }

  const addTodayEntry = () => {
    selectDate(today)
    if (!diaryEntries[today]) {
      onSave(today, '')
    }
  }

  // Sorted list of dates with entries, newest first
  const sortedDates = Object.keys(diaryEntries)
    .filter(d => diaryEntries[d]?.trim())
    .sort((a, b) => b.localeCompare(a))

  // Ensure today always shows in list if selected
  const listDates = sortedDates.includes(today) ? sortedDates
    : selectedDate === today ? [today, ...sortedDates] : sortedDates

  const currentText = draft
  const words = wordCount(currentText)
  const chars = currentText.length

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 256, flexShrink: 0, borderRight: '1px solid #141414',
        display: 'flex', flexDirection: 'column', background: '#080808',
        boxShadow: '2px 0 12px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #141414' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={16} color="#888" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0', letterSpacing: '-0.01em' }}>Daily Journal</span>
          </div>
          <button
            onClick={addTodayEntry}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 12px', borderRadius: 9, border: '1px solid #1f1f1f',
              background: selectedDate === today ? '#1a1a1a' : '#111',
              color: selectedDate === today ? '#f0f0f0' : '#777',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={e => {
              e.currentTarget.style.background = selectedDate === today ? '#1a1a1a' : '#111'
              e.currentTarget.style.color = selectedDate === today ? '#f0f0f0' : '#777'
            }}
          >
            <CalendarDays size={13} />
            Today
          </button>
        </div>

        {/* Date input to pick any date */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #0e0e0e' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Jump to Date</div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => selectDate(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 7,
              padding: '6px 10px', fontSize: 12, color: '#888', outline: 'none',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          />
        </div>

        {/* Entries list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {listDates.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <Plus size={24} color="#222" style={{ marginBottom: 8 }} />
              <p style={{ color: '#333', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                No entries yet.<br />Start writing today.
              </p>
            </div>
          ) : (
            listDates.map(date => {
              const isSelected = date === selectedDate
              const preview = (diaryEntries[date] || '').trim().slice(0, 60)
              const isToday = date === today
              return (
                <button
                  key={date}
                  onClick={() => selectDate(date)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 9,
                    background: isSelected ? '#1a1a1a' : 'transparent',
                    border: `1px solid ${isSelected ? '#2a2a2a' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.12s', marginBottom: 2,
                    fontFamily: 'inherit',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#101010' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#f0f0f0' : '#888' }}>
                      {formatDateShort(date)}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Today
                      </span>
                    )}
                  </div>
                  {preview && (
                    <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {preview}{(diaryEntries[date] || '').length > 60 ? '…' : ''}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '20px 32px 16px', borderBottom: '1px solid #141414', background: '#080808' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em', marginBottom: 2 }}>
            {formatDateFull(selectedDate)}
          </div>
          <div style={{ fontSize: 12, color: '#444' }}>
            {selectedDate === today ? 'Today' : selectedDate}
          </div>
        </div>

        {/* Textarea area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <textarea
            ref={textRef}
            value={currentText}
            onChange={e => handleChange(e.target.value)}
            placeholder={`Write your thoughts for ${selectedDate === today ? 'today' : formatDateShort(selectedDate)}…\n\nReflect on the market, your mindset, what went well, what to improve, personal notes — this is your private daily diary.`}
            style={{
              width: '100%',
              minHeight: 'calc(100vh - 280px)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 16,
              color: '#d0d0d0',
              lineHeight: 1.85,
              fontFamily: 'inherit',
              caretColor: '#4ade80',
            }}
          />
        </div>

        {/* Footer status bar */}
        <div style={{
          flexShrink: 0, padding: '10px 32px', borderTop: '1px solid #111',
          display: 'flex', alignItems: 'center', gap: 16, background: '#070707',
        }}>
          <span style={{ fontSize: 12, color: '#333' }}>
            {words} word{words !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 12, color: '#222' }}>·</span>
          <span style={{ fontSize: 12, color: '#333' }}>
            {chars} character{chars !== 1 ? 's' : ''}
          </span>
          {currentText.trim() && (
            <>
              <span style={{ fontSize: 12, color: '#222' }}>·</span>
              <span style={{ fontSize: 12, color: '#2a4a2a' }}>Auto-saved</span>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
