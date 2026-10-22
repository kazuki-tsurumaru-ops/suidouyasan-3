-- すいどうやさん3.0 のデータベース（Cloudflare D1）
-- 会社ごとに分けられる形にしておく（まずは1社だけで使う）

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

-- 現場。kind は 水道局 / 元請け / 民間
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '民間',
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sites_company ON sites(company_id, created_at);

-- 写真。taken_at は写真に残っていた撮影日時（無ければ NULL）
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  r2_key TEXT NOT NULL,
  file_name TEXT,
  taken_at TEXT,
  has_place INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '振り分け済み',  -- 振り分け済み / 確認待ち
  part TEXT,                                    -- メーター・給水管・桝 など（AIが付ける）
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX photos_site ON photos(site_id, taken_at);

-- 図面（Jw_cad）。stage は 申請 / 竣工 / その他
CREATE TABLE drawings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'その他',
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX drawings_site ON drawings(site_id, uploaded_at);

-- 2つの図面の比較結果（違いの一覧と、AIの変更点のまとめ）
CREATE TABLE comparisons (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  before_id TEXT NOT NULL REFERENCES drawings(id),
  after_id TEXT NOT NULL REFERENCES drawings(id),
  diff_json TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 見積（Excel の型に書き込んだもの）
CREATE TABLE estimates (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  title TEXT NOT NULL,
  total INTEGER,
  r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
