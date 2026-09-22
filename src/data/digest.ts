/** Plain-English theme stubs. Prices on the Digest tab come from Coinbase, not these notes. */
export type AssetDigest = {
  symbol: string
  theme: string
  eli5: string
  risks: string[]
}

export const DIGEST_COPY: Record<string, AssetDigest> = {
  BTC: {
    symbol: 'BTC',
    theme: 'Macro ballast. Rates, ETF flows, and risk appetite still set the tone.',
    eli5: 'Digital gold people trade peer-to-peer. A public ledger keeps the score.',
    risks: ['Hard swings', 'Scam DMs', 'Lost keys', 'Regulatory headlines'],
  },
  ETH: {
    symbol: 'ETH',
    theme: 'Programmable settlement. Fees and DeFi activity ride the BTC tape.',
    eli5: 'A programmable network — apps and tokens run on it.',
    risks: ['Smart-contract bugs', 'Gas spikes', 'DeFi exploits', 'Tracks BTC risk'],
  },
  SOL: {
    symbol: 'SOL',
    theme: 'High-beta L1. App activity and meme flow move it faster than BTC.',
    eli5: 'Fast, cheap chain popular for apps and memecoins.',
    risks: ['Outage history', 'High beta to BTC', 'Hype cycles'],
  },
  XRP: {
    symbol: 'XRP',
    theme: 'Payments coin. Legal and headline gaps show up fast.',
    eli5: 'Payments-focused coin — news and court headlines move it a lot.',
    risks: ['Legal headlines', 'Centralization debates'],
  },
  LINK: {
    symbol: 'LINK',
    theme: 'Oracle demand. Tracks DeFi usage more than social hype.',
    eli5: 'Oracle network — brings real-world data into crypto apps.',
    risks: ['Oracle risk', 'Competing data stacks'],
  },
  BNB: {
    symbol: 'BNB',
    theme: 'Exchange-linked coin. Chain activity and regulatory headlines matter.',
    eli5: 'Exchange-linked coin used for fees and its own chain.',
    risks: ['Exchange regulatory risk', 'Concentration'],
  },
  AVAX: {
    symbol: 'AVAX',
    theme: 'L1 beta. Usually follows the majors unless a subnet headline hits.',
    eli5: 'Smart-contract chain aiming for speed and custom subnets.',
    risks: ['L1 competition', 'Liquidity cycles'],
  },
  DOGE: {
    symbol: 'DOGE',
    theme: 'Meme seat. Social buzz, not a fundamentals story. One meme max on the desk.',
    eli5: 'Meme coin driven by social buzz more than fundamentals.',
    risks: ['Pure sentiment', 'Celebrity tweets', 'Extreme volatility'],
  },
  ADA: {
    symbol: 'ADA',
    theme: 'Research-chain narrative. Slower than the high-beta L1s most days.',
    eli5: 'Research-heavy smart-contract chain with its own community.',
    risks: ['Slow narrative cycles', 'Competes with faster L1s'],
  },
  DOT: {
    symbol: 'DOT',
    theme: 'Interoperability story. Often quieter than the majors.',
    eli5: 'Connects specialized blockchains (parachains) under one roof.',
    risks: ['Complex tech story', 'Crowded L1/L0 narrative'],
  },
  NEAR: {
    symbol: 'NEAR',
    theme: 'Usability and AI-adjacent narrative. Still an L1 beta trade.',
    eli5: 'Usability-focused chain; also active in AI + crypto narratives.',
    risks: ['Narrative rotation', 'L1 competition'],
  },
  UNI: {
    symbol: 'UNI',
    theme: 'DEX volume and fee talk. ETH beta plus governance.',
    eli5: 'Governance token for the biggest decentralized exchange.',
    risks: ['DEX fee wars', 'Governance drama', 'ETH beta'],
  },
  SUI: {
    symbol: 'SUI',
    theme: 'Newer high-throughput chain. Unlocks and hype move it.',
    eli5: 'Newer high-throughput chain chasing speed and consumer apps.',
    risks: ['Young ecosystem', 'Unlock schedules', 'Hype risk'],
  },
  ATOM: {
    symbol: 'ATOM',
    theme: 'IBC hub debate. Often a quieter tape than BTC and ETH.',
    eli5: 'Hub of the “internet of blockchains” cosmos ecosystem.',
    risks: ['Hub value-capture debates', 'Many competing zones'],
  },
  AAVE: {
    symbol: 'AAVE',
    theme: 'DeFi lending blue chip. Rates and exploit headlines.',
    eli5: 'Blue-chip DeFi lending protocol token.',
    risks: ['Smart-contract risk', 'Rate / liquidity shocks', 'ETH beta'],
  },
  PEPE: {
    symbol: 'PEPE',
    theme: 'Meme beta. Counts toward the one meme seat (with DOGE and SHIB).',
    eli5: 'Meme coin. Social flow dominates. Not a business you can audit.',
    risks: ['Pure sentiment', 'Liquidity air-pockets', 'Extreme volatility'],
  },
  SHIB: {
    symbol: 'SHIB',
    theme: 'Meme beta. Same one-seat cap as DOGE and PEPE.',
    eli5: 'Meme coin with a large unit supply. Price per coin is tiny; percent moves are not.',
    risks: ['Pure sentiment', 'Unit confusion', 'Extreme volatility'],
  },
}
