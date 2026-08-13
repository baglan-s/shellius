# Shellius

Cross-platform desktop SSH client, SFTP manager, and password vault. Built with Go backend and Electron + React frontend.

## Features

### SSH Terminal
- Connect to remote servers via SSH (password and key-based authentication)
- Multiple simultaneous sessions with tabbed interface
- Quick Connect for one-time connections
- Saved hosts with groups for organization
- Terminal emulation via xterm.js with full color support
- Automatic terminal resizing
- Port forwarding (local forward)

### SFTP File Manager
- Browse remote file systems
- Upload and download files
- Create directories, rename, and delete files
- File size and permissions display

### Host Manager
- Save and organize SSH connections
- Group hosts by project, environment, or custom categories
- Store connection details (hostname, port, username, auth method)
- Double-click to connect

### Snippet Manager
- Save frequently used commands
- Quick execution in active terminal session
- Organize with labels and descriptions

### Password Vault
- Secure password storage with AES-256-GCM encryption
- Categories: General, Social, Finance, Work, Development
- Built-in password generator (configurable length, uppercase, numbers, symbols)
- Search and filter by category
- TOTP (2FA) support

### Cloud Sync
- Register with email/password or OAuth (Google, GitHub)
- End-to-end encryption — server never sees your data
- Offline-first with automatic sync when online
- Version-based conflict resolution
- Sync hosts, keys, snippets, and vault entries across devices

## Architecture

```
+---------------------------+
|    Electron + React (UI)  |
|    xterm.js terminal      |
+---------------------------+
            |
        WebSocket
            |
+---------------------------+
|    Go Backend (local)     |
|    SSH, SFTP, SQLite      |
+---------------------------+
            |
        HTTPS REST
            |
+---------------------------+
|    Go Cloud Server        |
|    Auth, Sync, PostgreSQL |
+---------------------------+
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite, Electron |
| Terminal | @xterm/xterm with fit and web-links addons |
| State Management | Zustand |
| Local Backend | Go, gorilla/websocket, golang.org/x/crypto/ssh, pkg/sftp |
| Local Database | SQLite (WAL mode) |
| Cloud Server | Go, golang-jwt, golang.org/x/oauth2 |
| Cloud Database | PostgreSQL 16 |
| Encryption | AES-256-GCM, Argon2id key derivation |
| Auth | JWT, bcrypt, OAuth 2.0 (Google, GitHub) |
| Containerization | Docker, Docker Compose |

## Project Structure

```
shellius/
├── backend/                    # Local desktop backend (Go)
│   ├── cmd/shellius/           # Entry point
│   ├── internal/
│   │   ├── server/             # WebSocket server + session manager
│   │   ├── ssh/                # SSH client, sessions, key generation
│   │   ├── sftp/               # SFTP file operations
│   │   ├── storage/            # SQLite database (hosts, keys, snippets, vault)
│   │   ├── sync/               # Cloud sync client
│   │   ├── crypto/             # AES-256-GCM encryption, Argon2id
│   │   └── config/             # Configuration
│   └── pkg/protocol/           # WebSocket message types
│
├── cloud/                      # Cloud API server (Go)
│   ├── cmd/server/             # Entry point
│   ├── internal/
│   │   ├── auth/               # Register, login, OAuth (Google, GitHub), JWT
│   │   ├── sync/               # Push/pull sync handlers
│   │   ├── storage/            # PostgreSQL (users, sync items)
│   │   └── middleware/         # Auth middleware, rate limiter
│   ├── migrations/             # SQL migrations
│   └── config/                 # Configuration
│
├── frontend/                   # Electron + React UI
│   ├── electron/               # Electron main process, preload
│   ├── src/
│   │   ├── components/
│   │   │   ├── Terminal/       # xterm.js terminal wrapper
│   │   │   ├── HostManager/    # Host list, form, groups, quick connect
│   │   │   ├── FileManager/    # SFTP browser
│   │   │   ├── Auth/           # Login, register, OAuth buttons
│   │   │   ├── Snippets/       # Snippet manager
│   │   │   ├── Vault/          # Password vault (list, form, generator, search)
│   │   │   ├── Tabs/           # Session tabs
│   │   │   └── Layout/         # Sidebar, main area
│   │   ├── hooks/              # useWebSocket, useTerminal, useAuth
│   │   ├── stores/             # Zustand stores (auth, hosts, sessions)
│   │   ├── contexts/           # WebSocket context provider
│   │   └── styles/             # Global CSS (Catppuccin theme)
│   └── package.json
│
├── scripts/                    # Build and dev scripts
├── docker-compose.yml          # PostgreSQL + cloud server
├── Dockerfile                  # Cloud server container
└── .gitignore
```

## Prerequisites

- **Go** 1.22+
- **Node.js** 18+
- **Docker** and **Docker Compose** (for cloud server and PostgreSQL)

## Quick Start

### Development Mode

1. **Clone the repository**
   ```bash
   git clone git@github.com:baglan-s/shellius.git
   cd shellius
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend && npm install && cd ..
   ```

3. **Install Go dependencies**
   ```bash
   cd backend && go mod tidy && cd ..
   cd cloud && go mod tidy && cd ..
   ```

4. **Start the local backend** (in terminal 1)
   ```bash
   cd backend && go run ./cmd/shellius
   ```
   Backend starts on `ws://localhost:9800`

5. **Start the frontend dev server** (in terminal 2)
   ```bash
   cd frontend && npm run dev
   ```
   Frontend available at `http://localhost:5173`

6. **Optional: Start cloud services** (in terminal 3)
   ```bash
   docker compose up -d postgres
   cd cloud && go run ./cmd/server
   ```
   Cloud API available at `http://localhost:8080`

### Using the dev script

```bash
./scripts/dev.sh
```
This starts PostgreSQL, cloud server, backend, and frontend simultaneously.

### Using Quick Connect

1. Open `http://localhost:5173` in your browser
2. Click the **Quick** tab in the sidebar
3. Enter hostname, port, username, and password
4. Click **Connect**
5. A new terminal tab opens with the SSH session

### Using Saved Hosts

1. Click the **Hosts** tab in the sidebar
2. Click **+ Add Host** to save a connection
3. Fill in the connection details and click **Save**
4. Double-click a host to connect

## Building for Production

### Build all components
```bash
./scripts/build.sh
```

This produces:
- `dist/shellius-backend-darwin-amd64` — macOS backend
- `dist/shellius-backend-linux-amd64` — Linux backend
- `dist/shellius-backend-windows-amd64.exe` — Windows backend
- `dist/shellius-cloud-linux-amd64` — Cloud server
- Electron app in `frontend/dist/`

### Build cloud server Docker image
```bash
docker compose build cloud
```

## Configuration

### Environment Variables

#### Cloud Server
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/shellius?sslmode=disable` |
| `JWT_SECRET` | Secret for JWT token signing | `change-me-in-production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | — |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | — |
| `OAUTH_CALLBACK_BASE` | Base URL for OAuth callbacks | `http://localhost:8080` |

#### Local Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `SHELLIUS_CLOUD_URL` | Cloud API URL | `https://api.shellius.io` |

### Ports
| Service | Port |
|---------|------|
| Frontend (dev) | 5173 |
| Backend WebSocket | 9800 |
| Cloud API | 8080 |
| PostgreSQL | 5432 |

## WebSocket Protocol

Communication between frontend and backend uses JSON messages over WebSocket:

```json
{
  "type": "ssh.connect",
  "id": "unique-message-id",
  "session_id": "session-id",
  "payload": {
    "hostname": "example.com",
    "port": 22,
    "username": "root",
    "auth_method": "password",
    "password": "secret"
  }
}
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `ssh.connect` | Client -> Server | Open SSH connection |
| `ssh.data` | Bidirectional | Terminal I/O data |
| `ssh.resize` | Client -> Server | Terminal resize event |
| `ssh.disconnect` | Bidirectional | Close SSH session |
| `host.list` | Client -> Server | Request saved hosts |
| `host.create` | Client -> Server | Save new host |
| `host.update` | Client -> Server | Update existing host |
| `host.delete` | Client -> Server | Delete host |
| `snippet.list` | Client -> Server | Request snippets |
| `snippet.create` | Client -> Server | Save new snippet |
| `snippet.delete` | Client -> Server | Delete snippet |
| `vault.list` | Client -> Server | Request vault entries |
| `vault.create` | Client -> Server | Save vault entry |
| `vault.update` | Client -> Server | Update vault entry |
| `vault.delete` | Client -> Server | Delete vault entry |
| `success` | Server -> Client | Operation successful |
| `error` | Server -> Client | Operation failed |

## Security

- **E2E Encryption**: All sensitive data (passwords, SSH keys, vault entries) is encrypted on the client using AES-256-GCM before being sent to the cloud
- **Key Derivation**: Master encryption key is derived from the user's password using Argon2id (3 iterations, 64MB memory, 4 threads)
- **Password Hashing**: User account passwords are hashed with bcrypt
- **JWT Authentication**: Tokens expire after 30 days
- **Local Storage**: SQLite database stored in `~/.shellius/` with WAL mode enabled
- **SSH**: Supports password and key-based authentication (Ed25519 key generation)
- **OAuth**: Secure OAuth 2.0 flow with Google and GitHub providers

## License

MIT
