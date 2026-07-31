-- ====================================================================
-- YAGA CALLS OPERATIONS SYSTEM — PRODUCTION SUPABASE SQL MIGRATION
-- Database Engine: PostgreSQL 15+ (Supabase)
-- Project Ref: ghwvwtwktnveqdqivxmy
-- Created: 2026-07-30
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. CREATORS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creators (
    id VARCHAR(20) PRIMARY KEY, -- e.g. CR-001
    real_name TEXT NOT NULL,
    public_name TEXT NOT NULL,
    title TEXT,
    telegram_handle TEXT,
    telegram_chat_id TEXT UNIQUE,
    email TEXT UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    start_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. CREATOR VOICE PROFILES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_profiles (
    creator_id VARCHAR(20) PRIMARY KEY REFERENCES public.creators(id) ON DELETE CASCADE,
    tone TEXT NOT NULL,
    sentence_length TEXT,
    vocabulary TEXT,
    humor TEXT,
    cta_style TEXT,
    phrases_to_avoid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 3. PLATFORMS MASTER TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platforms (
    id VARCHAR(20) PRIMARY KEY, -- e.g. PL-X, PL-MEDIUM
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    daily_posts_req INT DEFAULT 0,
    article_freq TEXT DEFAULT 'N/A',
    engagement_req TEXT,
    status TEXT DEFAULT 'Active',
    account_creation_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 4. ACCOUNTS DATABASE TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
    id VARCHAR(30) PRIMARY KEY, -- e.g. AC-X-CR001
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    profile_url TEXT,
    login_identifier TEXT,
    credential_record_id VARCHAR(30),
    status TEXT DEFAULT 'Active', -- Onboarding, Active, Restricted, Paused, Closed
    posting_ready BOOLEAN DEFAULT TRUE,
    activation_date TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 5. RESTRICTED CREDENTIALS VAULT (Restricted RLS)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credentials_vault (
    id VARCHAR(30) PRIMARY KEY, -- e.g. CRED-X-CR001
    account_id VARCHAR(30) UNIQUE NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id),
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    login_identifier TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    public_username TEXT,
    security_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Credentials Vault
ALTER TABLE public.credentials_vault ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 6. PLATFORM PLAYBOOKS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_playbooks (
    platform_id VARCHAR(20) PRIMARY KEY REFERENCES public.platforms(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    gpt_prompt_template TEXT,
    follow_categories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 7. CONTENT DAYS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_days (
    id VARCHAR(30) PRIMARY KEY, -- e.g. DAY-20260730
    date DATE UNIQUE NOT NULL,
    status TEXT DEFAULT 'Draft', -- Draft, Ready, Sent, Completed, Cancelled
    total_assignments INT DEFAULT 0,
    completed_assignments INT DEFAULT 0,
    batch_1_status TEXT DEFAULT 'PENDING', -- PENDING, DISPATCHED, COMPLETED
    batch_2_status TEXT DEFAULT 'PENDING',
    batch_3_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 8. BASE CONTENT TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.base_content (
    id VARCHAR(30) PRIMARY KEY, -- e.g. CNT-20260730-001
    day_id VARCHAR(30) NOT NULL REFERENCES public.content_days(id) ON DELETE CASCADE,
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    content_type TEXT NOT NULL, -- Text Post, Image Post, Article, Thread, etc.
    slot TEXT,
    publish_time TEXT,
    shared_topic TEXT NOT NULL,
    drive_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 9. CREATOR CAPTIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_captions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id VARCHAR(30) NOT NULL REFERENCES public.base_content(id) ON DELETE CASCADE,
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    UNIQUE(content_id, creator_id)
);

-- --------------------------------------------------------------------
-- 10. ASSIGNMENT QUEUE TABLE (Primary 3-Batch Execution Table)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_queue (
    id VARCHAR(50) PRIMARY KEY, -- e.g. ASN-20260730-001-CR001
    day_id VARCHAR(30) NOT NULL REFERENCES public.content_days(id) ON DELETE CASCADE,
    content_id VARCHAR(30) NOT NULL REFERENCES public.base_content(id),
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id),
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    account_id VARCHAR(30) NOT NULL REFERENCES public.accounts(id),
    batch_number INT NOT NULL CHECK (batch_number IN (1, 2, 3)),
    scheduled_time TEXT,
    caption TEXT NOT NULL,
    asset_link TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Delivered, Completed, Problem, Cancelled
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 11. ENGAGEMENT REQUIREMENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_requirements (
    id VARCHAR(50) PRIMARY KEY, -- e.g. ENG-20260730-MEDIUM-CR001-01
    date DATE NOT NULL,
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id),
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    activity_type TEXT NOT NULL,
    required_quantity INT DEFAULT 2,
    completed_quantity INT DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 12. ISSUE TICKETS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_tickets (
    id VARCHAR(30) PRIMARY KEY, -- e.g. ISS-20260730-001
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id),
    creator_name TEXT NOT NULL,
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    account_id VARCHAR(30) REFERENCES public.accounts(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- OPEN, RESOLVED
    owner_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- --------------------------------------------------------------------
-- 13. REFERRAL CONVERSIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_conversions (
    ref_code VARCHAR(50) PRIMARY KEY, -- e.g. ref_alex_x
    creator_id VARCHAR(20) NOT NULL REFERENCES public.creators(id),
    platform_id VARCHAR(20) NOT NULL REFERENCES public.platforms(id),
    clicks INT DEFAULT 0,
    free_joins INT DEFAULT 0,
    vip_conversions INT DEFAULT 0,
    estimated_revenue NUMERIC(10,2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- SEED DATA FOR PRODUCTION READY INITIALIZATION
-- ====================================================================

-- Seed Creators
INSERT INTO public.creators (id, real_name, public_name, title, telegram_handle, telegram_chat_id, email, active)
VALUES 
('CR-001', 'Alex Vance', 'Alex Crypto', 'Lead Market Strategist', '@alex_yaga', '1001', 'alex@yagacalls.com', TRUE),
('CR-002', 'Elena Rostova', 'Elena Trades', 'Macro & Psychology Specialist', '@elena_yaga', '1002', 'elena@yagacalls.com', TRUE),
('CR-003', 'Marcus Thorne', 'Marcus Market Calls', 'Technical Execution Lead', '@marcus_yaga', '1003', 'marcus@yagacalls.com', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Voice Profiles
INSERT INTO public.voice_profiles (creator_id, tone, sentence_length, vocabulary, humor, cta_style)
VALUES 
('CR-001', 'Authoritative, analytical, sharp', 'Short to medium punchy statements', 'Institutional crypto terms, risk-reward focus', 'Low', 'Direct market action & invite to free Yaga group'),
('CR-002', 'Relatable, storytelling, discipline-focused', 'Flowing storytelling paragraphs', 'Emotional resonance, career frustration, freedom ambition', 'Subtle ironies', 'Reflective curiosity leading to profile link'),
('CR-003', 'High-energy, direct, setup-driven', 'Bullet points & quick levels', 'Chart patterns, support/resistance, volume spikes', 'Trader memes', 'Urgent chart setup preview')
ON CONFLICT (creator_id) DO NOTHING;

-- Seed Platforms
INSERT INTO public.platforms (id, name, category, daily_posts_req, article_freq, engagement_req, status)
VALUES 
('PL-X', 'X (Twitter)', 'Social / Microblog', 2, 'N/A', '2 replies/day', 'Active'),
('PL-MEDIUM', 'Medium', 'Long-Form Authority', 0, '1 per 2 days', '2 responses/day', 'Active'),
('PL-CMC', 'CoinMarketCap Community', 'Crypto Native', 2, 'N/A', '2 posts/day', 'Active'),
('PL-LINKEDIN', 'LinkedIn', 'Professional', 2, 'N/A', '2 comments/day', 'Active'),
('PL-INSTAGRAM', 'Instagram', 'Visual Storytelling', 2, 'N/A', '2 replies/day', 'Active'),
('PL-FACEBOOK', 'Facebook', 'Community', 2, 'N/A', '2 comments/day', 'Active'),
('PL-BINANCE', 'Binance Square', 'Crypto Exchange', 2, 'N/A', '2 comments/day', 'Active'),
('PL-TRADINGVIEW', 'TradingView', 'Charts & Ideas', 1, 'N/A', '1 idea/day', 'Active'),
('PL-SUBSTACK', 'Substack', 'Newsletter / Founder', 0, '1 per 2 days', 'Short Notes', 'Active'),
('PL-TG', 'Telegram Channel', 'Direct Messaging', 2, 'N/A', 'Community trust', 'Active')
ON CONFLICT (id) DO NOTHING;

-- Seed Accounts
INSERT INTO public.accounts (id, creator_id, platform_id, handle, posting_ready, status)
VALUES 
('AC-X-CR001', 'CR-001', 'PL-X', '@AlexCrypto_Yaga', TRUE, 'Active'),
('AC-MEDIUM-CR001', 'CR-001', 'PL-MEDIUM', '@alexcrypto.yaga', TRUE, 'Active'),
('AC-LINKEDIN-CR001', 'CR-001', 'PL-LINKEDIN', 'in/alex-crypto-yaga', TRUE, 'Active'),
('AC-CMC-CR001', 'CR-001', 'PL-CMC', '@AlexYagaCalls', TRUE, 'Active'),
('AC-BINANCE-CR001', 'CR-001', 'PL-BINANCE', 'Alex_Yaga_Square', TRUE, 'Active'),
('AC-X-CR002', 'CR-002', 'PL-X', '@ElenaTrades_Yaga', TRUE, 'Active'),
('AC-MEDIUM-CR002', 'CR-002', 'PL-MEDIUM', '@elenatrades.yaga', TRUE, 'Active'),
('AC-LINKEDIN-CR002', 'CR-002', 'PL-LINKEDIN', 'in/elena-trades-yaga', TRUE, 'Active'),
('AC-BINANCE-CR002', 'CR-002', 'PL-BINANCE', 'Elena_Yaga_Square', TRUE, 'Active'),
('AC-X-CR003', 'CR-003', 'PL-X', '@MarcusCalls_Yaga', TRUE, 'Active'),
('AC-MEDIUM-CR003', 'CR-003', 'PL-MEDIUM', '@marcuscalls.yaga', TRUE, 'Active')
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Issues
INSERT INTO public.issue_tickets (id, creator_id, creator_name, platform_id, account_id, issue_type, description, status)
VALUES 
('ISS-20260730-001', 'CR-002', 'Elena Rostova', 'PL-BINANCE', 'AC-BINANCE-CR002', 'Verification Lock', 'Binance Square requested 2FA SMS verification code, waiting for mobile signal.', 'OPEN')
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Referral Conversions
INSERT INTO public.referral_conversions (ref_code, creator_id, platform_id, clicks, free_joins, vip_conversions, estimated_revenue)
VALUES 
('ref_alex_x', 'CR-001', 'PL-X', 1420, 310, 42, 4200.00),
('ref_elena_medium', 'CR-002', 'PL-MEDIUM', 2850, 540, 68, 6800.00),
('ref_marcus_tg', 'CR-003', 'PL-TG', 1980, 420, 55, 5500.00)
ON CONFLICT (ref_code) DO NOTHING;
