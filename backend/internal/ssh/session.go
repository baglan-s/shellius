package ssh

import (
	"io"
	"sync"

	"golang.org/x/crypto/ssh"
)

type Session struct {
	id      string
	client  *Client
	session *ssh.Session
	stdin   io.WriteCloser
	stdout  io.Reader
	mu      sync.Mutex
}

func NewSession(id string, client *Client) (*Session, error) {
	sess, err := client.SSHConn().NewSession()
	if err != nil {
		return nil, err
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		sess.Close()
		return nil, err
	}

	stdout, err := sess.StdoutPipe()
	if err != nil {
		sess.Close()
		return nil, err
	}

	sess.Stderr = sess.Stdout // merge stderr into stdout

	return &Session{
		id:      id,
		client:  client,
		session: sess,
		stdin:   stdin,
		stdout:  stdout,
	}, nil
}

func (s *Session) RequestPTY(term string, rows, cols int) error {
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	return s.session.RequestPty(term, rows, cols, modes)
}

func (s *Session) Shell() error {
	return s.session.Shell()
}

func (s *Session) Write(data []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stdin.Write(data)
}

func (s *Session) Read(buf []byte) (int, error) {
	return s.stdout.Read(buf)
}

func (s *Session) Resize(rows, cols int) error {
	return s.session.WindowChange(rows, cols)
}

func (s *Session) Close() error {
	s.stdin.Close()
	return s.session.Close()
}

func (s *Session) ID() string {
	return s.id
}
