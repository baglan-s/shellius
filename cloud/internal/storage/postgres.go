package storage

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type Postgres struct {
	conn *sql.DB
}

type User struct {
	ID           string
	Email        string
	PasswordHash string
	AuthProvider string
	CreatedAt    time.Time
}

func NewPostgres(databaseURL string) (*Postgres, error) {
	conn, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.Ping(); err != nil {
		return nil, err
	}

	return &Postgres{conn: conn}, nil
}

func (p *Postgres) Close() error {
	return p.conn.Close()
}

func (p *Postgres) CreateUser(email, passwordHash, provider string) (*User, error) {
	id := uuid.New().String()
	_, err := p.conn.Exec(
		`INSERT INTO users (id, email, password_hash, auth_provider, created_at) VALUES ($1, $2, $3, $4, $5)`,
		id, email, passwordHash, provider, time.Now(),
	)
	if err != nil {
		return nil, err
	}
	return &User{ID: id, Email: email, AuthProvider: provider}, nil
}

func (p *Postgres) GetUserByEmail(email string) (*User, error) {
	var u User
	err := p.conn.QueryRow(
		`SELECT id, email, password_hash, auth_provider, created_at FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.AuthProvider, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (p *Postgres) GetUserByID(id string) (*User, error) {
	var u User
	err := p.conn.QueryRow(
		`SELECT id, email, password_hash, auth_provider, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.AuthProvider, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (p *Postgres) UpdateEmail(userID, email string) error {
	_, err := p.conn.Exec(`UPDATE users SET email = $1 WHERE id = $2`, email, userID)
	return err
}

func (p *Postgres) UpdatePassword(userID, passwordHash string) error {
	_, err := p.conn.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, passwordHash, userID)
	return err
}

func (p *Postgres) GetOrCreateOAuthUser(email, provider string) (*User, error) {
	user, err := p.GetUserByEmail(email)
	if err == nil {
		return user, nil
	}
	return p.CreateUser(email, "", provider)
}
