package storage

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	conn *sql.DB
}

func Open(path string) (*DB, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	conn, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, err
	}

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, err
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) Conn() *sql.DB {
	return db.conn
}

func (db *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS hosts (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		hostname TEXT NOT NULL,
		port INTEGER NOT NULL DEFAULT 22,
		username TEXT NOT NULL,
		auth_method TEXT NOT NULL DEFAULT 'password',
		password_enc BLOB,
		key_id TEXT,
		group_name TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		version INTEGER DEFAULT 1,
		FOREIGN KEY (key_id) REFERENCES keys(id)
	);

	CREATE TABLE IF NOT EXISTS keys (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		private_key_enc BLOB NOT NULL,
		public_key TEXT,
		passphrase_enc BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		version INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS snippets (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		command TEXT NOT NULL,
		description TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		version INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS vault_entries (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		username TEXT,
		password_enc BLOB,
		url TEXT,
		notes_enc BLOB,
		category TEXT DEFAULT 'general',
		totp_secret_enc BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		version INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS master_settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		salt BLOB NOT NULL,
		verify_data BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS known_hosts (
		hostname TEXT NOT NULL,
		port INTEGER NOT NULL,
		key_type TEXT NOT NULL,
		fingerprint TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (hostname, port)
	);
	`
	_, err := db.conn.Exec(schema)
	return err
}
