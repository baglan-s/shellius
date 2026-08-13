package storage

import "time"

type SyncItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ItemType  string    `json:"item_type"`
	Data      []byte    `json:"data"`
	Version   int       `json:"version"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (p *Postgres) UpsertSyncItem(item *SyncItem) error {
	_, err := p.conn.Exec(
		`INSERT INTO sync_items (id, user_id, item_type, data, version, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id, user_id) DO UPDATE SET data=$4, version=$5, updated_at=$6
		 WHERE sync_items.version < $5`,
		item.ID, item.UserID, item.ItemType, item.Data, item.Version, item.UpdatedAt,
	)
	return err
}

func (p *Postgres) GetSyncItems(userID string, since time.Time) ([]SyncItem, error) {
	rows, err := p.conn.Query(
		`SELECT id, user_id, item_type, data, version, updated_at FROM sync_items
		 WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at`,
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SyncItem
	for rows.Next() {
		var item SyncItem
		if err := rows.Scan(&item.ID, &item.UserID, &item.ItemType, &item.Data, &item.Version, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}
