// Package health reports whether the service's databases are reachable.
// Its JSON contract matches GET /api/health of the Node service.
package health

import (
	"context"
	"sync"
	"time"
)

// Prober checks one dependency.
type Prober interface {
	Check(ctx context.Context) error
}

// Overall status values.
const (
	Healthy   = "healthy"
	Degraded  = "degraded"
	Unhealthy = "unhealthy"
)

// ServiceCheck is the result for one dependency.
type ServiceCheck struct {
	Status    string `json:"status"` // UP or DOWN
	LatencyMs int64  `json:"latencyMs"`
	Error     string `json:"error,omitempty"`
}

// Services lists the dependencies in the order the contract defines.
type Services struct {
	PrimaryDatabase      ServiceCheck `json:"primaryDatabase"`
	HOSxPReplicaDatabase ServiceCheck `json:"hosxpReplicaDatabase"`
	SalaryDatabase       ServiceCheck `json:"salaryDatabase"`
}

// Report is the response body.
type Report struct {
	Status        string   `json:"status"`
	Timestamp     string   `json:"timestamp"`
	UptimeSeconds int64    `json:"uptimeSeconds"`
	Environment   string   `json:"environment"`
	Services      Services `json:"services"`
}

// Checker probes the three databases.
type Checker struct {
	Primary, HOSxP, Salary Prober
	Environment            string
	ProbeTimeout           time.Duration
	Now                    func() time.Time
	StartedAt              time.Time
}

// isoMillis is JavaScript's Date.prototype.toISOString layout.
const isoMillis = "2006-01-02T15:04:05.000Z"

// Check probes all dependencies in parallel and builds the report.
func (c *Checker) Check(ctx context.Context) Report {
	ctx, cancel := context.WithTimeout(ctx, c.ProbeTimeout)
	defer cancel()

	var svc Services
	var wg sync.WaitGroup
	for _, p := range []struct {
		prober Prober
		out    *ServiceCheck
	}{
		{c.Primary, &svc.PrimaryDatabase},
		{c.HOSxP, &svc.HOSxPReplicaDatabase},
		{c.Salary, &svc.SalaryDatabase},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			*p.out = c.probe(ctx, p.prober)
		}()
	}
	wg.Wait()

	now := c.Now()
	return Report{
		Status:        Overall(svc),
		Timestamp:     now.UTC().Format(isoMillis),
		UptimeSeconds: int64(now.Sub(c.StartedAt) / time.Second),
		Environment:   c.Environment,
		Services:      svc,
	}
}

func (c *Checker) probe(ctx context.Context, p Prober) ServiceCheck {
	start := c.Now()
	err := p.Check(ctx)
	check := ServiceCheck{Status: "UP", LatencyMs: c.Now().Sub(start).Milliseconds()}
	if err != nil {
		check.Status = "DOWN"
		check.Error = err.Error()
		if check.Error == "" {
			check.Error = "Connection failed"
		}
	}
	return check
}

// Overall applies the status rule: the primary database decides between
// serving and not serving; the two read-only databases only degrade.
func Overall(s Services) string {
	primaryUp := s.PrimaryDatabase.Status == "UP"
	switch {
	case primaryUp && s.HOSxPReplicaDatabase.Status == "UP" && s.SalaryDatabase.Status == "UP":
		return Healthy
	case primaryUp:
		return Degraded
	default:
		return Unhealthy
	}
}
