package storage

import (
	"time"

	"github.com/google/uuid"
)

type Host struct {
	ID         string    `json:"id"`
	Label      string    `json:"label"`
	Hostname   string    `json:"hostname"`
	Port       int       `json:"port"`
	Username   string    `json:"username"`
	AuthMethod string    `json:"auth_method"`
	PasswordEnc []byte   `json:"password_enc,omitempty"`
	KeyID      *string   `json:"key_id,omitempty"`
	GroupName  string    `json:"group_name"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	Version    int       `json:"version"`
}

func (db *DB) CreateHost(h *Host) error {
	if h.ID == "" {
		h.ID = uuid.New().String()
	}
	h.CreatedAt = time.Now()
	h.UpdatedAt = h.CreatedAt
	h.Version = 1

	_, err := db.conn.Exec(
		`INSERT INTO hosts (id, label, hostname, port, username, auth_method, password_enc, key_id, group_name, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.Label, h.Hostname, h.Port, h.Username, h.AuthMethod, h.PasswordEnc, h.KeyID, h.GroupName, h.CreatedAt, h.UpdatedAt, h.Version,
	)
	return err
}

func (db *DB) GetHosts() ([]Host, error) {
	rows, err := db.conn.Query(`SELECT id, label, hostname, port, username, auth_method, password_enc, key_id, group_name, created_at, updated_at, version FROM hosts ORDER BY label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hosts []Host
	for rows.Next() {
		var h Host
		if err := rows.Scan(&h.ID, &h.Label, &h.Hostname, &h.Port, &h.Username, &h.AuthMethod, &h.PasswordEnc, &h.KeyID, &h.GroupName, &h.CreatedAt, &h.UpdatedAt, &h.Version); err != nil {
			return nil, err
		}
		hosts = append(hosts, h)
	}
	return hosts, nil
}

func (db *DB) UpdateHost(h *Host) error {
	h.UpdatedAt = time.Now()
	h.Version++

	_, err := db.conn.Exec(
		`UPDATE hosts SET label=?, hostname=?, port=?, username=?, auth_method=?, password_enc=?, key_id=?, group_name=?, updated_at=?, version=? WHERE id=?`,
		h.Label, h.Hostname, h.Port, h.Username, h.AuthMethod, h.PasswordEnc, h.KeyID, h.GroupName, h.UpdatedAt, h.Version, h.ID,
	)
	return err
}

func (db *DB) DeleteHost(id string) error {
	_, err := db.conn.Exec(`DELETE FROM hosts WHERE id=?`, id)
	return err
}
