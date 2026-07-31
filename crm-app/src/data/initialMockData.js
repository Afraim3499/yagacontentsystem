export const INITIAL_SYSTEM_SETTINGS = {
  companyName: "Yaga Calls Operations",
  systemPhase: "CONTENT_ACTIVE", // Setup, Platform Onboarding, Onboarding Review, Content Locked, Content Active, Paused
  timezone: "UTC+6",
  ownerTelegramChatId: "987654321",
  botUsername: "@YagaTeamOpsBot",
  activeCreatorsCount: 3,
  activePlatformsCount: 10,
  contentOperationsStatus: "UNLOCKED",
  staggeredBatchIntervalMinutes: 30,
  autoActivationGatePercent: 100,
};

export const INITIAL_CREATORS = [
  {
    id: "CR-001",
    realName: "Alex Vance",
    publicName: "Alex Crypto",
    title: "Lead Market Strategist",
    telegramHandle: "@alex_yaga",
    telegramChatId: "1001",
    email: "alex@yagacalls.com",
    active: true,
    startDate: "2026-01-15",
    assignedPlatforms: ["PL-X", "PL-MEDIUM", "PL-LINKEDIN", "PL-CMC", "PL-BINANCE", "PL-SUBSTACK", "PL-INSTAGRAM", "PL-FACEBOOK", "PL-TRADINGVIEW", "PL-TG"],
    voiceProfile: {
      tone: "Authoritative, analytical, sharp",
      sentenceLength: "Short to medium punchy statements",
      vocabulary: "Institutional crypto terms, risk-reward focus",
      humor: "Low",
      ctaStyle: "Direct market action & invite to free Yaga group"
    }
  },
  {
    id: "CR-002",
    realName: "Elena Rostova",
    publicName: "Elena Trades",
    title: "Macro & Psychology Specialist",
    telegramHandle: "@elena_yaga",
    telegramChatId: "1002",
    email: "elena@yagacalls.com",
    active: true,
    startDate: "2026-02-01",
    assignedPlatforms: ["PL-X", "PL-MEDIUM", "PL-LINKEDIN", "PL-CMC", "PL-BINANCE", "PL-SUBSTACK", "PL-INSTAGRAM", "PL-FACEBOOK", "PL-TRADINGVIEW", "PL-TG"],
    voiceProfile: {
      tone: "Relatable, storytelling, discipline-focused",
      sentenceLength: "Flowing storytelling paragraphs",
      vocabulary: "Emotional resonance, career frustration, freedom ambition",
      humor: "Subtle ironies",
      ctaStyle: "Reflective curiosity leading to profile link"
    }
  },
  {
    id: "CR-003",
    realName: "Marcus Thorne",
    publicName: "Marcus Market Calls",
    title: "Technical Execution Lead",
    telegramHandle: "@marcus_yaga",
    telegramChatId: "1003",
    email: "marcus@yagacalls.com",
    active: true,
    startDate: "2026-02-10",
    assignedPlatforms: ["PL-X", "PL-MEDIUM", "PL-LINKEDIN", "PL-CMC", "PL-BINANCE", "PL-SUBSTACK", "PL-INSTAGRAM", "PL-FACEBOOK", "PL-TRADINGVIEW", "PL-TG"],
    voiceProfile: {
      tone: "High-energy, direct, setup-driven",
      sentenceLength: "Bullet points & quick levels",
      vocabulary: "Chart patterns, support/resistance, volume spikes",
      humor: "Trader memes",
      ctaStyle: "Urgent chart setup preview"
    }
  }
];

export const INITIAL_PLATFORMS = [
  { id: "PL-X", name: "X (Twitter)", category: "Social / Microblog", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 replies/day", status: "Active" },
  { id: "PL-MEDIUM", name: "Medium", category: "Long-Form Authority", dailyPostsReq: 0, articleFreq: "1 per 2 days", engagementReq: "2 responses/day", status: "Active" },
  { id: "PL-CMC", name: "CoinMarketCap Community", category: "Crypto Native", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 posts/day", status: "Active" },
  { id: "PL-LINKEDIN", name: "LinkedIn", category: "Professional", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 comments/day", status: "Active" },
  { id: "PL-INSTAGRAM", name: "Instagram", category: "Visual Storytelling", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 replies/day", status: "Active" },
  { id: "PL-FACEBOOK", name: "Facebook", category: "Community", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 comments/day", status: "Active" },
  { id: "PL-BINANCE", name: "Binance Square", category: "Crypto Exchange", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "2 comments/day", status: "Active" },
  { id: "PL-TRADINGVIEW", name: "TradingView", category: "Charts & Ideas", dailyPostsReq: 1, articleFreq: "N/A", engagementReq: "1 idea/day", status: "Active" },
  { id: "PL-SUBSTACK", name: "Substack", category: "Newsletter / Founder", dailyPostsReq: 0, articleFreq: "1 per 2 days", engagementReq: "Short Notes", status: "Active" },
  { id: "PL-TG", name: "Telegram Channel", category: "Direct Messaging", dailyPostsReq: 2, articleFreq: "N/A", engagementReq: "Community trust", status: "Active" }
];

export const INITIAL_ACCOUNTS = [
  { id: "AC-X-CR001", creatorId: "CR-001", platformId: "PL-X", handle: "@AlexCrypto_Yaga", status: "Active", postingReady: true },
  { id: "AC-MEDIUM-CR001", creatorId: "CR-001", platformId: "PL-MEDIUM", handle: "@alexcrypto.yaga", status: "Active", postingReady: true },
  { id: "AC-LINKEDIN-CR001", creatorId: "CR-001", platformId: "PL-LINKEDIN", handle: "in/alex-crypto-yaga", status: "Active", postingReady: true },
  { id: "AC-CMC-CR001", creatorId: "CR-001", platformId: "PL-CMC", handle: "@AlexYagaCalls", status: "Active", postingReady: true },
  { id: "AC-BINANCE-CR001", creatorId: "CR-001", platformId: "PL-BINANCE", handle: "Alex_Yaga_Square", status: "Active", postingReady: true },
  
  { id: "AC-X-CR002", creatorId: "CR-002", platformId: "PL-X", handle: "@ElenaTrades_Yaga", status: "Active", postingReady: true },
  { id: "AC-MEDIUM-CR002", creatorId: "CR-002", platformId: "PL-MEDIUM", handle: "@elenatrades.yaga", status: "Active", postingReady: true },
  { id: "AC-LINKEDIN-CR002", creatorId: "CR-002", platformId: "PL-LINKEDIN", handle: "in/elena-trades-yaga", status: "Active", postingReady: true },
  
  { id: "AC-X-CR003", creatorId: "CR-003", platformId: "PL-X", handle: "@MarcusCalls_Yaga", status: "Active", postingReady: true },
  { id: "AC-MEDIUM-CR003", creatorId: "CR-003", platformId: "PL-MEDIUM", handle: "@marcuscalls.yaga", status: "Active", postingReady: true }
];

export const INITIAL_DAILY_BATCH = {
  dayId: "DAY-20260730",
  date: "2026-07-30",
  status: "SENT", // Draft, Ready, Sent, Completed
  totalAssignments: 18,
  batch1Status: "COMPLETED", // Immediate (T+0m) - 6 tasks (1/3rd)
  batch2Status: "COMPLETED", // Scheduled (+30m) - 6 tasks (1/3rd)
  batch3Status: "IN_PROGRESS", // Scheduled (+60m) - 6 tasks (1/3rd)
  completionPercent: 83,
  tasks: [
    // Batch 1 (T+0m)
    { id: "ASN-001", batch: 1, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-X", platformName: "X (Twitter)", slot: "Morning Slot 1", publishTime: "09:00 AM", status: "Completed", caption: "BTC holding key demand zone at $64,200. Institutional order flow shows accumulation. Are you positioned before the weekend surge?", imageLink: "https://drive.google.com/file/d/demo-btc-chart-01.png" },
    { id: "ASN-002", batch: 1, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-X", platformName: "X (Twitter)", slot: "Morning Slot 1", publishTime: "09:00 AM", status: "Completed", caption: "Spent 5 years working 9-to-5 feeling trapped before I understood market risk. Trading isn't about gambling—it's about discipline and patience.", imageLink: "https://drive.google.com/file/d/demo-mindset-01.png" },
    { id: "ASN-003", batch: 1, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-X", platformName: "X (Twitter)", slot: "Morning Slot 1", publishTime: "09:00 AM", status: "Completed", caption: "ETH 4H break and retest confirmed! Invalidation set at $3,380. Target 1: $3,550. Let the setup come to you.", imageLink: "https://drive.google.com/file/d/demo-eth-chart-01.png" },
    { id: "ASN-004", batch: 1, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-CMC", platformName: "CoinMarketCap", slot: "Morning Slot 1", publishTime: "09:30 AM", status: "Completed", caption: "Solana DeFi TVL hit a 4-month high today. SOL momentum looks healthy despite macro volatility.", imageLink: null },
    { id: "ASN-005", batch: 1, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-LINKEDIN", platformName: "LinkedIn", slot: "Morning Slot 1", publishTime: "09:30 AM", status: "Completed", caption: "Why traditional corporate careers no longer offer true financial security in 2026. How we're building alternative income paths with Yaga Calls.", imageLink: null },
    { id: "ASN-006", batch: 1, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-BINANCE", platformName: "Binance Square", slot: "Morning Slot 1", publishTime: "09:30 AM", status: "Completed", caption: "Market Structure Update: Total3 altcoin market cap breaking major resistance line.", imageLink: null },

    // Batch 2 (+30m)
    { id: "ASN-007", batch: 2, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-LINKEDIN", platformName: "LinkedIn", slot: "Midday Slot 2", publishTime: "10:00 AM", status: "Completed", caption: "Managing risk in volatile crypto markets. Why top performers never risk more than 1.5% per position.", imageLink: null },
    { id: "ASN-008", batch: 2, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-MEDIUM", platformName: "Medium", slot: "Midday Slot 2", publishTime: "10:00 AM", status: "Completed", caption: "Article Dispatch: The Psychology of Holding Through 40% Drawdowns.", imageLink: null },
    { id: "ASN-009", batch: 2, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-TRADINGVIEW", platformName: "TradingView", slot: "Midday Slot 2", publishTime: "10:00 AM", status: "Completed", caption: "Chart Setup: BTCUSDT Bullish Pennant Breakdown or Expansion?", imageLink: "https://drive.google.com/file/d/demo-tv-01.png" },
    { id: "ASN-010", batch: 2, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-BINANCE", platformName: "Binance Square", slot: "Midday Slot 2", publishTime: "10:15 AM", status: "Completed", caption: "Binance spot order book delta turns positive for major layer 1s.", imageLink: null },
    { id: "ASN-011", batch: 2, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-INSTAGRAM", platformName: "Instagram", slot: "Midday Slot 2", publishTime: "10:15 AM", status: "Completed", caption: "Freedom is calculated in peace of mind, not just token balances. #TradingMindset #YagaCalls", imageLink: "https://drive.google.com/file/d/demo-ig-quote.png" },
    { id: "ASN-012", batch: 2, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-CMC", platformName: "CoinMarketCap", slot: "Midday Slot 2", publishTime: "10:15 AM", status: "Completed", caption: "Watch out for liquidity sweeps around the NY session open.", imageLink: null },

    // Batch 3 (+60m)
    { id: "ASN-013", batch: 3, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-SUBSTACK", platformName: "Substack", slot: "Afternoon Slot 3", publishTime: "10:30 AM", status: "Completed", caption: "Weekly Founder Intelligence Brief #28: Navigating Q3 Liquidity Shifts.", imageLink: null },
    { id: "ASN-014", batch: 3, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-FACEBOOK", platformName: "Facebook", slot: "Afternoon Slot 3", publishTime: "10:30 AM", status: "Pending", caption: "How our community members are building consistent trading habits step-by-step.", imageLink: null },
    { id: "ASN-015", batch: 3, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-TG", platformName: "Telegram Channel", slot: "Afternoon Slot 3", publishTime: "10:30 AM", status: "Pending", caption: "⚡️ VIP Signal Teaser: BTC scalping setup triggered. Join free channel for full targets.", imageLink: null },
    { id: "ASN-016", batch: 3, creatorId: "CR-001", creatorName: "Alex Vance", platformId: "PL-INSTAGRAM", platformName: "Instagram", slot: "Afternoon Slot 3", publishTime: "10:45 AM", status: "Pending", caption: "Daily Market Breakdown graphic: Key levels to watch this week.", imageLink: "https://drive.google.com/file/d/demo-ig-breakdown.png" },
    { id: "ASN-017", batch: 3, creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-TG", platformName: "Telegram Channel", slot: "Afternoon Slot 3", publishTime: "10:45 AM", status: "Completed", caption: "Community update: Today's live stream scheduled for 4 PM UTC.", imageLink: null },
    { id: "ASN-018", batch: 3, creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-FACEBOOK", platformName: "Facebook", slot: "Afternoon Slot 3", publishTime: "10:45 AM", status: "Pending", caption: "Simple chart pattern every beginner trader must know before taking their first position.", imageLink: null }
  ]
};

export const INITIAL_ISSUES = [
  { id: "ISS-20260730-001", creatorId: "CR-002", creatorName: "Elena Rostova", platformId: "PL-BINANCE", accountId: "AC-BINANCE-CR002", issueType: "Verification Lock", description: "Binance Square requested 2FA SMS verification code, waiting for mobile signal.", status: "OPEN", createdTime: "2026-07-30 08:15 AM", ownerResponse: null },
  { id: "ISS-20260729-002", creatorId: "CR-003", creatorName: "Marcus Thorne", platformId: "PL-X", accountId: "AC-X-CR003", issueType: "Bio Formatting", description: "Bio line exceeded character limit by 12 chars during initial setup.", status: "RESOLVED", createdTime: "2026-07-29 02:40 PM", ownerResponse: "Shortened bio approved and updated in Profile Blueprint." }
];

export const INITIAL_CONVERSIONS = [
  { refCode: "ref_alex_x", creatorId: "CR-001", platformId: "PL-X", clicks: 1420, freeJoins: 310, vipConversions: 42, estimatedRevenue: "$4,200" },
  { refCode: "ref_elena_medium", creatorId: "CR-002", platformId: "PL-MEDIUM", clicks: 2850, freeJoins: 540, vipConversions: 68, estimatedRevenue: "$6,800" },
  { refCode: "ref_marcus_tg", creatorId: "CR-003", platformId: "PL-TG", clicks: 1980, freeJoins: 420, vipConversions: 55, estimatedRevenue: "$5,500" }
];
