package server

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/shellius/backend/internal/ssh"
	"github.com/shellius/backend/internal/storage"
	"github.com/shellius/backend/pkg/protocol"
)

type SessionManager struct {
	db       *storage.DB
	sessions map[string]*ssh.Session
	clients  map[string]*ssh.Client
	mu       sync.RWMutex
}

func NewSessionManager(db *storage.DB) *SessionManager {
	return &SessionManager{
		db:       db,
		sessions: make(map[string]*ssh.Session),
		clients:  make(map[string]*ssh.Client),
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
	case protocol.MsgSnippetList:
		sm.handleSnippetList(conn)
	case protocol.MsgSnippetCreate:
		sm.handleSnippetCreate(conn, msg)
	case protocol.MsgSnippetDelete:
		sm.handleSnippetDelete(conn, msg)
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

	// If host_id is provided, look up from DB; otherwise use direct connection params
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

	client := ssh.NewClient(clientCfg)
	if err := client.Connect(); err != nil {
		sendError(conn, msg.ID, fmt.Sprintf("SSH connection failed: %v", err))
		return
	}

	sessionID := msg.SessionID
	if sessionID == "" {
		sessionID = msg.ID
	}

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

	// Send success
	sendMessage(conn, &protocol.Message{
		Type:      protocol.MsgSuccess,
		ID:        msg.ID,
		SessionID: sessionID,
		Payload:   map[string]string{"status": "connected"},
	})

	// Stream SSH output to WebSocket
	go sm.streamOutput(conn, sessionID, session)
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

// --- Helpers ---

func sendMessage(conn *websocket.Conn, msg *protocol.Message) {
	conn.WriteJSON(msg)
}

func sendError(conn *websocket.Conn, id string, message string) {
	sendMessage(conn, &protocol.Message{
		Type:    protocol.MsgError,
		ID:      id,
		Payload: protocol.ErrorPayload{Message: message},
	})
}
