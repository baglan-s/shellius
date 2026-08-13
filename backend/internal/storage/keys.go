package storage

import (
	"time"

	"github.com/google/uuid"
)

type SSHKey struct {
	ID            string    `json:"id"`
	Label         string    `json:"label"`
	PrivateKeyEnc []byte    `json:"private_key_enc"`
	PublicKey     string    `json:"public_key,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Version       int       `json:"version"`
}

func (db *DB) CreateKey(k *SSHKey) error {
	if k.ID == "" {
		k.ID = uuid.New().String()
	}
	k.CreatedAt = time.Now()
	k.UpdatedAt = k.CreatedAt
	k.Version = 1

	_, err := db.conn.Exec(
		`INSERT INTO keys (id, label, private_key_enc, public_key, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		k.ID, k.Label, k.PrivateKeyEnc, k.PublicKey, k.CreatedAt, k.UpdatedAt, k.Version,
	)
	return err
}

func (db *DB) GetKeys() ([]SSHKey, error) {
	rows, err := db.conn.Query(`SELECT id, label, private_key_enc, public_key, created_at, updated_at, version FROM keys ORDER BY label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []SSHKey
	for rows.Next() {
		var k SSHKey
		if err := rows.Scan(&k.ID, &k.Label, &k.PrivateKeyEnc, &k.PublicKey, &k.CreatedAt, &k.UpdatedAt, &k.Version); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (db *DB) DeleteKey(id string) error {
	_, err := db.conn.Exec(`DELETE FROM keys WHERE id=?`, id)
	return err
}
