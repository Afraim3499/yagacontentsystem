-- =====================================================================
-- crm_schema.sql — RECONSTRUCTED from the live Supabase catalog by
-- introspect_schema.js. Do not hand-edit; regenerate instead.
-- Generated: 2026-08-30T13:07:31.181Z
-- =====================================================================

-- ── TABLES ──────────────────────────────────────────────────────────

-- rows at introspection time: 70
CREATE TABLE IF NOT EXISTS public.accounts (
  id varchar(30) NOT NULL,
  creator_id varchar(20) NOT NULL,
  platform_id varchar(20) NOT NULL,
  handle text NOT NULL,
  profile_url text,
  login_identifier text,
  credential_record_id varchar(30),
  status text DEFAULT 'Active'::text,
  posting_ready boolean DEFAULT true,
  activation_date timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id) ON DELETE CASCADE,
  CONSTRAINT accounts_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id) ON DELETE CASCADE
);

-- rows at introspection time: 2
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id varchar(50) NOT NULL,
  affiliate_id varchar(50) NOT NULL,
  joined_telegram_id text NOT NULL,
  joined_username text,
  joined_first_name text,
  status varchar(30) DEFAULT 'FREE_MEMBER'::character varying,
  converted_plan varchar(50),
  converted_amount numeric(10,2) DEFAULT 0.00,
  earned_commission numeric(10,2) DEFAULT 0.00,
  payout_status varchar(20) DEFAULT 'UNPAID'::character varying,
  payout_txhash text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_referrals_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates (id) ON DELETE CASCADE
);
CREATE INDEX idx_affiliate_referrals_created_at ON public.affiliate_referrals USING btree (created_at DESC);

-- rows at introspection time: 3
CREATE TABLE IF NOT EXISTS public.affiliates (
  id varchar(50) NOT NULL,
  telegram_id text NOT NULL,
  telegram_handle text,
  first_name text,
  wallet_address text,
  payout_currency varchar(20) DEFAULT 'USDT'::character varying,
  invite_link text,
  commission_rate numeric(5,2) DEFAULT 15.00,
  total_free_joins integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_earned numeric(10,2) DEFAULT 0.00,
  total_paid numeric(10,2) DEFAULT 0.00,
  unpaid_balance numeric(10,2) DEFAULT 0.00,
  status varchar(20) DEFAULT 'Active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT affiliates_pkey PRIMARY KEY (id),
  CONSTRAINT affiliates_invite_link_key UNIQUE (invite_link),
  CONSTRAINT affiliates_telegram_id_key UNIQUE (telegram_id)
);

-- rows at introspection time: 1
CREATE TABLE IF NOT EXISTS public.assignment_queue (
  id varchar(50) NOT NULL,
  day_id varchar(30) NOT NULL,
  content_id varchar(30) NOT NULL,
  creator_id varchar(20) NOT NULL,
  platform_id varchar(20) NOT NULL,
  account_id varchar(30) NOT NULL,
  batch_number integer NOT NULL,
  scheduled_time text,
  caption text NOT NULL,
  asset_link text,
  status text DEFAULT 'Pending'::text,
  delivered_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  sla_nudge_sent boolean DEFAULT false,
  sla_ticketed boolean DEFAULT false,
  CONSTRAINT assignment_queue_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_queue_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts (id),
  CONSTRAINT assignment_queue_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.base_content (id),
  CONSTRAINT assignment_queue_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id),
  CONSTRAINT assignment_queue_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.content_days (id) ON DELETE CASCADE,
  CONSTRAINT assignment_queue_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id),
  CONSTRAINT assignment_queue_batch_number_check CHECK (batch_number = ANY (ARRAY[1, 2, 3]))
);
CREATE INDEX idx_assignment_queue_created_at ON public.assignment_queue USING btree (created_at DESC);
CREATE INDEX idx_assignment_queue_day_id ON public.assignment_queue USING btree (day_id);

-- rows at introspection time: 10
CREATE TABLE IF NOT EXISTS public.associates (
  id text NOT NULL,
  name text NOT NULL,
  telegram_chat_id text,
  unique_invite_link text,
  commission_per_member numeric DEFAULT 5.00,
  status text DEFAULT 'ACTIVE'::text,
  created_at timestamp with time zone DEFAULT now(),
  free_commission_rate numeric DEFAULT 0.30,
  paid_commission_pct numeric DEFAULT 5.00,
  total_paid numeric(10,2) DEFAULT 0.00,
  CONSTRAINT associates_pkey PRIMARY KEY (id),
  CONSTRAINT associates_unique_invite_link_key UNIQUE (unique_invite_link)
);
CREATE INDEX idx_associates_created_at ON public.associates USING btree (created_at DESC);
CREATE INDEX idx_associates_name ON public.associates USING btree (name);

-- rows at introspection time: 5
CREATE TABLE IF NOT EXISTS public.base_content (
  id varchar(30) NOT NULL,
  day_id varchar(30) NOT NULL,
  platform_id varchar(20) NOT NULL,
  content_type text NOT NULL,
  slot text,
  publish_time text,
  shared_topic text NOT NULL,
  drive_link text,
  created_at timestamp with time zone DEFAULT now(),
  headline text,
  subheadline text,
  body_content text,
  CONSTRAINT base_content_pkey PRIMARY KEY (id),
  CONSTRAINT base_content_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.content_days (id) ON DELETE CASCADE,
  CONSTRAINT base_content_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id)
);
CREATE INDEX idx_base_content_day_id ON public.base_content USING btree (day_id);

-- rows at introspection time: 1
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id text DEFAULT 'RULE-DEFAULT'::text NOT NULL,
  free_rate_per_100 numeric DEFAULT 30.00,
  paid_commission_pct numeric DEFAULT 5.00,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT commission_rules_pkey PRIMARY KEY (id)
);

-- rows at introspection time: 5210
CREATE TABLE IF NOT EXISTS public.community_members_log (
  id text NOT NULL,
  telegram_user_id text NOT NULL,
  telegram_handle text,
  first_name text,
  associate_id text,
  associate_name text,
  used_invite_link text,
  group_id text,
  group_name text,
  joined_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'ACTIVE'::text,
  commission_amount numeric DEFAULT 5.00,
  created_at timestamp with time zone DEFAULT now(),
  member_tier text DEFAULT 'FREE_ONLY'::text,
  package_id text,
  package_name text,
  paid_subscription_value numeric DEFAULT 0.00,
  free_commission numeric DEFAULT 0.30,
  paid_commission numeric DEFAULT 0.00,
  free_group_joined_at timestamp with time zone,
  paid_group_joined_at timestamp with time zone,
  enrollment_source text DEFAULT 'AUTO_JOIN_REQUEST'::text,
  enrolled_by_owner_id text,
  subscription_duration_months integer DEFAULT 6,
  subscription_expiration_date timestamp with time zone,
  subscription_status text DEFAULT 'ACTIVE'::text,
  kabidul_commission numeric(10,2) DEFAULT 0.00,
  email text,
  country text,
  timezone text,
  language text,
  notes text,
  renewal_count integer DEFAULT 0 NOT NULL,
  lifetime_value numeric(12,2) DEFAULT 0 NOT NULL,
  first_converted_at timestamp with time zone,
  last_renewed_at timestamp with time zone,
  left_at timestamp with time zone,
  expired_at timestamp with time zone,
  approved_at timestamp with time zone,
  deleted_at timestamp with time zone,
  deleted_by text,
  concierge_telegram_id text,
  CONSTRAINT community_members_log_pkey PRIMARY KEY (id),
  CONSTRAINT community_members_log_associate_id_fkey FOREIGN KEY (associate_id) REFERENCES public.associates (id) ON DELETE SET NULL
);
CREATE INDEX idx_cml_deleted_at ON public.community_members_log USING btree (deleted_at);
CREATE INDEX idx_community_members_log_created_at ON public.community_members_log USING btree (created_at DESC);
CREATE INDEX idx_community_members_log_member_tier ON public.community_members_log USING btree (member_tier);
CREATE UNIQUE INDEX idx_community_members_log_telegram_user_id ON public.community_members_log USING btree (telegram_user_id);

-- rows at introspection time: 1
CREATE TABLE IF NOT EXISTS public.concierge_user_states (
  telegram_id text NOT NULL,
  first_name text,
  username text,
  current_stage varchar(50) DEFAULT 'WELCOME'::character varying,
  loss_pain boolean DEFAULT false,
  professional_structure boolean DEFAULT false,
  risk_segment varchar(30) DEFAULT 'UNKNOWN'::character varying,
  reengagement_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archetype_score integer DEFAULT 0,
  CONSTRAINT concierge_user_states_pkey PRIMARY KEY (telegram_id)
);

-- rows at introspection time: 2
CREATE TABLE IF NOT EXISTS public.content_days (
  id varchar(30) NOT NULL,
  date date NOT NULL,
  status text DEFAULT 'Draft'::text,
  total_assignments integer DEFAULT 0,
  completed_assignments integer DEFAULT 0,
  batch_1_status text DEFAULT 'PENDING'::text,
  batch_2_status text DEFAULT 'PENDING'::text,
  batch_3_status text DEFAULT 'PENDING'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_days_pkey PRIMARY KEY (id),
  CONSTRAINT content_days_date_key UNIQUE (date)
);
CREATE INDEX idx_content_days_date ON public.content_days USING btree (date DESC);

-- rows at introspection time: 2
CREATE TABLE IF NOT EXISTS public.creator_captions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  content_id varchar(30) NOT NULL,
  creator_id varchar(20) NOT NULL,
  caption text NOT NULL,
  headline text,
  subheadline text,
  CONSTRAINT creator_captions_pkey PRIMARY KEY (id),
  CONSTRAINT creator_captions_content_id_creator_id_key UNIQUE (content_id, creator_id),
  CONSTRAINT creator_captions_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.base_content (id) ON DELETE CASCADE,
  CONSTRAINT creator_captions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id) ON DELETE CASCADE
);
CREATE INDEX idx_creator_captions_content_id ON public.creator_captions USING btree (content_id);
CREATE INDEX idx_creator_captions_creator_id ON public.creator_captions USING btree (creator_id);

-- rows at introspection time: 7
CREATE TABLE IF NOT EXISTS public.creators (
  id varchar(20) NOT NULL,
  real_name text NOT NULL,
  public_name text NOT NULL,
  title text,
  telegram_handle text,
  telegram_chat_id text,
  email text,
  active boolean DEFAULT true,
  start_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT creators_pkey PRIMARY KEY (id),
  CONSTRAINT creators_email_key UNIQUE (email),
  CONSTRAINT creators_telegram_chat_id_key UNIQUE (telegram_chat_id)
);
CREATE UNIQUE INDEX idx_creators_telegram_chat_id ON public.creators USING btree (telegram_chat_id) WHERE (telegram_chat_id IS NOT NULL);

-- rows at introspection time: 4
CREATE TABLE IF NOT EXISTS public.credentials_vault (
  id varchar(30) NOT NULL,
  account_id varchar(30) NOT NULL,
  creator_id varchar(20) NOT NULL,
  platform_id varchar(20) NOT NULL,
  login_identifier text NOT NULL,
  password_hash text NOT NULL,
  public_username text,
  security_key text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credentials_vault_pkey PRIMARY KEY (id),
  CONSTRAINT credentials_vault_account_id_key UNIQUE (account_id),
  CONSTRAINT credentials_vault_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts (id) ON DELETE CASCADE,
  CONSTRAINT credentials_vault_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id),
  CONSTRAINT credentials_vault_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id)
);

-- rows at introspection time: 3
CREATE TABLE IF NOT EXISTS public.crm_settings (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_settings_pkey PRIMARY KEY (key)
);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.engagement_requirements (
  id varchar(50) NOT NULL,
  date date NOT NULL,
  creator_id varchar(20) NOT NULL,
  platform_id varchar(20) NOT NULL,
  activity_type text NOT NULL,
  required_quantity integer DEFAULT 2,
  completed_quantity integer DEFAULT 0,
  status text DEFAULT 'Pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT engagement_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT engagement_requirements_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id),
  CONSTRAINT engagement_requirements_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id)
);

-- rows at introspection time: 1
CREATE TABLE IF NOT EXISTS public.group_config (
  group_type text NOT NULL,
  telegram_group_id text,
  group_name text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT group_config_pkey PRIMARY KEY (group_type)
);

-- rows at introspection time: 1
CREATE TABLE IF NOT EXISTS public.issue_tickets (
  id varchar(30) NOT NULL,
  creator_id varchar(20) NOT NULL,
  creator_name text NOT NULL,
  platform_id varchar(20) NOT NULL,
  account_id varchar(30),
  issue_type text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'OPEN'::text,
  owner_response text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT issue_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT issue_tickets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts (id) ON DELETE SET NULL,
  CONSTRAINT issue_tickets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id),
  CONSTRAINT issue_tickets_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id)
);
CREATE INDEX idx_issue_tickets_created_at ON public.issue_tickets USING btree (created_at DESC);

-- rows at introspection time: 396
CREATE TABLE IF NOT EXISTS public.member_events (
  id text DEFAULT ('EVT-'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
  member_id text NOT NULL,
  telegram_user_id text,
  member_name text,
  event_type text NOT NULL,
  note text,
  detail jsonb DEFAULT '{}'::jsonb NOT NULL,
  actor text DEFAULT 'system'::text,
  source text,
  payment_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT member_events_pkey PRIMARY KEY (id),
  CONSTRAINT member_events_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.community_members_log (id) ON DELETE CASCADE
);
CREATE INDEX idx_member_events_created ON public.member_events USING btree (created_at DESC);
CREATE INDEX idx_member_events_member ON public.member_events USING btree (member_id, created_at DESC);
CREATE INDEX idx_member_events_tg_user ON public.member_events USING btree (telegram_user_id);
CREATE INDEX idx_member_events_type ON public.member_events USING btree (event_type);

-- rows at introspection time: 396
CREATE TABLE IF NOT EXISTS public.member_payments (
  id text DEFAULT ('MPY-'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
  member_id text NOT NULL,
  telegram_user_id text,
  member_name text,
  payment_type text DEFAULT 'new'::text NOT NULL,
  amount numeric(12,2) DEFAULT 0 NOT NULL,
  currency text DEFAULT 'USD'::text NOT NULL,
  duration_months integer,
  term_start timestamp with time zone,
  term_end timestamp with time zone,
  previous_term_end timestamp with time zone,
  package_id text,
  package_name text,
  associate_id text,
  associate_name text,
  associate_commission numeric(12,2) DEFAULT 0,
  kabidul_commission numeric(12,2) DEFAULT 0,
  commission_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  recorded_by text DEFAULT 'system'::text,
  source text,
  note text,
  is_backfilled boolean DEFAULT false NOT NULL,
  voided_at timestamp with time zone,
  voided_by text,
  void_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT member_payments_pkey PRIMARY KEY (id),
  CONSTRAINT member_payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.community_members_log (id) ON DELETE CASCADE
);
CREATE INDEX idx_member_payments_created ON public.member_payments USING btree (created_at DESC);
CREATE INDEX idx_member_payments_member ON public.member_payments USING btree (member_id, created_at DESC);
CREATE INDEX idx_member_payments_tg_user ON public.member_payments USING btree (telegram_user_id);
CREATE INDEX idx_member_payments_type ON public.member_payments USING btree (payment_type);

-- rows at introspection time: 2
CREATE TABLE IF NOT EXISTS public.owners (
  id varchar(50) NOT NULL,
  name text NOT NULL,
  telegram_chat_id varchar(50) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT owners_pkey PRIMARY KEY (id),
  CONSTRAINT owners_telegram_chat_id_key UNIQUE (telegram_chat_id)
);
CREATE INDEX idx_owners_created_at ON public.owners USING btree (created_at DESC);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.payout_logs (
  id varchar(64) NOT NULL,
  partner_id varchar(64) NOT NULL,
  partner_name varchar(255) NOT NULL,
  partner_type varchar(32) DEFAULT 'AFFILIATE'::character varying,
  amount numeric(10,2) NOT NULL,
  currency varchar(16) DEFAULT 'USDT'::character varying,
  tx_hash text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payout_logs_pkey PRIMARY KEY (id)
);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.platform_playbooks (
  platform_id varchar(20) NOT NULL,
  purpose text NOT NULL,
  gpt_prompt_template text,
  follow_categories jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_playbooks_pkey PRIMARY KEY (platform_id),
  CONSTRAINT platform_playbooks_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id) ON DELETE CASCADE
);

-- rows at introspection time: 10
CREATE TABLE IF NOT EXISTS public.platforms (
  id varchar(20) NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  daily_posts_req integer DEFAULT 0,
  article_freq text DEFAULT 'N/A'::text,
  engagement_req text,
  status text DEFAULT 'Active'::text,
  account_creation_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platforms_pkey PRIMARY KEY (id)
);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.referral_conversions (
  ref_code varchar(50) NOT NULL,
  creator_id varchar(20) NOT NULL,
  platform_id varchar(20) NOT NULL,
  clicks integer DEFAULT 0,
  free_joins integer DEFAULT 0,
  vip_conversions integer DEFAULT 0,
  estimated_revenue numeric(10,2) DEFAULT 0.00,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referral_conversions_pkey PRIMARY KEY (ref_code),
  CONSTRAINT referral_conversions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id),
  CONSTRAINT referral_conversions_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.platforms (id)
);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.registration_codes (
  code varchar(50) NOT NULL,
  creator_id varchar(20) NOT NULL,
  label text,
  active boolean DEFAULT true,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT registration_codes_pkey PRIMARY KEY (code),
  CONSTRAINT registration_codes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id) ON DELETE CASCADE
);

-- rows at introspection time: 3
CREATE TABLE IF NOT EXISTS public.reviews (
  id text NOT NULL,
  author_name text NOT NULL,
  telegram_handle text,
  member_tier text DEFAULT 'Verified Member'::text,
  rating integer DEFAULT 5,
  title text NOT NULL,
  content text NOT NULL,
  screenshot_url text,
  status text DEFAULT 'PENDING'::text,
  is_featured boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at DESC);

-- rows at introspection time: 2
CREATE TABLE IF NOT EXISTS public.system_config (
  key varchar(50) NOT NULL,
  value text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_config_pkey PRIMARY KEY (key)
);

-- rows at introspection time: 11
CREATE TABLE IF NOT EXISTS public.system_logs (
  id varchar(50) NOT NULL,
  event_type varchar(50) NOT NULL,
  creator_id varchar(50),
  creator_name text,
  platform_id varchar(50),
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);

-- rows at introspection time: 16
CREATE TABLE IF NOT EXISTS public.trade_signals_log (
  id varchar(100) NOT NULL,
  symbol varchar(50) NOT NULL,
  creator_type varchar(50) NOT NULL,
  creator_id varchar(100),
  creator_name varchar(150) NOT NULL,
  target_audience varchar(50) NOT NULL,
  entry_range varchar(100) NOT NULL,
  take_profit_targets varchar(200) NOT NULL,
  stop_loss varchar(100) NOT NULL,
  leverage varchar(50) DEFAULT '1x-3x'::character varying,
  custom_notes text,
  chart_image_url text,
  status varchar(50) DEFAULT 'ACTIVE'::character varying,
  pnl_percentage numeric(10,2) DEFAULT 0.00,
  pnl_summary_text text,
  free_group_message_id bigint,
  vip_group_message_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  closed_at timestamp with time zone,
  CONSTRAINT trade_signals_log_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_trade_signals_log_created_at ON public.trade_signals_log USING btree (created_at DESC);

-- rows at introspection time: 3
CREATE TABLE IF NOT EXISTS public.vip_packages (
  id text NOT NULL,
  name text NOT NULL,
  duration_months integer DEFAULT 3,
  price numeric DEFAULT 200.00,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vip_packages_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_vip_packages_price ON public.vip_packages USING btree (price);

-- rows at introspection time: 0
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  creator_id varchar(20) NOT NULL,
  tone text NOT NULL,
  sentence_length text,
  vocabulary text,
  humor text,
  cta_style text,
  phrases_to_avoid text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT voice_profiles_pkey PRIMARY KEY (creator_id),
  CONSTRAINT voice_profiles_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creators (id) ON DELETE CASCADE
);

-- ── VIEWS ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.affiliate_leaderboard_view AS
WITH associate_totals AS (
         SELECT c.associate_id,
            c.associate_name,
            count(
                CASE
                    WHEN c.member_tier = 'FREE_ONLY'::text OR c.member_tier IS NULL THEN 1
                    ELSE NULL::integer
                END) AS free_joins,
            count(
                CASE
                    WHEN c.member_tier = 'PAID_VIP'::text THEN 1
                    ELSE NULL::integer
                END) AS vip_conversions,
            COALESCE(sum(c.paid_subscription_value), 0::numeric) AS total_vip_revenue,
            COALESCE(sum(c.free_commission + c.paid_commission), 0::numeric) AS internal_total_earned,
            COALESCE(a.paid_commission_pct, 5.00) AS partner_rate_pct
           FROM community_members_log c
             LEFT JOIN associates a ON c.associate_id = a.id
          WHERE c.associate_name IS NOT NULL AND c.associate_name <> 'Unattributed / Direct'::text
          GROUP BY c.associate_id, c.associate_name, a.paid_commission_pct
        )
 SELECT associate_id,
    associate_name,
    ((upper(SUBSTRING(associate_name FROM 1 FOR 1)) || '. ('::text) || COALESCE(associate_id, 'ASC-PARTNER'::text)) || ')'::text AS anonymized_name,
    free_joins,
    vip_conversions,
    total_vip_revenue,
    internal_total_earned,
        CASE
            WHEN partner_rate_pct <= 5.00 THEN round(internal_total_earned * 3.0, 2)
            ELSE round(internal_total_earned, 2)
        END AS public_displayed_earnings
   FROM associate_totals
  ORDER BY (
        CASE
            WHEN partner_rate_pct <= 5.00 THEN round(internal_total_earned * 3.0, 2)
            ELSE round(internal_total_earned, 2)
        END) DESC;

CREATE OR REPLACE VIEW public.all_partners_view AS
WITH asc_stats AS (
         SELECT a.id,
            a.name,
            a.name AS first_name,
            COALESCE(a.telegram_chat_id, 'N/A'::text) AS telegram_handle,
            a.unique_invite_link AS invite_link,
            'ASSOCIATE'::text AS partner_type,
            COALESCE(a.paid_commission_pct, 5.00) AS commission_rate,
            count(
                CASE
                    WHEN c.member_tier = 'FREE_ONLY'::text OR c.member_tier IS NULL THEN 1
                    ELSE NULL::integer
                END)::integer AS total_free_joins,
            count(
                CASE
                    WHEN c.member_tier = 'PAID_VIP'::text THEN 1
                    ELSE NULL::integer
                END)::integer AS total_conversions,
            COALESCE(sum(c.free_commission + c.paid_commission), 0::numeric)::numeric(10,2) AS total_earned,
            COALESCE(a.total_paid, 0::numeric)::numeric(10,2) AS total_paid,
            GREATEST(0::numeric, COALESCE(sum(c.free_commission + c.paid_commission), 0::numeric) - COALESCE(a.total_paid, 0::numeric))::numeric(10,2) AS unpaid_balance,
            'Not Set'::text AS wallet_address,
            a.status,
            a.created_at
           FROM associates a
             LEFT JOIN community_members_log c ON c.associate_id = a.id OR c.associate_name = a.name
          GROUP BY a.id, a.name, a.telegram_chat_id, a.unique_invite_link, a.paid_commission_pct, a.total_paid, a.status, a.created_at
        ), aff_stats AS (
         SELECT af.id,
            COALESCE(af.first_name, af.telegram_handle) AS name,
            af.first_name,
            af.telegram_handle,
            af.invite_link,
            'AFFILIATE'::text AS partner_type,
            COALESCE(af.commission_rate, 15.00) AS commission_rate,
            COALESCE(af.total_free_joins, 0) AS total_free_joins,
            COALESCE(af.total_conversions, 0) AS total_conversions,
            COALESCE(af.total_earned, 0::numeric)::numeric(10,2) AS total_earned,
            COALESCE(af.total_paid, 0::numeric)::numeric(10,2) AS total_paid,
            COALESCE(af.unpaid_balance, 0::numeric)::numeric(10,2) AS unpaid_balance,
            COALESCE(af.wallet_address, 'Not Set'::text) AS wallet_address,
            af.status,
            af.created_at
           FROM affiliates af
        )
 SELECT asc_stats.id,
    asc_stats.name,
    asc_stats.first_name,
    asc_stats.telegram_handle,
    asc_stats.invite_link,
    asc_stats.partner_type,
    asc_stats.commission_rate,
    asc_stats.total_free_joins,
    asc_stats.total_conversions,
    asc_stats.total_earned,
    asc_stats.total_paid,
    asc_stats.unpaid_balance,
    asc_stats.wallet_address,
    asc_stats.status,
    asc_stats.created_at
   FROM asc_stats
UNION ALL
 SELECT aff_stats.id,
    aff_stats.name,
    aff_stats.first_name,
    aff_stats.telegram_handle,
    aff_stats.invite_link,
    aff_stats.partner_type,
    aff_stats.commission_rate,
    aff_stats.total_free_joins,
    aff_stats.total_conversions,
    aff_stats.total_earned,
    aff_stats.total_paid,
    aff_stats.unpaid_balance,
    aff_stats.wallet_address,
    aff_stats.status,
    aff_stats.created_at
   FROM aff_stats
  ORDER BY 10 DESC;

CREATE OR REPLACE VIEW public.finance_daily_view AS
WITH pay AS (
         SELECT member_payments.created_at::date AS d,
            count(*) FILTER (WHERE member_payments.payment_type = ANY (ARRAY['new'::text, 'upgrade'::text])) AS vip_joins,
            count(*) FILTER (WHERE member_payments.payment_type = 'renewal'::text) AS renewals,
            COALESCE(sum(member_payments.amount), 0::numeric) AS revenue,
            COALESCE(sum(member_payments.amount) FILTER (WHERE member_payments.payment_type = 'renewal'::text), 0::numeric) AS renewal_revenue,
            COALESCE(sum(member_payments.associate_commission) FILTER (WHERE member_payments.associate_id IS NOT NULL), 0::numeric) AS associate_commission,
            COALESCE(sum(member_payments.associate_commission) FILTER (WHERE member_payments.associate_id IS NULL), 0::numeric) AS unattributed_commission,
            COALESCE(sum(member_payments.kabidul_commission), 0::numeric) AS kabidul_commission
           FROM member_payments
          WHERE member_payments.voided_at IS NULL
          GROUP BY (member_payments.created_at::date)
        ), free AS (
         SELECT community_members_log.free_group_joined_at::date AS d,
            count(*) AS free_joins
           FROM community_members_log
          WHERE community_members_log.deleted_at IS NULL AND community_members_log.free_group_joined_at IS NOT NULL AND (community_members_log.member_tier <> 'PAID_VIP'::text OR community_members_log.member_tier IS NULL)
          GROUP BY (community_members_log.free_group_joined_at::date)
        ), left_free AS (
         SELECT community_members_log.left_at::date AS d,
            count(*) AS members_left
           FROM community_members_log
          WHERE community_members_log.left_at IS NOT NULL
          GROUP BY (community_members_log.left_at::date)
        )
 SELECT COALESCE(pay.d, free.d, left_free.d) AS day,
    COALESCE(free.free_joins, 0::bigint)::integer AS free_joins,
    COALESCE(pay.vip_joins, 0::bigint)::integer AS vip_joins,
    COALESCE(pay.renewals, 0::bigint)::integer AS renewals,
    COALESCE(left_free.members_left, 0::bigint)::integer AS members_left,
    COALESCE(pay.revenue, 0::numeric)::numeric(12,2) AS revenue,
    COALESCE(pay.renewal_revenue, 0::numeric)::numeric(12,2) AS renewal_revenue,
    COALESCE(pay.associate_commission, 0::numeric)::numeric(12,2) AS associate_commission,
    COALESCE(pay.unattributed_commission, 0::numeric)::numeric(12,2) AS unattributed_commission,
    COALESCE(pay.kabidul_commission, 0::numeric)::numeric(12,2) AS kabidul_commission,
    (COALESCE(pay.revenue, 0::numeric) - COALESCE(pay.associate_commission, 0::numeric) - COALESCE(pay.kabidul_commission, 0::numeric))::numeric(12,2) AS owner_net
   FROM pay
     FULL JOIN free ON pay.d = free.d
     FULL JOIN left_free ON COALESCE(pay.d, free.d) = left_free.d
  ORDER BY (COALESCE(pay.d, free.d, left_free.d));

CREATE OR REPLACE VIEW public.team_growth_view AS
SELECT to_char(date_trunc('month'::text, COALESCE(paid_group_joined_at, free_group_joined_at, created_at)), 'YYYY-MM'::text) AS month,
    count(*) FILTER (WHERE member_tier <> 'PAID_VIP'::text OR member_tier IS NULL)::integer AS free_joins,
    count(*) FILTER (WHERE member_tier = 'PAID_VIP'::text)::integer AS vip_conversions,
    COALESCE(sum(paid_subscription_value) FILTER (WHERE paid_group_joined_at IS NOT NULL), 0::numeric)::numeric(12,2) AS revenue
   FROM community_members_log c
  WHERE deleted_at IS NULL AND COALESCE(paid_group_joined_at, free_group_joined_at, created_at) >= (date_trunc('month'::text, now()) - '1 year 5 mons'::interval)
  GROUP BY (to_char(date_trunc('month'::text, COALESCE(paid_group_joined_at, free_group_joined_at, created_at)), 'YYYY-MM'::text))
  ORDER BY (to_char(date_trunc('month'::text, COALESCE(paid_group_joined_at, free_group_joined_at, created_at)), 'YYYY-MM'::text));

CREATE OR REPLACE VIEW public.team_performance_view AS
WITH mem AS (
         SELECT c.associate_id,
            c.member_tier,
            c.paid_subscription_value,
            c.free_commission,
            c.paid_commission,
            c.paid_group_joined_at,
            COALESCE(c.paid_group_joined_at, c.free_group_joined_at, c.created_at) AS joined_at
           FROM community_members_log c
          WHERE c.deleted_at IS NULL AND c.associate_id IS NOT NULL
        )
 SELECT a.id AS associate_id,
    a.name AS team_member,
    a.status,
    a.created_at AS joined_team_at,
    COALESCE(a.paid_commission_pct, 5.00) AS commission_pct,
    COALESCE(a.total_paid, 0::numeric)::numeric(12,2) AS commission_paid,
    count(*) FILTER (WHERE m.member_tier <> 'PAID_VIP'::text OR m.member_tier IS NULL)::integer AS free_joins,
    count(*) FILTER (WHERE m.member_tier = 'PAID_VIP'::text)::integer AS vip_conversions,
    count(*)::integer AS total_members,
    round(100.0 * count(*) FILTER (WHERE m.member_tier = 'PAID_VIP'::text)::numeric / NULLIF(count(*), 0)::numeric, 1) AS conversion_rate_pct,
    COALESCE(sum(m.paid_subscription_value), 0::numeric)::numeric(12,2) AS revenue_driven,
    COALESCE(sum(m.free_commission + m.paid_commission), 0::numeric)::numeric(12,2) AS commission_earned,
    GREATEST(0::numeric, COALESCE(sum(m.free_commission + m.paid_commission), 0::numeric) - COALESCE(a.total_paid, 0::numeric))::numeric(12,2) AS commission_owed,
    count(*) FILTER (WHERE m.joined_at >= date_trunc('month'::text, now()) AND (m.member_tier <> 'PAID_VIP'::text OR m.member_tier IS NULL))::integer AS free_joins_mtd,
    count(*) FILTER (WHERE m.joined_at >= date_trunc('month'::text, now()) AND m.member_tier = 'PAID_VIP'::text)::integer AS vip_conversions_mtd,
    COALESCE(sum(m.paid_subscription_value) FILTER (WHERE m.paid_group_joined_at >= date_trunc('month'::text, now())), 0::numeric)::numeric(12,2) AS revenue_mtd,
    count(*) FILTER (WHERE m.joined_at >= (now() - '7 days'::interval) AND (m.member_tier <> 'PAID_VIP'::text OR m.member_tier IS NULL))::integer AS free_joins_7d,
    count(*) FILTER (WHERE m.joined_at >= (now() - '7 days'::interval) AND m.member_tier = 'PAID_VIP'::text)::integer AS vip_conversions_7d,
    max(m.joined_at) AS last_member_at,
    max(m.paid_group_joined_at) AS last_vip_at,
    EXTRACT(day FROM now() - max(m.joined_at))::integer AS days_since_last_member,
    max(m.joined_at) >= (now() - '7 days'::interval) AS active_7d,
    count(*) FILTER (WHERE m.joined_at >= (date_trunc('month'::text, now()) - '1 mon'::interval) AND m.joined_at < date_trunc('month'::text, now()))::integer AS members_prev_month
   FROM associates a
     LEFT JOIN mem m ON m.associate_id = a.id
  GROUP BY a.id, a.name, a.status, a.created_at, a.paid_commission_pct, a.total_paid
  ORDER BY (count(*) FILTER (WHERE m.member_tier = 'PAID_VIP'::text)::integer) DESC, (count(*) FILTER (WHERE m.member_tier <> 'PAID_VIP'::text OR m.member_tier IS NULL)::integer) DESC;

-- ── FUNCTIONS ───────────────────────────────────────────────────────

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────
ALTER TABLE public.credentials_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- policy Public Read CRM Settings on crm_settings: SELECT for {public}
CREATE POLICY Public Read CRM Settings ON public.crm_settings AS PERMISSIVE FOR SELECT TO {public}
  USING (true);

-- policy member_events_insert on member_events: INSERT for {anon,authenticated}
CREATE POLICY member_events_insert ON public.member_events AS PERMISSIVE FOR INSERT TO {anon,authenticated}
  WITH CHECK (true);

-- policy member_events_select on member_events: SELECT for {anon,authenticated}
CREATE POLICY member_events_select ON public.member_events AS PERMISSIVE FOR SELECT TO {anon,authenticated}
  USING (true);

-- policy member_payments_insert on member_payments: INSERT for {anon,authenticated}
CREATE POLICY member_payments_insert ON public.member_payments AS PERMISSIVE FOR INSERT TO {anon,authenticated}
  WITH CHECK (true);

-- policy member_payments_select on member_payments: SELECT for {anon,authenticated}
CREATE POLICY member_payments_select ON public.member_payments AS PERMISSIVE FOR SELECT TO {anon,authenticated}
  USING (true);

-- policy Public Insert Reviews on reviews: INSERT for {public}
CREATE POLICY Public Insert Reviews ON public.reviews AS PERMISSIVE FOR INSERT TO {public}
  WITH CHECK (true);

-- policy Public Read Approved Reviews on reviews: SELECT for {public}
CREATE POLICY Public Read Approved Reviews ON public.reviews AS PERMISSIVE FOR SELECT TO {public}
  USING (true);

-- policy Public Update Reviews on reviews: UPDATE for {public}
CREATE POLICY Public Update Reviews ON public.reviews AS PERMISSIVE FOR UPDATE TO {public}
  USING (true);

-- ── REALTIME PUBLICATION (supabase_realtime) ────────────────────────
