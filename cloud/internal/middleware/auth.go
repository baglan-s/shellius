package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/shellius/cloud/internal/auth"
)

type contextKey string

const UserIDKey contextKey = "user_id"

type Auth struct {
	jwt *auth.JWTService
}

func NewAuth(jwt *auth.JWTService) *Auth {
	return &Auth{jwt: jwt}
}

func (a *Auth) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := a.jwt.Validate(token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserID(r *http.Request) string {
	if id, ok := r.Context().Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}
