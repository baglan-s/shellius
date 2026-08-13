package ssh

import (
	"fmt"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

type ClientConfig struct {
	Hostname   string
	Port       int
	Username   string
	AuthMethod string
	Password   string
	PrivateKey []byte
}

type Client struct {
	conn   *ssh.Client
	config *ClientConfig
}

func NewClient(cfg *ClientConfig) *Client {
	return &Client{config: cfg}
}

func (c *Client) Connect() error {
	authMethods, err := c.buildAuth()
	if err != nil {
		return err
	}

	sshConfig := &ssh.ClientConfig{
		User:            c.config.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: known_hosts verification
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", c.config.Hostname, c.config.Port)
	conn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", addr, err)
	}

	c.conn = conn
	return nil
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) SSHConn() *ssh.Client {
	return c.conn
}

func (c *Client) buildAuth() ([]ssh.AuthMethod, error) {
	switch c.config.AuthMethod {
	case "password":
		return []ssh.AuthMethod{ssh.Password(c.config.Password)}, nil
	case "key":
		signer, err := ssh.ParsePrivateKey(c.config.PrivateKey)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil
	default:
		return nil, fmt.Errorf("unsupported auth method: %s", c.config.AuthMethod)
	}
}

// LocalForward creates a local port forward (local:localPort -> remote:remoteHost:remotePort).
func (c *Client) LocalForward(localPort int, remoteHost string, remotePort int) (net.Listener, error) {
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", localPort))
	if err != nil {
		return nil, err
	}

	go func() {
		for {
			local, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				remote, err := c.conn.Dial("tcp", fmt.Sprintf("%s:%d", remoteHost, remotePort))
				if err != nil {
					local.Close()
					return
				}
				go copyConn(local, remote)
				go copyConn(remote, local)
			}()
		}
	}()

	return listener, nil
}

func copyConn(dst, src net.Conn) {
	defer dst.Close()
	defer src.Close()
	buf := make([]byte, 32*1024)
	for {
		n, err := src.Read(buf)
		if n > 0 {
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}
