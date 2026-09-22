export type RoomChannel = 'Discord' | 'Telegram' | 'Reddit' | 'X' | 'TikTok'

export type Room = {
  id: string
  name: string
  channel: RoomChannel
  focus: string
  /** signal vs noise tag */
  tag: 'signal' | 'mixed' | 'noise'
  note: string
}

export const ROOMS: Room[] = [
  {
    id: 'r1',
    name: 'Bitcoin Talk (core threads)',
    channel: 'Reddit',
    focus: 'BTC fundamentals',
    tag: 'signal',
    note: 'Slow, technical. Prefer sticky FAQs over hot posts.',
  },
  {
    id: 'r2',
    name: 'r/ethfinance',
    channel: 'Reddit',
    focus: 'ETH weekly digests',
    tag: 'signal',
    note: 'Strong weekend threads; ignore lottery tickets.',
  },
  {
    id: 'r3',
    name: 'Crypto Twitter — builders',
    channel: 'X',
    focus: 'Protocol updates',
    tag: 'mixed',
    note: 'Follow engineers first; mute airdrop farms.',
  },
  {
    id: 'r4',
    name: 'Discord: research-only rooms',
    channel: 'Discord',
    focus: 'Shared notes',
    tag: 'mixed',
    note: 'Voice alpha ages fast — write it down, verify later.',
  },
  {
    id: 'r5',
    name: 'Telegram: macro desks',
    channel: 'Telegram',
    focus: 'Headlines',
    tag: 'mixed',
    note: 'Forwarded charts ≠ diligence. Check primary sources.',
  },
  {
    id: 'r6',
    name: 'TikTok crypto clips',
    channel: 'TikTok',
    focus: 'Viral narratives',
    tag: 'noise',
    note: 'Entertainment default. Treat as rumor until proven.',
  },
  {
    id: 'r6b',
    name: 'TikTok “juvenile millionaire” day-traders',
    channel: 'TikTok',
    focus: 'Youth-flex / get-rich-quick',
    tag: 'noise',
    note:
      'HIGH SHILL. Lifestyle flex, screenshot PnL, courses/Telegram VIP, paid meme promos. Major US exchanges are 18+. Treat as contrary noise — do not copy.',
  },
  {
    id: 'r7',
    name: 'X: influencer callouts',
    channel: 'X',
    focus: 'Momentum shills',
    tag: 'noise',
    note: 'Paid promos hide in “not financial advice” disclaimers.',
  },
  {
    id: 'r8',
    name: 'Discord: launchpad hype',
    channel: 'Discord',
    focus: 'New listings',
    tag: 'noise',
    note: 'Roles & FOMO timers are classic throw-off patterns.',
  },
]

export const TRUST_CHECKLIST = [
  {
    title: 'Genuine signals',
    items: [
      'Primary docs / on-chain explorers cited',
      'Risks named before upside',
      'Author has a track record you can audit',
      'Time-stamped claims you can re-check',
    ],
  },
  {
    title: 'Shill / throw-off patterns',
    items: [
      'Guaranteed returns or “100x soon”',
      'Pressure to ape in private DMs',
      'Unverifiable “insider” screenshots',
      'New accounts amplifying the same ticker',
      'Downplaying contract risk / admin keys',
    ],
  },
  {
    title: 'TikTok youth-shill warning',
    items: [
      '“Kids making millions” / Lambo-as-proof — usually marketing theater',
      'Screenshot-only PnL; deleted losses; demo accounts',
      'Course / VIP Telegram / affiliate funnel after free hype',
      'Undisclosed paid token promo → dump into followers',
      'Major US CEXes are 18+ — youth aesthetic ≠ legal day-trading access',
      'STARFALL: stay paper; treat as noise / contrary indicator',
    ],
  },
]

/** Banner copy for Rooms view */
export const TIKTOK_YOUTH_SHILL_BANNER = {
  title: 'TikTok youth-shill radar',
  body: 'Viral “juvenile day-trader millionaire” clips are usually attention + course/affiliate theater — not an edge you can copy. Stay paper. Ignore FOMO DMs.',
}
