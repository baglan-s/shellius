package storage

import "database/sql"

type MasterSettings struct {
	Salt       []byte
	VerifyData []byte
}

func (db *DB) GetMasterSettings() (*MasterSettings, error) {
	var ms MasterSettings
	err := db.conn.QueryRow(`SELECT salt, verify_data FROM master_settings WHERE id = 1`).
		Scan(&ms.Salt, &ms.VerifyData)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ms, nil
}

func (db *DB) SaveMasterSettings(salt, verifyData []byte) error {
	_, err := db.conn.Exec(
		`INSERT OR REPLACE INTO master_settings (id, salt, verify_data) VALUES (1, ?, ?)`,
		salt, verifyData,
	)
	return err
}
