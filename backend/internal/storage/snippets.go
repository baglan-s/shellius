package storage

import (
	"time"

	"github.com/google/uuid"
)

type Snippet struct {
	ID          string    `json:"id"`
	Label       string    `json:"label"`
	Command     string    `json:"command"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Version     int       `json:"version"`
}

func (db *DB) CreateSnippet(s *Snippet) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = time.Now()
	s.UpdatedAt = s.CreatedAt
	s.Version = 1

	_, err := db.conn.Exec(
		`INSERT INTO snippets (id, label, command, description, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Label, s.Command, s.Description, s.CreatedAt, s.UpdatedAt, s.Version,
	)
	return err
}

func (db *DB) GetSnippets() ([]Snippet, error) {
	rows, err := db.conn.Query(`SELECT id, label, command, description, created_at, updated_at, version FROM snippets ORDER BY label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snippets []Snippet
	for rows.Next() {
		var s Snippet
		if err := rows.Scan(&s.ID, &s.Label, &s.Command, &s.Description, &s.CreatedAt, &s.UpdatedAt, &s.Version); err != nil {
			return nil, err
		}
		snippets = append(snippets, s)
	}
	return snippets, nil
}

func (db *DB) DeleteSnippet(id string) error {
	_, err := db.conn.Exec(`DELETE FROM snippets WHERE id=?`, id)
	return err
}
