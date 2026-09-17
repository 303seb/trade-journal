import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Plus, MoreHorizontal,
  Share2, Star, FileText, BarChart3, CalendarDays, Layers, Trash2, Copy,
  Bold, Italic, Underline, Strikethrough, List, CheckSquare, Heading1, Heading2, Eraser, ImagePlus,
} from 'lucide-react'
import type { Note, NoteCategory, JournalEntry } from '../types'
import { genId } from '../store/useStore'
import { getDashTrades, getDayPnl, formatCurrency } from '../utils/stats'
import { useMobile } from '../hooks/useMobile'

interface NotebookProps {
  notes: Note[]
  journalEntries: JournalEntry[]
  onUpsertNote: (note: Note) => void
  onDeleteNote: (id: string) => void
}

type FilterKey = 'all' | 'favorites' | 'trade' | 'daily' | 'session' | 'general'

const CAT_LABEL: Record<NoteCategory, string> = {
  daily: 'Daily Journal', trade: 'Trade Notes', session: 'Sessions Recap', general: 'Note',
}

function defaultTitle(cat: NoteCategory, date?: string): string {
  if (cat === 'daily' && date) return fmtDayTitle(date)
  if (cat === 'trade') return 'Trade note'
  if (cat === 'session') return 'Session recap'
  return 'Untitled note'
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDayTitle(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const rest = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${wd} ${rest}`
}

function fmtShortDay(date: string): { top: string; sub: string } {
  const d = new Date(date + 'T12:00:00')
  return {
    top: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }),
    sub: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}

function fmtStamp(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
}

const TEXT_COLORS = [
  { name: 'Default', v: 'var(--text)' },
  { name: 'Gold',    v: '#e0a92e' },
  { name: 'Green',   v: '#22c55e' },
  { name: 'Red',     v: '#ef4444' },
  { name: 'Blue',    v: '#3b82f6' },
  { name: 'Purple',  v: '#a855f7' },
]

// ── Rich text editor ────────────────────────────────────────────────────────
function RichEditor({ noteId, initialHtml, onChange }: {
  noteId: string
  initialHtml: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [colorOpen, setColorOpen] = useState(false)

  // Load content whenever the selected note changes
  useLayoutEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flush = useCallback(() => {
    if (ref.current) onChangeRef.current(ref.current.innerHTML)
  }, [])

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 450)
  }, [flush])

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    schedule()
  }

  const insertChecklist = () => {
    ref.current?.focus()
    document.execCommand('insertHTML', false,
      '<ul class="nb-check"><li data-checked="false">&#8203;</li></ul>')
    schedule()
  }

  const insertImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      ref.current?.focus()
      document.execCommand('insertHTML', false, `<img src="${src}" alt="" /><p><br/></p>`)
      flush()
    }
    reader.readAsDataURL(file)
  }

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(insertImageFile)
    e.target.value = ''
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const img = Array.from(e.clipboardData.items).find(it => it.type.startsWith('image/'))
    if (img) {
      const file = img.getAsFile()
      if (file) { e.preventDefault(); insertImageFile(file) }
    }
  }

  // Toggle a checklist item when its checkbox gutter is clicked
  const onClick = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest('.nb-check > li') as HTMLLIElement | null
    if (!li) return
    const rect = li.getBoundingClientRect()
    if (e.clientX - rect.left <= 30) {
      li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')
      flush()
    }
  }

  const tBtn = (title: string, Icon: typeof Bold, onClick: () => void): React.ReactNode => (
    <button key={title} title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      style={{
        display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8,
        border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)' }}>
      <Icon size={16} />
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '4px 0 14px' }}>
        {tBtn('Heading', Heading1, () => exec('formatBlock', 'H2'))}
        {tBtn('Subheading', Heading2, () => exec('formatBlock', 'H3'))}
        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
        {tBtn('Bold', Bold, () => exec('bold'))}
        {tBtn('Italic', Italic, () => exec('italic'))}
        {tBtn('Underline', Underline, () => exec('underline'))}
        {tBtn('Strikethrough', Strikethrough, () => exec('strikeThrough'))}
        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
        {tBtn('Bullet list', List, () => exec('insertUnorderedList'))}
        {tBtn('Checklist', CheckSquare, insertChecklist)}
        {tBtn('Insert image', ImagePlus, () => fileRef.current?.click())}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickImage} style={{ display: 'none' }} />
        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
        {/* Color */}
        <div style={{ position: 'relative' }}>
          <button title="Text color" onMouseDown={e => e.preventDefault()} onClick={() => setColorOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            <span style={{ width: 15, height: 15, borderRadius: 4, background: 'linear-gradient(135deg,#e0a92e,#22c55e,#3b82f6,#a855f7)' }} />
            A
          </button>
          {colorOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: 'var(--shadow-card)', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: 150 }}>
              {TEXT_COLORS.map(c => (
                <button key={c.name} title={c.name} onMouseDown={e => e.preventDefault()}
                  onClick={() => { exec('foreColor', c.v); setColorOpen(false) }}
                  style={{ height: 30, borderRadius: 7, border: '1px solid var(--border-mid)', background: 'var(--bg-card)', cursor: 'pointer', color: c.v, fontWeight: 800, fontSize: 15 }}>A</button>
              ))}
            </div>
          )}
        </div>
        {tBtn('Clear formatting', Eraser, () => exec('removeFormat'))}
      </div>

      {/* Editable surface */}
      <div
        ref={ref}
        className="nb-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={schedule}
        onBlur={flush}
        onClick={onClick}
        onPaste={onPaste}
        data-placeholder="Start writing your notes…"
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', outline: 'none',
          fontSize: 17, lineHeight: 1.7, color: 'var(--text-sub)', paddingBottom: 40,
        }}
      />
    </div>
  )
}

// ── Notebook page ─────────────────────────────────────────────────────────────
export function Notebook({ notes, journalEntries, onUpsertNote, onDeleteNote }: NotebookProps) {
  const isMobile = useMobile()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dailyOpen, setDailyOpen] = useState(true)
  const [showAllDaily, setShowAllDaily] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'note'>('list')
  const [toast, setToast] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const dashTrades = useMemo(() => getDashTrades(journalEntries), [journalEntries])

  const counts = useMemo(() => ({
    all: notes.length,
    favorites: notes.filter(n => n.favorite).length,
    trade: notes.filter(n => n.category === 'trade').length,
    daily: notes.filter(n => n.category === 'daily').length,
    session: notes.filter(n => n.category === 'session').length,
  }), [notes])

  const dailyNotes = useMemo(
    () => notes.filter(n => n.category === 'daily')
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [notes],
  )

  const listNotes = useMemo(() => {
    let arr = notes
    if (filter === 'favorites') arr = arr.filter(n => n.favorite)
    else if (filter !== 'all') arr = arr.filter(n => n.category === filter)
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter(n => n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q))
    return [...arr].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }, [notes, filter, query])

  const selected = notes.find(n => n.id === selectedId) || null

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const openNote = (id: string) => { setSelectedId(id); if (isMobile) setMobileView('note') }

  const createNote = (category: NoteCategory, date?: string) => {
    const now = new Date().toISOString()
    const note: Note = {
      id: genId(), title: defaultTitle(category, date), content: '',
      category, date, favorite: false, createdAt: now, updatedAt: now,
    }
    onUpsertNote(note)
    openNote(note.id)
  }

  const addDailyNote = () => {
    const d = todayStr()
    const existing = dailyNotes.find(n => n.date === d)
    if (existing) { openNote(existing.id); return }
    createNote('daily', d)
  }

  const patch = useCallback((p: Partial<Note>) => {
    if (!selected) return
    onUpsertNote({ ...selected, ...p, updatedAt: new Date().toISOString() })
  }, [selected, onUpsertNote])

  const patchContent = useCallback((html: string) => {
    // avoid bumping updatedAt spuriously if nothing changed
    if (!selected || selected.content === html) return
    onUpsertNote({ ...selected, content: html, updatedAt: new Date().toISOString() })
  }, [selected, onUpsertNote])

  const duplicateNote = () => {
    if (!selected) return
    const now = new Date().toISOString()
    const copy: Note = { ...selected, id: genId(), title: selected.title + ' (copy)', favorite: false, createdAt: now, updatedAt: now }
    onUpsertNote(copy)
    openNote(copy.id)
    setMenuOpen(false)
  }

  const removeNote = () => {
    if (!selected) return
    onDeleteNote(selected.id)
    setSelectedId(null)
    setMenuOpen(false)
    if (isMobile) setMobileView('list')
  }

  const shareNote = () => {
    if (!selected) return
    const text = `${selected.title}\n\n${stripHtml(selected.content)}`
    navigator.clipboard?.writeText(text).then(() => setToast('Copied to clipboard')).catch(() => setToast('Could not copy'))
  }

  // ── Left list panel ──
  const catRow = (key: FilterKey, Icon: typeof FileText, label: string, count: number) => {
    const active = filter === key
    return (
      <button onClick={() => { setFilter(key); if (isMobile) setMobileView('list') }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
          borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          background: active ? 'var(--bg-active)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--text-muted)', fontSize: 15, fontWeight: active ? 700 : 500,
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
        <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>{count}</span>
      </button>
    )
  }

  const listPanel = (
    <div style={{
      width: isMobile ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: isMobile ? 'none' : '1px solid var(--border)', background: 'var(--bg-panel)', minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tracking</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>Notebook</div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-mid)', background: 'var(--bg-input)' }}>
          <Search size={16} color="var(--text-dim)" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', minWidth: 0 }} />
        </div>
        <button title="New note" onClick={() => createNote('general')}
          style={{ display: 'grid', placeItems: 'center', width: 40, borderRadius: 10, border: '1px solid var(--border-mid)', background: 'var(--btn-bg)', color: 'var(--btn-text)', cursor: 'pointer' }}>
          <Plus size={18} />
        </button>
      </div>

      {/* Categories + note list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
        {catRow('all', FileText, 'All notes', counts.all)}
        {catRow('favorites', Star, 'Favorites', counts.favorites)}
        {catRow('trade', BarChart3, 'Trade Notes', counts.trade)}

        {/* Daily Journal group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 6px' }}>
          <button onClick={() => setDailyOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', color: filter === 'daily' ? 'var(--text)' : 'var(--text-muted)', fontSize: 15, fontWeight: filter === 'daily' ? 700 : 500, fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>
            <CalendarDays size={17} />
            <span style={{ flex: 1 }} onClick={e => { e.stopPropagation(); setFilter('daily') }}>Daily Journal</span>
            <ChevronRight size={15} style={{ transition: 'transform 0.2s', transform: dailyOpen ? 'rotate(90deg)' : 'none', opacity: 0.7 }} />
          </button>
          <button title="Add today's entry" onClick={addDailyNote}
            style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-sub)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}>
            <Plus size={15} />
          </button>
        </div>
        {dailyOpen && (
          <div style={{ paddingLeft: 8 }}>
            {dailyNotes.length === 0 && <div style={{ padding: '4px 14px 8px', fontSize: 13, color: 'var(--text-dim)' }}>No entries yet</div>}
            {(showAllDaily ? dailyNotes : dailyNotes.slice(0, 9)).map(n => {
              const active = n.id === selectedId
              const d = n.date ? fmtShortDay(n.date) : { top: n.title, sub: '' }
              return (
                <button key={n.id} onClick={() => openNote(n.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--bg-active)' : 'transparent', fontFamily: 'inherit', marginBottom: 1,
                    borderLeft: active ? '2px solid var(--btn-bg)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-sub)' }}>{d.top}</div>
                  {d.sub && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 1 }}>{d.sub}</div>}
                </button>
              )
            })}
            {dailyNotes.length > 9 && (
              <button onClick={() => setShowAllDaily(s => !s)}
                style={{ width: '100%', textAlign: 'center', padding: '7px', border: 'none', background: 'transparent', color: '#8b7ff0', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showAllDaily ? 'Show less' : `Show all ${dailyNotes.length}`}
              </button>
            )}
          </div>
        )}

        {catRow('session', Layers, 'Sessions Recap', counts.session)}

        {/* Flat filtered list (when not the daily group) */}
        {filter !== 'daily' && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {listNotes.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--text-dim)' }}>
                {query ? 'No matching notes' : 'No notes here yet'}
              </div>
            )}
            {listNotes.map(n => {
              const active = n.id === selectedId
              return (
                <button key={n.id} onClick={() => openNote(n.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--bg-active)' : 'transparent', fontFamily: 'inherit', marginBottom: 2,
                    borderLeft: active ? '2px solid var(--btn-bg)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {n.favorite && <Star size={12} fill="#e0a92e" color="#e0a92e" />}
                    <span style={{ fontSize: 15, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled note'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {CAT_LABEL[n.category]} · {stripHtml(n.content).slice(0, 60) || 'Empty note'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ── Right editor panel ──
  const dayPnl = selected?.date ? getDayPnl(dashTrades, selected.date) : 0
  const dayTradeCount = selected?.date ? dashTrades.filter(t => t.date === selected.date).length : 0

  const editorPanel = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)' }}>
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>
          <FileText size={44} strokeWidth={1.4} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-sub)' }}>Select a note to read or edit</div>
            <div style={{ fontSize: 15, marginTop: 6 }}>Or create a new one to capture your plan, review, or session recap.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => createNote('general')} style={primaryBtn}><Plus size={16} /> New note</button>
            <button onClick={addDailyNote} style={ghostBtn}><CalendarDays size={16} /> Today's journal</button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: isMobile ? '14px 16px 10px' : '20px 28px 12px' }}>
            {isMobile && (
              <button onClick={() => setMobileView('list')} style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)', cursor: 'pointer', flexShrink: 0 }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <CalendarDays size={20} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                <input
                  value={selected.title}
                  onChange={e => patch({ title: e.target.value })}
                  placeholder="Untitled note"
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: isMobile ? 21 : 25, fontWeight: 800, fontFamily: 'inherit', letterSpacing: '-0.02em' }}
                />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 5, paddingLeft: 29 }}>
                {fmtStamp(selected.createdAt)} <span style={{ opacity: 0.5 }}>•</span> Last update: {fmtStamp(selected.updatedAt)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button title="Favorite" onClick={() => patch({ favorite: !selected.favorite })}
                style={iconBtn}>
                <Star size={17} fill={selected.favorite ? '#e0a92e' : 'none'} color={selected.favorite ? '#e0a92e' : 'var(--text-sub)'} />
              </button>
              {!isMobile && (
                <button onClick={shareNote} style={{ ...iconBtn, width: 'auto', padding: '0 12px', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text-sub)' }}>
                  <Share2 size={16} /> Share
                </button>
              )}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button title="More" onClick={() => setMenuOpen(o => !o)} style={iconBtn}><MoreHorizontal size={18} color="var(--text-sub)" /></button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 45, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 11, boxShadow: 'var(--shadow-card)', padding: 6, minWidth: 172 }}>
                    {isMobile && <MenuItem Icon={Share2} label="Share" onClick={() => { shareNote(); setMenuOpen(false) }} />}
                    <MenuItem Icon={Copy} label="Duplicate" onClick={duplicateNote} />
                    <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                    <MenuItem Icon={Trash2} label="Delete note" danger onClick={removeNote} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Net P&L card — daily notes tied to a date */}
          {selected.date && (
            <div style={{ padding: isMobile ? '0 16px 12px' : '4px 28px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12,
                border: '1px solid var(--border-mid)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net P&amp;L</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: dayTradeCount === 0 ? 'var(--text-muted)' : dayPnl > 0 ? 'var(--color-win)' : dayPnl < 0 ? 'var(--color-loss)' : 'var(--text)' }}>
                  {formatCurrency(dayPnl)}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 13.5, color: 'var(--text-dim)' }}>
                  {dayTradeCount === 0 ? 'No trades this day' : `${dayTradeCount} trade${dayTradeCount === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
          )}

          {/* Editor */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: isMobile ? '0 16px 8px' : '2px 28px 8px' }}>
            <RichEditor noteId={selected.id} initialHtml={selected.content} onChange={patchContent} />
          </div>
        </>
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {(!isMobile || mobileView === 'list') && listPanel}
      {(!isMobile || mobileView === 'note') && editorPanel}

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--bg-active)', color: 'var(--text)', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-card)' }}>
          {toast}
        </div>
      )}

      <style>{`
        .nb-editor:empty:before { content: attr(data-placeholder); color: var(--text-dim); }
        .nb-editor h2 { font-size: 24px; font-weight: 800; color: var(--text); margin: 14px 0 6px; letter-spacing: -0.02em; }
        .nb-editor h3 { font-size: 19px; font-weight: 700; color: var(--text); margin: 12px 0 4px; }
        .nb-editor ul, .nb-editor ol { padding-left: 24px; margin: 4px 0; }
        .nb-editor a { color: #6ea8fe; }
        .nb-editor img { max-width: 100%; height: auto; border-radius: 10px; margin: 8px 0; display: block; border: 1px solid var(--border-mid); }
        .nb-editor ul.nb-check { list-style: none; padding-left: 0; margin: 6px 0; }
        .nb-editor ul.nb-check > li { position: relative; padding-left: 32px; margin: 4px 0; min-height: 24px; }
        .nb-editor ul.nb-check > li:before {
          content: ''; position: absolute; left: 2px; top: 3px; width: 19px; height: 19px;
          border: 2px solid var(--border-strong); border-radius: 5px; cursor: pointer; box-sizing: border-box;
        }
        .nb-editor ul.nb-check > li[data-checked="true"]:before {
          content: '✓'; color: #fff; background: #3b82f6; border-color: #3b82f6;
          font-size: 13px; font-weight: 800; text-align: center; line-height: 15px;
        }
        .nb-editor ul.nb-check > li[data-checked="true"] { color: var(--text-dim); text-decoration: line-through; }
      `}</style>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 9,
  border: '1px solid var(--border-mid)', background: 'var(--bg-card)', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
  border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
  border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

function MenuItem({ Icon, label, onClick, danger }: { Icon: typeof FileText; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', color: danger ? '#ef4444' : 'var(--text-sub)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <Icon size={16} /> {label}
    </button>
  )
}
