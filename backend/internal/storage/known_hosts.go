package storage

import (
	"database/sql"
	"time"
)

type KnownHost struct {
	Hostname    string    `json:"hostname"`
	Port        int       `json:"port"`
	KeyType     string    `json:"key_type"`
	Fingerprint string    `json:"fingerprint"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (db *DB) GetKnownHost(hostname string, port int) (*KnownHost, error) {
	var kh KnownHost
	err := db.conn.QueryRow(
		`SELECT hostname, port, key_type, fingerprint, created_at, updated_at FROM known_hosts WHERE hostname=? AND port=?`,
		hostname, port,
	).Scan(&kh.Hostname, &kh.Port, &kh.KeyType, &kh.Fingerprint, &kh.CreatedAt, &kh.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &kh, nil
}

func (db *DB) SaveKnownHost(kh *KnownHost) error {
	now := time.Now()
	_, err := db.conn.Exec(
		`INSERT OR REPLACE INTO known_hosts (hostname, port, key_type, fingerprint, created_at, updated_at)
		 VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM known_hosts WHERE hostname=? AND port=?), ?), ?)`,
		kh.Hostname, kh.Port, kh.KeyType, kh.Fingerprint,
		kh.Hostname, kh.Port, now, now,
	)
	return err
}
