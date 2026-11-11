package storage

import (
	"time"

	"github.com/google/uuid"
)

type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

func (p *Postgres) CreateRefreshToken(userID, tokenHash string, expiresAt time.Time) error {
	id := uuid.New().String()
	_, err := p.conn.Exec(
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		id, userID, tokenHash, expiresAt,
	)
	return err
}

func (p *Postgres) GetRefreshToken(tokenHash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := p.conn.QueryRow(
		`SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &rt, nil
}

func (p *Postgres) DeleteRefreshToken(tokenHash string) error {
	_, err := p.conn.Exec(`DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash)
	return err
}

func (p *Postgres) DeleteUserRefreshTokens(userID string) error {
	_, err := p.conn.Exec(`DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}
