package server

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"encoding/base64"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/shellius/backend/internal/sftp"
	"github.com/shellius/backend/internal/ssh"
	"github.com/shellius/backend/internal/storage"
	"github.com/shellius/backend/pkg/protocol"
	gossh "golang.org/x/crypto/ssh"
)

type SessionManager struct {
	db           *storage.DB
	sessions     map[string]*ssh.Session
	clients      map[string]*ssh.Client
	sftpHandlers map[string]*sftp.Handler
	mu           sync.RWMutex
	wsMu         sync.Mutex // protects WebSocket writes
}

func NewSessionManager(db *storage.DB) *SessionManager {
	return &SessionManager{
		db:           db,
		sessions:     make(map[string]*ssh.Session),
		clients:      make(map[string]*ssh.Client),
		sftpHandlers: make(map[string]*sftp.Handler),
	}
}

func (sm *SessionManager) HandleMessage(conn *websocket.Conn, msg *protocol.Message) {
	switch msg.Type {
	case protocol.MsgSSHConnect:
		sm.handleConnect(conn, msg)
	case protocol.MsgSSHData:
		sm.handleData(msg)
	case protocol.MsgSSHResize:
		sm.handleResize(msg)
	case protocol.MsgSSHDisconnect:
		sm.handleDisconnect(msg)
	case protocol.MsgHostList:
		sm.handleHostList(conn)
	case protocol.MsgHostCreate:
		sm.handleHostCreate(conn, msg)
	case protocol.MsgHostUpdate:
		sm.handleHostUpdate(conn, msg)
	case protocol.MsgHostDelete:
		sm.handleHostDelete(conn, msg)
	case protocol.MsgKeyList:
		sm.handleKeyList(conn)
	case protocol.MsgKeyGenerate:
		sm.handleKeyGenerate(conn, msg)
	case protocol.MsgKeyImport:
		sm.handleKeyImport(conn, msg)
	case protocol.MsgKeyDelete:
		sm.handleKeyDelete(conn, msg)
	case protocol.MsgSnippetList:
		sm.handleSnippetList(conn)
	case protocol.MsgSnippetCreate:
		sm.handleSnippetCreate(conn, msg)
	case protocol.MsgSnippetDelete:
		sm.handleSnippetDelete(conn, msg)
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
	case protocol.MsgVaultList:
		sm.handleVaultList(conn)
	case protocol.MsgVaultCreate:
		sm.handleVaultCreate(conn, msg)
	case protocol.MsgVaultUpdate:
		sm.handleVaultUpdate(conn, msg)
	case protocol.MsgVaultDelete:
		sm.handleVaultDelete(conn, msg)
	default:
		sendError(conn, msg.ID, fmt.Sprintf("unknown message type: %s", msg.Type))
	}
}

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

	// Run connection in goroutine to not block WebSocket read loop
	go sm.doConnect(conn, msg, &payload)
}

func (sm *SessionManager) doConnect(conn *websocket.Conn, msg *protocol.Message, payload *protocol.SSHConnectPayload) {
	var clientCfg *ssh.ClientConfig

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

		clientCfg = &ssh.ClientConfig{
			Hostname:   host.Hostname,
			Port:       host.Port,
			Username:   host.Username,
			AuthMethod: host.AuthMethod,
			Password:   string(host.PasswordEnc), // TODO: decrypt
		}

		// Load SSH key if key-based auth
		if host.AuthMethod == "key" && host.KeyID != nil {
			keys, err := sm.db.GetKeys()
			if err == nil {
				for _, k := range keys {
					if k.ID == *host.KeyID {
						clientCfg.PrivateKey = k.PrivateKeyEnc     // TODO: decrypt
						clientCfg.Passphrase = string(k.PassphraseEnc) // TODO: decrypt
						break
					}
				}
			}
		}
	} else {
		clientCfg = &ssh.ClientConfig{
			Hostname:   payload.Hostname,
			Port:       payload.Port,
			Username:   payload.Username,
			AuthMethod: payload.AuthMethod,
			Password:   payload.Password,
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

	// Send success
	sendMessage(conn, &protocol.Message{
		Type:      protocol.MsgSuccess,
		ID:        msg.ID,
		SessionID: sessionID,
		Payload:   map[string]string{"status": "connected"},
	})

	// Stream SSH output to WebSocket
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
	sendMessage(conn, &protocol.Message{Type: protocol.MsgHostList, Payload: hosts})
}

func (sm *SessionManager) handleHostCreate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var host storage.Host
	if err := json.Unmarshal(payloadBytes, &host); err != nil {
		sendError(conn, msg.ID, "invalid host data")
		return
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

	sshKey := &storage.SSHKey{
		Label:         payload.Label,
		PrivateKeyEnc: keyPair.PrivateKey, // TODO: encrypt with master key
		PublicKey:     keyPair.PublicKey,
	}
	if err := sm.db.CreateKey(sshKey); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to save key: %v", err))
		return
	}

	// Return key without private key data
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

	// Validate the key by parsing it (with or without passphrase)
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

	sshKey := &storage.SSHKey{
		Label:         payload.Label,
		PrivateKeyEnc: []byte(payload.PrivateKey), // TODO: encrypt with master key
		PublicKey:     publicKey,
		PassphraseEnc: []byte(payload.Passphrase), // TODO: encrypt with master key
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
	sendMessage(conn, &protocol.Message{Type: protocol.MsgVaultList, Payload: entries})
}

func (sm *SessionManager) handleVaultCreate(conn *websocket.Conn, msg *protocol.Message) {
	payloadBytes, _ := json.Marshal(msg.Payload)
	var entry storage.VaultEntry
	if err := json.Unmarshal(payloadBytes, &entry); err != nil {
		sendError(conn, msg.ID, "invalid vault entry data")
		return
	}
	if err := sm.db.CreateVaultEntry(&entry); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to create vault entry: %v", err))
		return
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
	if err := sm.db.UpdateVaultEntry(&entry); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("failed to update vault entry: %v", err))
		return
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

// --- Helpers ---

// wsMutex is set per-connection by the server
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
