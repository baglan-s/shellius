package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) SetToken(token string) {
	c.token = token
}

type SyncPayload struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	Data      json.RawMessage `json:"data"`
	Version   int             `json:"version"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type SyncResponse struct {
	Items   []SyncPayload `json:"items"`
	HasMore bool          `json:"has_more"`
}

func (c *Client) Push(items []SyncPayload) error {
	body, err := json.Marshal(items)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", c.baseURL+"/api/sync/push", bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sync push failed: %s", resp.Status)
	}
	return nil
}

func (c *Client) Pull(since time.Time) (*SyncResponse, error) {
	url := fmt.Sprintf("%s/api/sync/pull?since=%s", c.baseURL, since.UTC().Format(time.RFC3339))
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sync pull failed: %s", resp.Status)
	}

	var result SyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
}
