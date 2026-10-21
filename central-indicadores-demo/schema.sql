CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  id INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection, id)
);
