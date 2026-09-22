import { ROOMS, TRUST_CHECKLIST, TIKTOK_YOUTH_SHILL_BANNER } from '../data/rooms'

const TAG_LABEL = {
  signal: 'signal',
  mixed: 'mixed',
  noise: 'noise',
} as const

export function RoomsRadarView() {
  return (
    <section className="view" aria-labelledby="rooms-title">
      <header className="view-header">
        <h1 id="rooms-title">Rooms radar</h1>
        <p className="muted">
          Curated Discord / Telegram / Reddit / X / TikTok — static list with
          signal-vs-noise tags.
        </p>
      </header>

      <article className="card warn-banner" role="note">
        <h2>{TIKTOK_YOUTH_SHILL_BANNER.title}</h2>
        <p>{TIKTOK_YOUTH_SHILL_BANNER.body}</p>
      </article>

      <div className="card-grid dense">
        {ROOMS.map((room) => (
          <article key={room.id} className="card room-card">
            <div className="card-top">
              <h2>{room.name}</h2>
              <span className={`badge tag-${room.tag}`}>
                {TAG_LABEL[room.tag]}
              </span>
            </div>
            <p className="meta">
              <span className="channel">{room.channel}</span> · {room.focus}
            </p>
            <p className="note">{room.note}</p>
          </article>
        ))}
      </div>

      <div className="card-grid dense trust-grid">
        {TRUST_CHECKLIST.map((block) => (
          <article key={block.title} className="card checklist-card">
            <h2>{block.title}</h2>
            <ul>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
