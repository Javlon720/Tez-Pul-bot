-- TezPul Bot v2 — Database Schema

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        VARCHAR(255),
  first_name      VARCHAR(255) NOT NULL DEFAULT 'User',
  last_name       VARCHAR(255),
  phone           VARCHAR(20),
  lang            VARCHAR(5)   NOT NULL DEFAULT 'uz',
  balance         BIGINT       NOT NULL DEFAULT 0,
  paid_amount     BIGINT       NOT NULL DEFAULT 0,
  unpaid_amount   BIGINT       NOT NULL DEFAULT 0,
  total_referrals INT          NOT NULL DEFAULT 0,
  referred_by     BIGINT REFERENCES users(telegram_id),
  is_verified     BOOLEAN      NOT NULL DEFAULT false,
  is_blocked      BOOLEAN      NOT NULL DEFAULT false,
  phone_verified  BOOLEAN      NOT NULL DEFAULT false,
  spins_used      INT          NOT NULL DEFAULT 0,
  last_active     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tg      ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_ref_by  ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_top     ON users(total_referrals DESC);

CREATE TABLE IF NOT EXISTS referrals (
  id           SERIAL PRIMARY KEY,
  referrer_id  BIGINT NOT NULL REFERENCES users(telegram_id),
  referred_id  BIGINT NOT NULL REFERENCES users(telegram_id),
  bonus_amount BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id         SERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(telegram_id),
  amount     BIGINT NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spin_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(telegram_id),
  game         VARCHAR(20) NOT NULL DEFAULT 'slot',
  bet_amount   BIGINT NOT NULL DEFAULT 0,
  result       VARCHAR(10) NOT NULL,
  prize_amount BIGINT NOT NULL DEFAULT 0,
  dice_value   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_channels (
  id         SERIAL PRIMARY KEY,
  tg_id      VARCHAR(100) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  url        TEXT         NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('min_payout',    '5000'),
  ('bonus_direct',  '1000'),
  ('spin_min_bet',  '1000'),
  ('spin_multiply', '2')
ON CONFLICT DO NOTHING;
