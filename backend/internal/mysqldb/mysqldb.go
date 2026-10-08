// Package mysqldb opens MySQL connection pools.
package mysqldb

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/TontunHi/thoen-hospital-website/backend/internal/config"
)

// Open builds a pool. It does not connect: like the Node pools, connections
// are made on first use, so one unreachable database cannot stop startup.
func Open(c config.DB, dialTimeout time.Duration) (*sql.DB, error) {
	mc := mysql.NewConfig()
	mc.Net = "tcp"
	mc.Addr = net.JoinHostPort(c.Host, strconv.Itoa(c.Port))
	mc.User = c.User
	mc.Passwd = c.Password
	mc.DBName = c.Name
	mc.Timeout = dialTimeout
	mc.Params = map[string]string{"charset": c.Charset}

	connector, err := mysql.NewConnector(mc)
	if err != nil {
		return nil, fmt.Errorf("mysql connector for database %q: %w", c.Name, err)
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(c.MaxConns)
	db.SetMaxIdleConns(c.MaxConns)
	db.SetConnMaxLifetime(30 * time.Minute)
	return db, nil
}

// Probe runs the same liveness query the Node health check runs.
type Probe struct{ DB *sql.DB }

// Check implements health.Prober.
func (p Probe) Check(ctx context.Context) error {
	var one int
	if err := p.DB.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		return fmt.Errorf("select 1: %w", err)
	}
	return nil
}
