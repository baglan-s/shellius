package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"

	"golang.org/x/crypto/ssh"
)

type KeyPair struct {
	PrivateKey []byte
	PublicKey  string
}

func GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	privBytes, err := ssh.MarshalPrivateKey(priv, "")
	if err != nil {
		return nil, err
	}

	privateKeyPEM := pem.EncodeToMemory(privBytes)

	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return nil, err
	}
	publicKey := string(ssh.MarshalAuthorizedKey(sshPub))

	return &KeyPair{
		PrivateKey: privateKeyPEM,
		PublicKey:  publicKey,
	}, nil
}
