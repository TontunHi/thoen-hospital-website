---
name: ssh-thlp
description: >-
  Connect to Thoen Hospital internal servers (API Gateway VM 192.168.1.208 and File Storage CT 192.168.1.24)
  via SSH/Paramiko to deploy, manage MinIO/Docker services, inspect logs, and debug. Trigger when user
  types /ssh-thlp, mentions the internal API gateway or storage CT, or needs remote server maintenance.
---

# SSH Internal Infrastructure Assistant (`/ssh-thlp`)

Operational standard and automation recipes for deploying, maintaining, and debugging Thoen Hospital internal infrastructure on the Proxmox virtualized environment:
1. **API Gateway VM** (`192.168.1.208`): Unified Fastify Docker gateway routing queries to HOSxP, Salary, and App DBs.
2. **File Storage CT** (`192.168.1.24`): Proxmox LXC Container dedicated to file storage and MinIO S3-compatible object storage.

---

## 1. Environment Profiles

### Target A: API Gateway Proxmox VM

| Component | Target / Specification |
| :--- | :--- |
| **Host IP** | `192.168.1.208` (Port `22`) |
| **OS** | Debian GNU/Linux (Proxmox VE Virtual Machine) |
| **SSH User** | `thoen` (Password prompted at runtime) |
| **Deploy Directory** | `/home/thoen/thoen-api-gateway` |
| **Service Engine** | Docker Compose (`docker-compose.yml`) |
| **Container Name** | `thoen-api-gateway` |
| **Application Runtime** | Node.js (inside container) running **Fastify** |
| **Internal Port** | `8443` (`http://127.0.0.1:8443` or `http://192.168.1.208:8443`) |
| **Architecture** | Zero-Direct-DB from Next.js; all DB queries go through this Gateway |

> [!IMPORTANT]
> **Node.js is installed INSIDE the Docker container on 192.168.1.208, NOT on the host OS bash.**
> Any `node`, `npm`, or syntax check must be executed via `docker exec thoen-api-gateway node ...`.

---

### Target B: File Storage Proxmox CT (LXC Container)

| Component | Target / Specification |
| :--- | :--- |
| **Host IP** | `192.168.1.24` (Port `22`) |
| **OS / Type** | Proxmox LXC Container (CT) |
| **SSH User** | `root` (Password prompted at runtime) |
| **Primary Purpose** | Centralized file storage & MinIO S3-Compatible Object Storage |
| **Storage Data Path** | `/mnt/data` or `/var/lib/minio/data` |
| **Target Service** | MinIO Object Storage (`minio.service` or Docker container) |
| **Service Ports** | `9000` (S3 API Endpoint), `9001` (MinIO Web Console) |
| **Architecture Role** | Decouple uploaded assets (`public/uploads`, `storage/`) from web server |

---

## 2. Security & Execution Rules

1. **Zero Hardcoded Credentials:** Never write SSH passwords, root credentials, or S3 secret keys into repository files, persistent configs, or commits. Always prompt the user at runtime.
2. **Scratch Paramiko Pattern:** Write temporary Python scripts into the scratch directory:
   `<appDataDir>\brain\<conversation-id>\scratch\ssh_temp.py`.
   Execute using:
   ```powershell
   cmd.exe /c "python <appDataDir>\brain\<conversation-id>\scratch\ssh_temp.py"
   ```
   and immediately delete the scratch script upon completion.
3. **Target Selection:** Always verify which host (`192.168.1.208` as `thoen` vs. `192.168.1.24` as `root`) the command is intended for before running.
4. **Pre-flight & Zero Downtime:** Validate syntax and verify container/service status before concluding operations.
5. **Anti-Cache & Audit Compliance:** Ensure all responses from endpoints pass `Cache-Control: no-store` and critical PHI endpoints log audit records.

---

## 3. Operational Recipes

### Target A Recipes: API Gateway (`192.168.1.208:thoen`)

#### Recipe A1: Syntax & Pre-flight Check (Gateway)
Check code validity inside the container without stopping the service:
```bash
docker exec thoen-api-gateway node --check /app/server.js
docker exec thoen-api-gateway node --check /app/routes/<plugin-name>.js
```

#### Recipe A2: Fast Container Restart & Health Check (Gateway)
```bash
docker restart thoen-api-gateway && sleep 2 && curl -s http://127.0.0.1:8443/health
```

#### Recipe A3: Live Logs & Diagnostic Inspection (Gateway)
```bash
docker logs --tail 100 --timestamps thoen-api-gateway
docker ps -f name=thoen-api-gateway
```

#### Recipe A4: Deploy / SFTP File Sync (Gateway)
Upload updated route plugins or server code to `/home/thoen/thoen-api-gateway/routes/`.

---

### Target B Recipes: Storage Proxmox CT (`192.168.1.24:root`)

#### Recipe B1: CT Health & Disk Space Inspection
Check OS version, memory, and mounted disk capacity:
```bash
hostnamectl
df -h
free -m
```

#### Recipe B2: MinIO Service / Container Status
Check if MinIO is running natively via systemd or Docker:
```bash
systemctl status minio || docker ps -f name=minio
```
Test MinIO local API endpoint:
```bash
curl -I http://127.0.0.1:9000/minio/health/live
```

#### Recipe B3: Storage Directory & Permissions Check
Inspect data directory and ownership:
```bash
ls -la /mnt/data /var/lib/minio/data 2>/dev/null
```

#### Recipe B4: MinIO Client (mc) Bucket Setup & Management
Verify MinIO Client (`mc`) alias and existing buckets:
```bash
mc alias list
mc ls local/
# Create required buckets if missing:
mc mb local/public-assets
mc mb local/private-documents
```

---

## 4. Standard Paramiko Python Templates

### A. Flexible Remote Command Runner Template
Save to scratch, execute, and delete:
```python
import paramiko, sys

# Arguments: HOST USER PASSWORD COMMAND
HOST = sys.argv[1]     # "192.168.1.208" or "192.168.1.24"
PORT = 22
USER = sys.argv[2]     # "thoen" or "root"
PASSWORD = sys.argv[3] # Runtime user input
COMMAND = sys.argv[4]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=10)
    stdin, stdout, stderr = client.exec_command(COMMAND)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print("STDOUT:\n", out)
    if err:
        print("STDERR:\n", err)
finally:
    client.close()
```

### B. Remote File Upload Template (SFTP)
```python
import paramiko, sys

HOST = sys.argv[1]     # "192.168.1.208" or "192.168.1.24"
PORT = 22
USER = sys.argv[2]     # "thoen" or "root"
PASSWORD = sys.argv[3]
LOCAL_FILE = sys.argv[4]
REMOTE_FILE = sys.argv[5]

transport = paramiko.Transport((HOST, PORT))
try:
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(LOCAL_FILE, REMOTE_FILE)
    print(f"Uploaded {LOCAL_FILE} -> {REMOTE_FILE} successfully on {HOST}.")
    sftp.close()
finally:
    transport.close()
```

---

## 5. Gateway Plugin Inventory Reference (`192.168.1.208`)

All plugins are registered under `/home/thoen/thoen-api-gateway/routes/`:

| Plugin File | Route Prefix | Purpose | Key Tables Accessed |
| :--- | :--- | :--- | :--- |
| `health.js` | `/health` | Health & DB pool status | Ping all 3 DBs |
| `clinical.js` | `/api/v1/clinical` | Lab tracker, ER, Loratadine, TB | `lab_head`, `er_regist`, `ovst` |
| `palliative.js` | `/api/v1/clinical/rcm/palliative-care` | Palliative care registries & VN | `palliative_care_*` |
| `salary.js` | `/api/v1/salary` | Staff encrypted pay slips & periods | External Salary DB |
| `app.js` | `/api/v1/app` | Member auth, news, slides, repairs | Website DB (`thoen_hospital`) |
| `gtw.js` | `/api/v1/gtw` | GTW Health Article sync | Articles DB |
| `audit.js` | `/api/v1/audit` | PDPA audit access logging | `audit_logs` |
| `rawSql.js` | `/api/v1/{app,salary,clinical}` | Temporary raw SQL endpoints | Various (being phased out) |

---

## 6. Handover Checklist
Before concluding an SSH session:
- [ ] Confirmed target host IP and user (`192.168.1.208:thoen` vs. `192.168.1.24:root`).
- [ ] For Gateway (`192.168.1.208`): Syntax check verified (`docker exec ... node --check`), restarted cleanly, `/health` returns `200 OK`.
- [ ] For Storage CT (`192.168.1.24`): Disk space verified (`df -h`), MinIO service healthy (`9000`/`9001`).
- [ ] All temporary scripts in `<appDataDir>\brain\<conversation-id>\scratch\` deleted immediately.
