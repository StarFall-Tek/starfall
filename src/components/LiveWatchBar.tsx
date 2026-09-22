import { LIVE_WATCH_MS, setLiveWatchEnabled, useLiveWatchEnabled } from '../lib/liveWatch'
import { formatEt } from '../lib/format'
import { useQuoteSnap } from '../lib/quoteStore'

const seconds = Math.round(LIVE_WATCH_MS / 1000)

export function LiveWatchBar() {
  const on = useLiveWatchEnabled()
  const snap = useQuoteSnap()
  const asOf = snap.fetchedAt ? formatEt(new Date(snap.fetchedAt)) : null

  return (
    <div className="live-watch">
      <p className="timestamp">
        <span className={`live-dot ${on ? 'on' : ''}`} aria-hidden />
        Live watch {on ? 'on' : 'paused'}
        {asOf ? ` · updated ${asOf}` : ' · waiting for Coinbase'}
        {snap.loading ? ' · updating' : ''}
        <span className="live-note">
          {on
            ? `Public prices about every ${seconds}s while this screen is open.`
            : 'Paused. No repeat pull until you resume.'}
        </span>
      </p>
      <button
        type="button"
        className="btn tiny"
        aria-pressed={on}
        onClick={() => setLiveWatchEnabled(!on)}
      >
        {on ? 'Pause' : 'Resume'}
      </button>
    </div>
  )
}
