package protocol

// Message types for WebSocket communication between frontend and backend.

type MessageType string

const (
	// SSH
	MsgSSHConnect    MessageType = "ssh.connect"
	MsgSSHData       MessageType = "ssh.data"
	MsgSSHResize     MessageType = "ssh.resize"
	MsgSSHDisconnect MessageType = "ssh.disconnect"

	// SFTP
	MsgSFTPList     MessageType = "sftp.list"
	MsgSFTPDownload MessageType = "sftp.download"
	MsgSFTPUpload   MessageType = "sftp.upload"
	MsgSFTPMkdir    MessageType = "sftp.mkdir"
	MsgSFTPRemove   MessageType = "sftp.remove"
	MsgSFTPRename   MessageType = "sftp.rename"

	// Hosts
	MsgHostList   MessageType = "host.list"
	MsgHostCreate MessageType = "host.create"
	MsgHostUpdate MessageType = "host.update"
	MsgHostDelete MessageType = "host.delete"

	// Keys
	MsgKeyList     MessageType = "key.list"
	MsgKeyGenerate MessageType = "key.generate"
	MsgKeyImport   MessageType = "key.import"
	MsgKeyDelete   MessageType = "key.delete"

	// Snippets
	MsgSnippetList   MessageType = "snippet.list"
	MsgSnippetCreate MessageType = "snippet.create"
	MsgSnippetDelete MessageType = "snippet.delete"

	// Vault
	MsgVaultList   MessageType = "vault.list"
	MsgVaultCreate MessageType = "vault.create"
	MsgVaultUpdate MessageType = "vault.update"
	MsgVaultDelete MessageType = "vault.delete"

	// System
	MsgError   MessageType = "error"
	MsgSuccess MessageType = "success"
)

type Message struct {
	Type      MessageType `json:"type"`
	ID        string      `json:"id,omitempty"`
	SessionID string      `json:"session_id,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
}

type SSHConnectPayload struct {
	HostID     string `json:"host_id,omitempty"`
	Hostname   string `json:"hostname,omitempty"`
	Port       int    `json:"port,omitempty"`
	Username   string `json:"username,omitempty"`
	AuthMethod string `json:"auth_method,omitempty"`
	Password   string `json:"password,omitempty"`
}

type SSHDataPayload struct {
	Data string `json:"data"`
}

type SSHResizePayload struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

type SFTPListPayload struct {
	Path string `json:"path"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}
