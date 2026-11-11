package server

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"

	"time"

	"github.com/gorilla/websocket"
	"github.com/shellius/backend/internal/crypto"
	"github.com/shellius/backend/internal/sftp"
	"github.com/shellius/backend/internal/ssh"
	"github.com/shellius/backend/internal/storage"
	cloudsync "github.com/shellius/backend/internal/sync"
	"github.com/shellius/backend/pkg/protocol"
	gossh "golang.org/x/crypto/ssh"
)

const verifyPlaintext = "shellius-verify-token"

var errHostKeyRejected = errors.New("host key rejected by user")

type SessionManager struct {
	db           *storage.DB
	sessions     map[string]*ssh.Session
	clients      map[string]*ssh.Client
	sftpHandlers map[string]*sftp.Handler
	mu           sync.RWMutex
	wsMu         sync.Mutex // protects WebSocket writes

	encryptionKey []byte // derived from master password, nil = locked

	pendingVerify   map[string]chan bool // msgID → response channel for host key verification
	pendingVerifyMu sync.Mutex

	cloudURL  string
	authToken string // JWT token from frontend for cloud API

	portForwards   map[string]net.Listener // key: "sessionID:localPort"
	portForwardsMu sync.Mutex
}

func NewSessionManager(db *storage.DB, cloudURL string) *SessionManager {
	return &SessionManager{
		db:            db,
		sessions:      make(map[string]*ssh.Session),
		clients:       make(map[string]*ssh.Client),
		sftpHandlers:  make(map[string]*sftp.Handler),
		pendingVerify: make(map[string]chan bool),
		cloudURL:      cloudURL,
		portForwards:  make(map[string]net.Listener),
	}
}

func (sm *SessionManager) HandleMessage(conn *websocket.Conn, msg *protocol.Message) {
	switch msg.Type {
	// Master password
	case protocol.MsgMasterStatus:
		sm.handleMasterStatus(conn)
	case protocol.MsgMasterSetup:
		sm.handleMasterSetup(conn, msg)
	case protocol.MsgMasterUnlock:
		sm.handleMasterUnlock(conn, msg)
	// SSH
	case protocol.MsgSSHConnect:
		sm.handleConnect(conn, msg)
	case protocol.MsgSSHHostConfirm:
		sm.handleHostConfirm(msg)
	case protocol.MsgSSHData:
		sm.handleData(msg)
	case protocol.MsgSSHResize:
		sm.handleResize(msg)
	case protocol.MsgSSHDisconnect:
		sm.handleDisconnect(msg)
	// Hosts
	case protocol.MsgHostList:
		sm.handleHostList(conn)
	case protocol.MsgHostCreate:
		sm.handleHostCreate(conn, msg)
	case protocol.MsgHostUpdate:
		sm.handleHostUpdate(conn, msg)
	case protocol.MsgHostDelete:
		sm.handleHostDelete(conn, msg)
	// Keys
	case protocol.MsgKeyList:
		sm.handleKeyList(conn)
	case protocol.MsgKeyGenerate:
		sm.handleKeyGenerate(conn, msg)
	case protocol.MsgKeyImport:
		sm.handleKeyImport(conn, msg)
	case protocol.MsgKeyDelete:
		sm.handleKeyDelete(conn, msg)
	// Snippets
	case protocol.MsgSnippetList:
		sm.handleSnippetList(conn)
	case protocol.MsgSnippetCreate:
		sm.handleSnippetCreate(conn, msg)
	case protocol.MsgSnippetDelete:
		sm.handleSnippetDelete(conn, msg)
	// SFTP
	case protocol.MsgSFTPList:
		sm.handleSFTPList(conn, msg)
	case protocol.MsgSFTPMkdir:
		sm.handleSFTPMkdir(conn, msg)
	case protocol.MsgSFTPRemove:
		sm.handleSFTPRemove(conn, msg)
	case protocol.MsgSFTPRename:
		sm.handleSFTPRename(conn, msg)
	case protocol.MsgSFTPDownload:
		sm.handleSFTPDownload(conn, msg)
	case protocol.MsgSFTPUpload:
		sm.handleSFTPUpload(conn, msg)
	// Vault
	case protocol.MsgVaultList:
		sm.handleVaultList(conn)
	case protocol.MsgVaultCreate:
		sm.handleVaultCreate(conn, msg)
	case protocol.MsgVaultUpdate:
		sm.handleVaultUpdate(conn, msg)
	case protocol.MsgVaultDelete:
		sm.handleVaultDelete(conn, msg)
	// Port Forwarding
	case protocol.MsgPortForwardStart:
		sm.handlePortForwardStart(conn, msg)
	case protocol.MsgPortForwardStop:
		sm.handlePortForwardStop(conn, msg)
	case protocol.MsgPortForwardList:
		sm.handlePortForwardList(conn, msg)
	// Sync
	case protocol.MsgAuthToken:
		sm.handleAuthToken(conn, msg)
	case protocol.MsgSyncPush:
		sm.handleSyncPush(conn, msg)
	case protocol.MsgSyncPull:
		sm.handleSyncPull(conn, msg)
	default:
		sendError(conn, msg.ID, fmt.Sprintf("unknown message type: %s", msg.Type))
	}
}

// --- Encryption helpers ---

func (sm *SessionManager) encryptString(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	encrypted, err := crypto.Encrypt([]byte(plaintext), sm.encryptionKey)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func (sm *SessionManager) decryptString(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return ciphertext, nil // not encrypted (legacy plaintext data)
	}
	decrypted, err := crypto.Decrypt(data, sm.encryptionKey)
	if err != nil {
		return ciphertext, nil // decryption failed, return as-is (legacy data)
	}
	return string(decrypted), nil
}

func (sm *SessionManager) encryptBytes(plaintext []byte) ([]byte, error) {
	if len(plaintext) == 0 {
		return plaintext, nil
	}
	return crypto.Encrypt(plaintext, sm.encryptionKey)
}

func (sm *SessionManager) decryptBytes(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) == 0 {
		return ciphertext, nil
	}
	decrypted, err := crypto.Decrypt(ciphertext, sm.encryptionKey)
	if err != nil {
		return ciphertext, nil // legacy unencrypted data
	}
	return decrypted, nil
}

func (sm *SessionManager) isLocked() bool {
	return sm.encryptionKey == nil
}

// --- Master password handlers ---

func (sm *SessionManager) handleMasterStatus(conn *websocket.Conn) {
	ms, err := sm.db.GetMasterSettings()
	if err != nil {
		sendError(conn, "", fmt.Sprintf("failed to check master status: %v", err))
		return
	}
	configured := ms != nil
	locked := sm.isLocked()
	sendMessage(conn, &protocol.Message{
		Type: protocol.MsgMasterStatus,
		Payload: map[string]interface{}{
			"configured": configured,
			"locked":     locked,
		},
	})
}

func (sm *SessionManager) handleMasterSetup(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Password string `json:"password"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil || payload.Password == "" {
		sendError(conn, msg.ID, "password is required")
		return
	}

	// Check if already configured
	existing, _ := sm.db.GetMasterSettings()
	if existing != nil {
		sendError(conn, msg.ID, "master password already configured")
		return
	}

	// Generate salt and derive key
	salt, err := crypto.GenerateSalt()
	if err != nil {
		sendError(conn, msg.ID, "failed to generate salt")
		return
	}
	key := crypto.DeriveKey(payload.Password, salt)

	// Create verification data
	verifyData, err := crypto.Encrypt([]byte(verifyPlaintext), key)
	if err != nil {
		sendError(conn, msg.ID, "encryption error")
		return
	}

	// Save master settings
	if err := sm.db.SaveMasterSettings(salt, verifyData); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to save master settings: %v", err))
		return
	}

	// Unlock
	sm.encryptionKey = key

	// Encrypt existing unencrypted data
	sm.migrateExistingData()

	log.Println("master password configured and vault unlocked")
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

func (sm *SessionManager) handleMasterUnlock(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Password string `json:"password"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil || payload.Password == "" {
		sendError(conn, msg.ID, "password is required")
		return
	}

	ms, err := sm.db.GetMasterSettings()
	if err != nil || ms == nil {
		sendError(conn, msg.ID, "master password not configured")
		return
	}

	// Derive key and verify
	key := crypto.DeriveKey(payload.Password, ms.Salt)
	decrypted, err := crypto.Decrypt(ms.VerifyData, key)
	if err != nil || string(decrypted) != verifyPlaintext {
		sendError(conn, msg.ID, "incorrect master password")
		return
	}

	sm.encryptionKey = key
	log.Println("vault unlocked")
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

// migrateExistingData encrypts any existing plaintext data after first master password setup.
func (sm *SessionManager) migrateExistingData() {
	// Migrate vault entries
	entries, err := sm.db.GetVaultEntries()
	if err == nil {
		for _, e := range entries {
			changed := false
			if e.PasswordEnc != "" {
				if enc, err := sm.encryptString(e.PasswordEnc); err == nil {
					e.PasswordEnc = enc
					changed = true
				}
			}
			if e.NotesEnc != "" {
				if enc, err := sm.encryptString(e.NotesEnc); err == nil {
					e.NotesEnc = enc
					changed = true
				}
			}
			if e.TOTPSecretEnc != "" {
				if enc, err := sm.encryptString(e.TOTPSecretEnc); err == nil {
					e.TOTPSecretEnc = enc
					changed = true
				}
			}
			if changed {
				sm.db.UpdateVaultEntry(&e)
			}
		}
	}

	// Migrate host passwords
	hosts, err := sm.db.GetHosts()
	if err == nil {
		for _, h := range hosts {
			if h.PasswordEnc != "" {
				if enc, err := sm.encryptString(h.PasswordEnc); err == nil {
					h.PasswordEnc = enc
					sm.db.UpdateHost(&h)
				}
			}
		}
	}

	// Migrate SSH keys
	keys, err := sm.db.GetKeys()
	if err == nil {
		for _, k := range keys {
			changed := false
			if len(k.PrivateKeyEnc) > 0 {
				if enc, err := sm.encryptBytes(k.PrivateKeyEnc); err == nil {
					k.PrivateKeyEnc = enc
					changed = true
				}
			}
			if len(k.PassphraseEnc) > 0 {
				if enc, err := sm.encryptBytes(k.PassphraseEnc); err == nil {
					k.PassphraseEnc = enc
					changed = true
				}
			}
			if changed {
				sm.db.UpdateKey(&k)
			}
		}
	}

	log.Println("existing data encrypted with master key")
}

// --- Host key verification ---

func fingerprintSHA256(key gossh.PublicKey) string {
	hash := sha256.Sum256(key.Marshal())
	return base64.StdEncoding.EncodeToString(hash[:])
}

func (sm *SessionManager) makeHostKeyCallback(conn *websocket.Conn, msgID string) gossh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key gossh.PublicKey) error {
		// Parse host:port from remote address
		host, portStr, _ := net.SplitHostPort(remote.String())
		port := 22
		fmt.Sscanf(portStr, "%d", &port)

		// Also try the hostname from the connect config (might be different from resolved IP)
		if h, _, err := net.SplitHostPort(hostname); err == nil {
			host = h
		}

		fingerprint := fingerprintSHA256(key)
		keyType := key.Type()

		known, err := sm.db.GetKnownHost(host, port)
		if err != nil {
			log.Printf("known_hosts lookup error: %v", err)
			return nil // allow on DB error
		}

		if known != nil && known.Fingerprint == fingerprint {
			// Known and matches — allow
			return nil
		}

		// Need user confirmation
		status := "new"
		payload := map[string]interface{}{
			"hostname":    host,
			"port":        port,
			"fingerprint": fingerprint,
			"key_type":    keyType,
			"status":      status,
		}
		if known != nil {
			status = "changed"
			payload["status"] = status
			payload["old_fingerprint"] = known.Fingerprint
		}

		// Create channel for response
		ch := make(chan bool, 1)
		sm.pendingVerifyMu.Lock()
		sm.pendingVerify[msgID] = ch
		sm.pendingVerifyMu.Unlock()

		// Send verification request to frontend
		sendMessage(conn, &protocol.Message{
			Type: protocol.MsgSSHHostVerify,
			ID:   msgID,
			Payload: payload,
		})

		// Wait for user response
		accepted := <-ch

		// Cleanup
		sm.pendingVerifyMu.Lock()
		delete(sm.pendingVerify, msgID)
		sm.pendingVerifyMu.Unlock()

		if !accepted {
			return errHostKeyRejected
		}

		// Save to known_hosts
		sm.db.SaveKnownHost(&storage.KnownHost{
			Hostname:    host,
			Port:        port,
			KeyType:     keyType,
			Fingerprint: fingerprint,
		})

		log.Printf("host key accepted and saved: %s:%d (%s)", host, port, keyType)
		return nil
	}
}

func (sm *SessionManager) handleHostConfirm(msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Accept bool `json:"accept"`
	}
	json.Unmarshal(payloadBytes, &payload)

	sm.pendingVerifyMu.Lock()
	ch, ok := sm.pendingVerify[msg.ID]
	sm.pendingVerifyMu.Unlock()

	if ok {
		ch <- payload.Accept
	}
}

// --- SSH handlers ---

func (sm *SessionManager) handleConnect(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		sendError(conn, msg.ID, "invalid payload")
		return
	}

	var payload protocol.SSHConnectPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		sendError(conn, msg.ID, "invalid connect payload")
		return
	}

	go sm.doConnect(conn, msg, &payload)
}

func (sm *SessionManager) doConnect(conn *websocket.Conn, msg *protocol.Message, payload *protocol.SSHConnectPayload) {
	var clientCfg *ssh.ClientConfig
	hostKeyCallback := sm.makeHostKeyCallback(conn, msg.ID)

	if payload.HostID != "" {
		hosts, err := sm.db.GetHosts()
		if err != nil {
			sendError(conn, msg.ID, "failed to get hosts")
			return
		}
		var host *storage.Host
		for i := range hosts {
			if hosts[i].ID == payload.HostID {
				host = &hosts[i]
				break
			}
		}
		if host == nil {
			sendError(conn, msg.ID, "host not found")
			return
		}

		// Decrypt password
		password := host.PasswordEnc
		if sm.encryptionKey != nil && password != "" {
			if dec, err := sm.decryptString(password); err == nil {
				password = dec
			}
		}

		clientCfg = &ssh.ClientConfig{
			Hostname:        host.Hostname,
			Port:            host.Port,
			Username:        host.Username,
			AuthMethod:      host.AuthMethod,
			Password:        password,
			HostKeyCallback: hostKeyCallback,
		}

		// Load SSH key if key-based auth
		if host.AuthMethod == "key" && host.KeyID != nil {
			keys, err := sm.db.GetKeys()
			if err == nil {
				for _, k := range keys {
					if k.ID == *host.KeyID {
						// Decrypt key data
						privateKey := k.PrivateKeyEnc
						if sm.encryptionKey != nil {
							if dec, err := sm.decryptBytes(privateKey); err == nil {
								privateKey = dec
							}
						}
						passphrase := k.PassphraseEnc
						if sm.encryptionKey != nil {
							if dec, err := sm.decryptBytes(passphrase); err == nil {
								passphrase = dec
							}
						}
						clientCfg.PrivateKey = privateKey
						clientCfg.Passphrase = string(passphrase)
						break
					}
				}
			}
		}
	} else {
		clientCfg = &ssh.ClientConfig{
			Hostname:        payload.Hostname,
			Port:            payload.Port,
			Username:        payload.Username,
			AuthMethod:      payload.AuthMethod,
			Password:        payload.Password,
			HostKeyCallback: hostKeyCallback,
		}
		if payload.Port == 0 {
			clientCfg.Port = 22
		}
	}

	log.Printf("connecting to %s:%d as %s (auth: %s)", clientCfg.Hostname, clientCfg.Port, clientCfg.Username, clientCfg.AuthMethod)

	client := ssh.NewClient(clientCfg)
	if err := client.Connect(); err != nil {
		log.Printf("SSH connection failed: %v", err)
		sendError(conn, msg.ID, fmt.Sprintf("SSH connection failed: %v", err))
		return
	}

	sessionID := msg.SessionID
	if sessionID == "" {
		sessionID = msg.ID
	}

	log.Printf("connected, creating session %s", sessionID)

	session, err := ssh.NewSession(sessionID, client)
	if err != nil {
		client.Close()
		sendError(conn, msg.ID, fmt.Sprintf("failed to create session: %v", err))
		return
	}

	if err := session.RequestPTY("xterm-256color", 24, 80); err != nil {
		session.Close()
		client.Close()
		sendError(conn, msg.ID, fmt.Sprintf("PTY request failed: %v", err))
		return
	}

	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		sendError(conn, msg.ID, fmt.Sprintf("shell start failed: %v", err))
		return
	}

	sm.mu.Lock()
	sm.sessions[sessionID] = session
	sm.clients[sessionID] = client
	sm.mu.Unlock()

	log.Printf("session %s ready", sessionID)

	sendMessage(conn, &protocol.Message{
		Type:      protocol.MsgSuccess,
		ID:        msg.ID,
		SessionID: sessionID,
		Payload:   map[string]string{"status": "connected"},
	})

	sm.streamOutput(conn, sessionID, session)
}

func (sm *SessionManager) streamOutput(conn *websocket.Conn, sessionID string, session *ssh.Session) {
	buf := make([]byte, 32*1024)
	for {
		n, err := session.Read(buf)
		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])
			sendMessage(conn, &protocol.Message{
				Type:      protocol.MsgSSHData,
				SessionID: sessionID,
				Payload:   map[string]interface{}{"data": string(data)},
			})
		}
		if err != nil {
			log.Printf("session %s ended: %v", sessionID, err)
			sm.cleanup(sessionID)
			sendMessage(conn, &protocol.Message{
				Type:      protocol.MsgSSHDisconnect,
				SessionID: sessionID,
				Payload:   map[string]string{"reason": "session ended"},
			})
			return
		}
	}
}

func (sm *SessionManager) handleData(msg *protocol.Message) {
	sm.mu.RLock()
	session, ok := sm.sessions[msg.SessionID]
	sm.mu.RUnlock()

	if !ok {
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload protocol.SSHDataPayload
	json.Unmarshal(payloadBytes, &payload)

	if payload.Data != "" {
		session.Write([]byte(payload.Data))
	}
}

func (sm *SessionManager) handleResize(msg *protocol.Message) {
	sm.mu.RLock()
	session, ok := sm.sessions[msg.SessionID]
	sm.mu.RUnlock()

	if !ok {
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload protocol.SSHResizePayload
	json.Unmarshal(payloadBytes, &payload)

	session.Resize(payload.Rows, payload.Cols)
}

func (sm *SessionManager) handleDisconnect(msg *protocol.Message) {
	sm.cleanup(msg.SessionID)
}

func (sm *SessionManager) cleanup(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if handler, ok := sm.sftpHandlers[sessionID]; ok {
		handler.Close()
		delete(sm.sftpHandlers, sessionID)
	}
	if session, ok := sm.sessions[sessionID]; ok {
		session.Close()
		delete(sm.sessions, sessionID)
	}
	if client, ok := sm.clients[sessionID]; ok {
		client.Close()
		delete(sm.clients, sessionID)
	}
}

func (sm *SessionManager) CloseAll() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for id, handler := range sm.sftpHandlers {
		handler.Close()
		delete(sm.sftpHandlers, id)
	}
	for id, session := range sm.sessions {
		session.Close()
		delete(sm.sessions, id)
	}
	for id, client := range sm.clients {
		client.Close()
		delete(sm.clients, id)
	}
}

// --- Host CRUD handlers ---

func (sm *SessionManager) handleHostList(conn *websocket.Conn) {
	hosts, err := sm.db.GetHosts()
	if err != nil {
		sendError(conn, "", fmt.Sprintf("failed to get hosts: %v", err))
		return
	}
	// Don't decrypt passwords for listing — frontend doesn't need them
	sendMessage(conn, &protocol.Message{Type: protocol.MsgHostList, Payload: hosts})
}

func (sm *SessionManager) handleHostCreate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var host storage.Host
	if err := json.Unmarshal(payloadBytes, &host); err != nil {
		sendError(conn, msg.ID, "invalid host data")
		return
	}
	// Encrypt password
	if sm.encryptionKey != nil && host.PasswordEnc != "" {
		enc, err := sm.encryptString(host.PasswordEnc)
		if err != nil {
			sendError(conn, msg.ID, "encryption error")
			return
		}
		host.PasswordEnc = enc
	}
	if err := sm.db.CreateHost(&host); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to create host: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: host})
}

func (sm *SessionManager) handleHostUpdate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var host storage.Host
	if err := json.Unmarshal(payloadBytes, &host); err != nil {
		sendError(conn, msg.ID, "invalid host data")
		return
	}
	// If password is empty, keep existing password from DB
	if host.PasswordEnc == "" && host.AuthMethod == "password" {
		existingHosts, err := sm.db.GetHosts()
		if err == nil {
			for _, h := range existingHosts {
				if h.ID == host.ID {
					host.PasswordEnc = h.PasswordEnc
					break
				}
			}
		}
	} else if sm.encryptionKey != nil && host.PasswordEnc != "" {
		// Encrypt new password
		enc, err := sm.encryptString(host.PasswordEnc)
		if err != nil {
			sendError(conn, msg.ID, "encryption error")
			return
		}
		host.PasswordEnc = enc
	}
	if err := sm.db.UpdateHost(&host); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to update host: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: host})
}

func (sm *SessionManager) handleHostDelete(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct{ ID string `json:"id"` }
	json.Unmarshal(payloadBytes, &payload)
	if err := sm.db.DeleteHost(payload.ID); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to delete host: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

// --- Key handlers ---

func (sm *SessionManager) handleKeyList(conn *websocket.Conn) {
	keys, err := sm.db.GetKeys()
	if err != nil {
		sendError(conn, "", fmt.Sprintf("failed to get keys: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgKeyList, Payload: keys})
}

func (sm *SessionManager) handleKeyGenerate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Label string `json:"label"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		sendError(conn, msg.ID, "invalid payload")
		return
	}

	keyPair, err := ssh.GenerateKeyPair()
	if err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("key generation failed: %v", err))
		return
	}

	privateKeyData := keyPair.PrivateKey
	if sm.encryptionKey != nil {
		enc, err := sm.encryptBytes(privateKeyData)
		if err != nil {
			sendError(conn, msg.ID, "encryption error")
			return
		}
		privateKeyData = enc
	}

	sshKey := &storage.SSHKey{
		Label:         payload.Label,
		PrivateKeyEnc: privateKeyData,
		PublicKey:     keyPair.PublicKey,
	}
	if err := sm.db.CreateKey(sshKey); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to save key: %v", err))
		return
	}

	result := storage.SSHKey{
		ID:        sshKey.ID,
		Label:     sshKey.Label,
		PublicKey: sshKey.PublicKey,
		CreatedAt: sshKey.CreatedAt,
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: result})
}

func (sm *SessionManager) handleKeyImport(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Label      string `json:"label"`
		PrivateKey string `json:"private_key"`
		Passphrase string `json:"passphrase"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		sendError(conn, msg.ID, "invalid payload")
		return
	}

	// Validate the key
	var signer gossh.Signer
	var err error
	if payload.Passphrase != "" {
		signer, err = gossh.ParsePrivateKeyWithPassphrase([]byte(payload.PrivateKey), []byte(payload.Passphrase))
	} else {
		signer, err = gossh.ParsePrivateKey([]byte(payload.PrivateKey))
	}
	if err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("invalid private key: %v", err))
		return
	}

	publicKey := string(gossh.MarshalAuthorizedKey(signer.PublicKey()))

	// Encrypt before storing
	privateKeyData := []byte(payload.PrivateKey)
	passphraseData := []byte(payload.Passphrase)
	if sm.encryptionKey != nil {
		if enc, err := sm.encryptBytes(privateKeyData); err == nil {
			privateKeyData = enc
		}
		if len(passphraseData) > 0 {
			if enc, err := sm.encryptBytes(passphraseData); err == nil {
				passphraseData = enc
			}
		}
	}

	sshKey := &storage.SSHKey{
		Label:         payload.Label,
		PrivateKeyEnc: privateKeyData,
		PublicKey:     publicKey,
		PassphraseEnc: passphraseData,
	}
	if err := sm.db.CreateKey(sshKey); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to save key: %v", err))
		return
	}

	result := storage.SSHKey{
		ID:        sshKey.ID,
		Label:     sshKey.Label,
		PublicKey: sshKey.PublicKey,
		CreatedAt: sshKey.CreatedAt,
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: result})
}

func (sm *SessionManager) handleKeyDelete(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct{ ID string `json:"id"` }
	json.Unmarshal(payloadBytes, &payload)
	if err := sm.db.DeleteKey(payload.ID); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to delete key: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

// --- Snippet handlers ---

func (sm *SessionManager) handleSnippetList(conn *websocket.Conn) {
	snippets, err := sm.db.GetSnippets()
	if err != nil {
		sendError(conn, "", fmt.Sprintf("failed to get snippets: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSnippetList, Payload: snippets})
}

func (sm *SessionManager) handleSnippetCreate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var snippet storage.Snippet
	if err := json.Unmarshal(payloadBytes, &snippet); err != nil {
		sendError(conn, msg.ID, "invalid snippet data")
		return
	}
	if err := sm.db.CreateSnippet(&snippet); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to create snippet: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: snippet})
}

func (sm *SessionManager) handleSnippetDelete(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct{ ID string `json:"id"` }
	json.Unmarshal(payloadBytes, &payload)
	if err := sm.db.DeleteSnippet(payload.ID); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to delete snippet: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

// --- Vault handlers ---

func (sm *SessionManager) handleVaultList(conn *websocket.Conn) {
	entries, err := sm.db.GetVaultEntries()
	if err != nil {
		sendError(conn, "", fmt.Sprintf("failed to get vault entries: %v", err))
		return
	}
	// Decrypt sensitive fields before sending to frontend
	if sm.encryptionKey != nil {
		for i := range entries {
			if dec, err := sm.decryptString(entries[i].PasswordEnc); err == nil {
				entries[i].PasswordEnc = dec
			}
			if dec, err := sm.decryptString(entries[i].NotesEnc); err == nil {
				entries[i].NotesEnc = dec
			}
			if dec, err := sm.decryptString(entries[i].TOTPSecretEnc); err == nil {
				entries[i].TOTPSecretEnc = dec
			}
		}
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgVaultList, Payload: entries})
}

func (sm *SessionManager) handleVaultCreate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var entry storage.VaultEntry
	if err := json.Unmarshal(payloadBytes, &entry); err != nil {
		sendError(conn, msg.ID, "invalid vault entry data")
		return
	}
	// Encrypt sensitive fields
	if sm.encryptionKey != nil {
		if enc, err := sm.encryptString(entry.PasswordEnc); err == nil {
			entry.PasswordEnc = enc
		}
		if enc, err := sm.encryptString(entry.NotesEnc); err == nil {
			entry.NotesEnc = enc
		}
		if enc, err := sm.encryptString(entry.TOTPSecretEnc); err == nil {
			entry.TOTPSecretEnc = enc
		}
	}
	if err := sm.db.CreateVaultEntry(&entry); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to create vault entry: %v", err))
		return
	}
	// Decrypt for response so frontend gets plaintext
	if sm.encryptionKey != nil {
		if dec, err := sm.decryptString(entry.PasswordEnc); err == nil {
			entry.PasswordEnc = dec
		}
		if dec, err := sm.decryptString(entry.NotesEnc); err == nil {
			entry.NotesEnc = dec
		}
		if dec, err := sm.decryptString(entry.TOTPSecretEnc); err == nil {
			entry.TOTPSecretEnc = dec
		}
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: entry})
}

func (sm *SessionManager) handleVaultUpdate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var entry storage.VaultEntry
	if err := json.Unmarshal(payloadBytes, &entry); err != nil {
		sendError(conn, msg.ID, "invalid vault entry data")
		return
	}
	// Encrypt sensitive fields
	if sm.encryptionKey != nil {
		if enc, err := sm.encryptString(entry.PasswordEnc); err == nil {
			entry.PasswordEnc = enc
		}
		if enc, err := sm.encryptString(entry.NotesEnc); err == nil {
			entry.NotesEnc = enc
		}
		if enc, err := sm.encryptString(entry.TOTPSecretEnc); err == nil {
			entry.TOTPSecretEnc = enc
		}
	}
	if err := sm.db.UpdateVaultEntry(&entry); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to update vault entry: %v", err))
		return
	}
	// Decrypt for response
	if sm.encryptionKey != nil {
		if dec, err := sm.decryptString(entry.PasswordEnc); err == nil {
			entry.PasswordEnc = dec
		}
		if dec, err := sm.decryptString(entry.NotesEnc); err == nil {
			entry.NotesEnc = dec
		}
		if dec, err := sm.decryptString(entry.TOTPSecretEnc); err == nil {
			entry.TOTPSecretEnc = dec
		}
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: entry})
}

func (sm *SessionManager) handleVaultDelete(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct{ ID string `json:"id"` }
	json.Unmarshal(payloadBytes, &payload)
	if err := sm.db.DeleteVaultEntry(payload.ID); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to delete vault entry: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID})
}

// --- SFTP handlers ---

func (sm *SessionManager) getSFTPHandler(sessionID string) (*sftp.Handler, error) {
	sm.mu.RLock()
	handler, ok := sm.sftpHandlers[sessionID]
	sm.mu.RUnlock()
	if ok {
		return handler, nil
	}

	sm.mu.RLock()
	client, ok := sm.clients[sessionID]
	sm.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("no SSH connection for session %s", sessionID)
	}

	handler, err := sftp.NewHandler(client.SSHConn())
	if err != nil {
		return nil, fmt.Errorf("failed to start SFTP: %v", err)
	}

	sm.mu.Lock()
	sm.sftpHandlers[sessionID] = handler
	sm.mu.Unlock()

	return handler, nil
}

func (sm *SessionManager) handleSFTPList(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload protocol.SFTPListPayload
	json.Unmarshal(payloadBytes, &payload)

	path := payload.Path
	if path == "" {
		path = "/"
	}

	files, err := handler.ListDir(path)
	if err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to list directory: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{
		Type:      protocol.MsgSFTPList,
		ID:        msg.ID,
		SessionID: msg.SessionID,
		Payload:   map[string]interface{}{"path": path, "files": files},
	})
}

func (sm *SessionManager) handleSFTPMkdir(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Path string `json:"path"`
	}
	json.Unmarshal(payloadBytes, &payload)

	if err := handler.Mkdir(payload.Path); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to create directory: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, SessionID: msg.SessionID})
}

func (sm *SessionManager) handleSFTPRemove(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Path string `json:"path"`
	}
	json.Unmarshal(payloadBytes, &payload)

	if err := handler.Remove(payload.Path); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to remove: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, SessionID: msg.SessionID})
}

func (sm *SessionManager) handleSFTPRename(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}
	json.Unmarshal(payloadBytes, &payload)

	if err := handler.Rename(payload.OldPath, payload.NewPath); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to rename: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, SessionID: msg.SessionID})
}

func (sm *SessionManager) handleSFTPDownload(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Path string `json:"path"`
	}
	json.Unmarshal(payloadBytes, &payload)

	var buf strings.Builder
	if err := handler.Download(payload.Path, &buf); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to download: %v", err))
		return
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(buf.String()))
	sendMessage(conn, &protocol.Message{
		Type:      protocol.MsgSFTPDownload,
		ID:        msg.ID,
		SessionID: msg.SessionID,
		Payload: map[string]interface{}{
			"path": payload.Path,
			"data": encoded,
			"size": len(buf.String()),
		},
	})
}

func (sm *SessionManager) handleSFTPUpload(conn *websocket.Conn, msg *protocol.Message) {
	handler, err := sm.getSFTPHandler(msg.SessionID)
	if err != nil {
		sendError(conn, msg.ID, err.Error())
		return
	}

	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Path string `json:"path"`
		Data string `json:"data"` // base64 encoded
	}
	json.Unmarshal(payloadBytes, &payload)

	decoded, err := base64.StdEncoding.DecodeString(payload.Data)
	if err != nil {
		sendError(conn, msg.ID, "invalid file data")
		return
	}

	if err := handler.Upload(payload.Path, strings.NewReader(string(decoded)), 0644); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to upload: %v", err))
		return
	}
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, SessionID: msg.SessionID})
}

// --- Port Forwarding handlers ---

func (sm *SessionManager) handlePortForwardStart(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		LocalPort  int    `json:"local_port"`
		RemoteHost string `json:"remote_host"`
		RemotePort int    `json:"remote_port"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		sendError(conn, msg.ID, "invalid port forward data")
		return
	}

	sm.mu.RLock()
	client, ok := sm.clients[msg.SessionID]
	sm.mu.RUnlock()
	if !ok {
		sendError(conn, msg.ID, "no active SSH session")
		return
	}

	if payload.RemoteHost == "" {
		payload.RemoteHost = "localhost"
	}

	listener, err := client.LocalForward(payload.LocalPort, payload.RemoteHost, payload.RemotePort)
	if err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("port forward failed: %v", err))
		return
	}

	key := fmt.Sprintf("%s:%d", msg.SessionID, payload.LocalPort)
	sm.portForwardsMu.Lock()
	sm.portForwards[key] = listener
	sm.portForwardsMu.Unlock()

	sendMessage(conn, &protocol.Message{
		Type: protocol.MsgSuccess, ID: msg.ID,
		Payload: map[string]interface{}{
			"status":      "forwarding",
			"local_port":  payload.LocalPort,
			"remote_host": payload.RemoteHost,
			"remote_port": payload.RemotePort,
		},
	})
}

func (sm *SessionManager) handlePortForwardStop(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		LocalPort int `json:"local_port"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		sendError(conn, msg.ID, "invalid data")
		return
	}

	key := fmt.Sprintf("%s:%d", msg.SessionID, payload.LocalPort)
	sm.portForwardsMu.Lock()
	if listener, ok := sm.portForwards[key]; ok {
		listener.Close()
		delete(sm.portForwards, key)
	}
	sm.portForwardsMu.Unlock()

	sendMessage(conn, &protocol.Message{
		Type: protocol.MsgSuccess, ID: msg.ID,
		Payload: map[string]string{"status": "stopped"},
	})
}

func (sm *SessionManager) handlePortForwardList(conn *websocket.Conn, msg *protocol.Message) {
	sm.portForwardsMu.Lock()
	var forwards []map[string]interface{}
	for key := range sm.portForwards {
		forwards = append(forwards, map[string]interface{}{"key": key})
	}
	sm.portForwardsMu.Unlock()

	sendMessage(conn, &protocol.Message{
		Type: protocol.MsgSuccess, ID: msg.ID,
		Payload: map[string]interface{}{"forwards": forwards},
	})
}

// --- Sync handlers ---

func (sm *SessionManager) handleAuthToken(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil || payload.Token == "" {
		sendError(conn, msg.ID, "invalid token")
		return
	}
	sm.authToken = payload.Token
	sendMessage(conn, &protocol.Message{Type: protocol.MsgSuccess, ID: msg.ID, Payload: map[string]string{"status": "token set"}})
}

func (sm *SessionManager) handleSyncPush(conn *websocket.Conn, msg *protocol.Message) {
	if sm.authToken == "" {
		sendError(conn, msg.ID, "not authenticated — sign in first")
		return
	}

	client := cloudsync.NewClient(sm.cloudURL, sm.authToken)
	var items []cloudsync.SyncPayload

	// Collect hosts (encrypted data as-is from DB)
	hosts, _ := sm.db.GetHosts()
	for _, h := range hosts {
		data, _ := json.Marshal(h)
		items = append(items, cloudsync.SyncPayload{
			Type: "host", ID: h.ID, Data: data, Version: h.Version, UpdatedAt: h.UpdatedAt,
		})
	}

	// Collect snippets
	snippets, _ := sm.db.GetSnippets()
	for _, s := range snippets {
		data, _ := json.Marshal(s)
		items = append(items, cloudsync.SyncPayload{
			Type: "snippet", ID: s.ID, Data: data, Version: s.Version, UpdatedAt: s.UpdatedAt,
		})
	}

	// Collect vault entries (encrypted data as-is from DB)
	entries, _ := sm.db.GetVaultEntries()
	for _, v := range entries {
		data, _ := json.Marshal(v)
		items = append(items, cloudsync.SyncPayload{
			Type: "vault", ID: v.ID, Data: data, Version: v.Version, UpdatedAt: v.UpdatedAt,
		})
	}

	// Collect SSH keys — include encrypted private key/passphrase (json:"-" by default)
	keys, _ := sm.db.GetKeys()
	for _, k := range keys {
		syncKey := struct {
			ID            string    `json:"id"`
			Label         string    `json:"label"`
			PrivateKeyEnc []byte    `json:"private_key_enc"`
			PublicKey     string    `json:"public_key"`
			PassphraseEnc []byte    `json:"passphrase_enc"`
			CreatedAt     time.Time `json:"created_at"`
			UpdatedAt     time.Time `json:"updated_at"`
			Version       int       `json:"version"`
		}{k.ID, k.Label, k.PrivateKeyEnc, k.PublicKey, k.PassphraseEnc, k.CreatedAt, k.UpdatedAt, k.Version}
		data, _ := json.Marshal(syncKey)
		items = append(items, cloudsync.SyncPayload{
			Type: "key", ID: k.ID, Data: data, Version: k.Version, UpdatedAt: k.UpdatedAt,
		})
	}

	if err := client.Push(items); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("sync push failed: %v", err))
		return
	}

	sendMessage(conn, &protocol.Message{
		Type:    protocol.MsgSuccess,
		ID:      msg.ID,
		Payload: map[string]interface{}{"status": "pushed", "count": len(items)},
	})
}

func (sm *SessionManager) handleSyncPull(conn *websocket.Conn, msg *protocol.Message) {
	if sm.authToken == "" {
		sendError(conn, msg.ID, "not authenticated — sign in first")
		return
	}

	client := cloudsync.NewClient(sm.cloudURL, sm.authToken)
	resp, err := client.Pull(time.Time{})
	if err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("sync pull failed: %v", err))
		return
	}

	for _, item := range resp.Items {
		switch item.Type {
		case "host":
			var h storage.Host
			if json.Unmarshal(item.Data, &h) == nil {
				existing, _ := sm.db.GetHosts()
				found := false
				for _, e := range existing {
					if e.ID == h.ID {
						found = true
						if item.Version > e.Version {
							sm.db.UpdateHost(&h)
						}
						break
					}
				}
				if !found {
					sm.db.CreateHost(&h)
				}
			}
		case "snippet":
			var s storage.Snippet
			if json.Unmarshal(item.Data, &s) == nil {
				existing, _ := sm.db.GetSnippets()
				found := false
				for _, e := range existing {
					if e.ID == s.ID {
						found = true
						break
					}
				}
				if !found {
					sm.db.CreateSnippet(&s)
				}
			}
		case "vault":
			var v storage.VaultEntry
			if json.Unmarshal(item.Data, &v) == nil {
				existing, _ := sm.db.GetVaultEntries()
				found := false
				for _, e := range existing {
					if e.ID == v.ID {
						found = true
						if item.Version > e.Version {
							sm.db.UpdateVaultEntry(&v)
						}
						break
					}
				}
				if !found {
					sm.db.CreateVaultEntry(&v)
				}
			}
		case "key":
			var raw struct {
				ID            string    `json:"id"`
				Label         string    `json:"label"`
				PrivateKeyEnc []byte    `json:"private_key_enc"`
				PublicKey     string    `json:"public_key"`
				PassphraseEnc []byte    `json:"passphrase_enc"`
				CreatedAt     time.Time `json:"created_at"`
				UpdatedAt     time.Time `json:"updated_at"`
				Version       int       `json:"version"`
			}
			if json.Unmarshal(item.Data, &raw) == nil {
				k := storage.SSHKey{
					ID: raw.ID, Label: raw.Label, PrivateKeyEnc: raw.PrivateKeyEnc,
					PublicKey: raw.PublicKey, PassphraseEnc: raw.PassphraseEnc,
					CreatedAt: raw.CreatedAt, UpdatedAt: raw.UpdatedAt, Version: raw.Version,
				}
				existing, _ := sm.db.GetKeys()
				found := false
				for _, e := range existing {
					if e.ID == k.ID {
						found = true
						break
					}
				}
				if !found {
					sm.db.CreateKey(&k)
				}
			}
		}
	}

	// Send refreshed lists to frontend
	sm.handleHostList(conn)
	sm.handleSnippetList(conn)
	sm.handleVaultList(conn)
	sm.handleKeyList(conn)

	sendMessage(conn, &protocol.Message{
		Type:    protocol.MsgSuccess,
		ID:      msg.ID,
		Payload: map[string]interface{}{"status": "pulled", "count": len(resp.Items)},
	})
}

// --- Helpers ---

var wsMutex sync.Mutex

func sendMessage(conn *websocket.Conn, msg *protocol.Message) {
	wsMutex.Lock()
	defer wsMutex.Unlock()
	conn.WriteJSON(msg)
}

func sendError(conn *websocket.Conn, id string, message string) {
	sendMessage(conn, &protocol.Message{
		Type:    protocol.MsgError,
		ID:      id,
		Payload: protocol.ErrorPayload{Message: message},
	})
}
