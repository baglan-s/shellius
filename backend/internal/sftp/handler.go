package sftp

import (
	"io"
	"os"

	gossh "golang.org/x/crypto/ssh"
	gosftp "github.com/pkg/sftp"
)

type Handler struct {
	client *gosftp.Client
}

func NewHandler(sshConn *gossh.Client) (*Handler, error) {
	client, err := gosftp.NewClient(sshConn)
	if err != nil {
		return nil, err
	}
	return &Handler{client: client}, nil
}

func (h *Handler) Close() error {
	return h.client.Close()
}

type FileInfo struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	Mode    string `json:"mode"`
	ModTime int64  `json:"mod_time"`
	IsDir   bool   `json:"is_dir"`
}

func (h *Handler) ListDir(path string) ([]FileInfo, error) {
	entries, err := h.client.ReadDir(path)
	if err != nil {
		return nil, err
	}

	files := make([]FileInfo, 0, len(entries))
	for _, e := range entries {
		files = append(files, FileInfo{
			Name:    e.Name(),
			Size:    e.Size(),
			Mode:    e.Mode().String(),
			ModTime: e.ModTime().Unix(),
			IsDir:   e.IsDir(),
		})
	}
	return files, nil
}

func (h *Handler) Download(remotePath string, w io.Writer) error {
	f, err := h.client.Open(remotePath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(w, f)
	return err
}

func (h *Handler) Upload(remotePath string, r io.Reader, perm os.FileMode) error {
	f, err := h.client.OpenFile(remotePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
	if err != nil {
		return err
	}
	defer f.Close()

	if err := f.Chmod(perm); err != nil {
		return err
	}

	_, err = io.Copy(f, r)
	return err
}

func (h *Handler) Mkdir(path string) error {
	return h.client.MkdirAll(path)
}

func (h *Handler) Remove(path string) error {
	return h.client.Remove(path)
}

func (h *Handler) Rename(oldPath, newPath string) error {
	return h.client.Rename(oldPath, newPath)
}

func (h *Handler) Stat(path string) (*FileInfo, error) {
	info, err := h.client.Stat(path)
	if err != nil {
		return nil, err
	}
	return &FileInfo{
		Name:    info.Name(),
		Size:    info.Size(),
		Mode:    info.Mode().String(),
		ModTime: info.ModTime().Unix(),
		IsDir:   info.IsDir(),
	}, nil
}
