package storage

import (
	"time"

	"github.com/google/uuid"
)

type PasswordReset struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	Used      bool
}

func (p *Postgres) CreatePasswordReset(userID, tokenHash string, expiresAt time.Time) error {
	id := uuid.New().String()
	_, err := p.conn.Exec(
		`INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		id, userID, tokenHash, expiresAt,
	)
	return err
}

func (p *Postgres) GetPasswordReset(tokenHash string) (*PasswordReset, error) {
	var pr PasswordReset
	err := p.conn.QueryRow(
		`SELECT id, user_id, token_hash, expires_at, used FROM password_resets WHERE token_hash = $1`,
		tokenHash,
	).Scan(&pr.ID, &pr.UserID, &pr.TokenHash, &pr.ExpiresAt, &pr.Used)
	if err != nil {
		return nil, err
	}
	return &pr, nil
}

func (p *Postgres) MarkPasswordResetUsed(id string) error {
	_, err := p.conn.Exec(`UPDATE password_resets SET used = TRUE WHERE id = $1`, id)
	return err
}
