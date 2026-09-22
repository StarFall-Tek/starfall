export type TabId = 'digest' | 'paper' | 'rooms' | 'settings'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'digest', label: 'Digest', icon: '✦' },
  { id: 'paper', label: 'Paper', icon: '◇' },
  { id: 'rooms', label: 'Rooms', icon: '◈' },
  { id: 'settings', label: 'Settings', icon: '⊛' },
]

type Props = {
  active: TabId
  onChange: (id: TabId) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab ${active === t.id ? 'active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
