import { useState } from 'react'
import { DigestView } from './components/DigestView'
import { PaperDeskView } from './components/PaperDeskView'
import { ScoutView } from './components/ScoutView'
import { RoomsRadarView } from './components/RoomsRadarView'
import { SettingsView } from './components/SettingsView'
import { TabBar, type TabId } from './components/TabBar'

export default function App() {
  const [tab, setTab] = useState<TabId>('digest')

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <img
            src="/starfall-mark.png"
            alt=""
            width={40}
            height={40}
            className="brand-mark"
          />
          <div>
            <p className="brand-name">STARFALL-TEK</p>
            <p className="brand-tag">CRYPTO STUDY ROBOT</p>
          </div>
        </div>
        <span className="badge paper">PAPER</span>
      </header>

      {tab === 'digest' && (
        <div className="hero-wrap">
          <img
            src="/starfall-hero-original.jpg"
            alt="STARFALL-TEK — Crypto Study Robot"
            className="hero-art"
          />
        </div>
      )}

      <main className="main">
        {tab === 'digest' && <DigestView />}
        {tab === 'scout' && <ScoutView />}
        {tab === 'paper' && <PaperDeskView />}
        {tab === 'rooms' && <RoomsRadarView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <footer className="footer">
        <p>Not financial advice.</p>
      </footer>

      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
