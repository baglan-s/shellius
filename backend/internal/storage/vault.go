package storage

import (
	"time"

	"github.com/google/uuid"
)

type VaultEntry struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Username      string    `json:"username"`
	PasswordEnc   []byte    `json:"password_enc,omitempty"`
	URL           string    `json:"url"`
	NotesEnc      []byte    `json:"notes_enc,omitempty"`
	Category      string    `json:"category"`
	TOTPSecretEnc []byte    `json:"totp_secret_enc,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Version       int       `json:"version"`
}

func (db *DB) CreateVaultEntry(v *VaultEntry) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	v.CreatedAt = time.Now()
	v.UpdatedAt = v.CreatedAt
	v.Version = 1

	_, err := db.conn.Exec(
		`INSERT INTO vault_entries (id, title, username, password_enc, url, notes_enc, category, totp_secret_enc, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		v.ID, v.Title, v.Username, v.PasswordEnc, v.URL, v.NotesEnc, v.Category, v.TOTPSecretEnc, v.CreatedAt, v.UpdatedAt, v.Version,
	)
	return err
}

func (db *DB) GetVaultEntries() ([]VaultEntry, error) {
	rows, err := db.conn.Query(`SELECT id, title, username, password_enc, url, notes_enc, category, totp_secret_enc, created_at, updated_at, version FROM vault_entries ORDER BY title`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []VaultEntry
	for rows.Next() {
		var v VaultEntry
		if err := rows.Scan(&v.ID, &v.Title, &v.Username, &v.PasswordEnc, &v.URL, &v.NotesEnc, &v.Category, &v.TOTPSecretEnc, &v.CreatedAt, &v.UpdatedAt, &v.Version); err != nil {
			return nil, err
		}
		entries = append(entries, v)
	}
	return entries, nil
}

func (db *DB) UpdateVaultEntry(v *VaultEntry) error {
	v.UpdatedAt = time.Now()
	v.Version++

	_, err := db.conn.Exec(
		`UPDATE vault_entries SET title=?, username=?, password_enc=?, url=?, notes_enc=?, category=?, totp_secret_enc=?, updated_at=?, version=? WHERE id=?`,
		v.Title, v.Username, v.PasswordEnc, v.URL, v.NotesEnc, v.Category, v.TOTPSecretEnc, v.UpdatedAt, v.Version, v.ID,
	)
	return err
}

func (db *DB) DeleteVaultEntry(id string) error {
	_, err := db.conn.Exec(`DELETE FROM vault_entries WHERE id=?`, id)
	return err
}
