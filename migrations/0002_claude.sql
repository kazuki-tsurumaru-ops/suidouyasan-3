-- 会社ごとの Claude の接続（API キーは暗号化して保存し、画面には末尾4文字だけを出す）
CREATE TABLE claude_connections (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  key_cipher TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  connected_by TEXT REFERENCES users(id),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_at TEXT
);
