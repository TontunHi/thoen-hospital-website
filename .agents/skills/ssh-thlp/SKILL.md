---
name: ssh-thlp
description: >-
  Connect to the Thoen Hospital API Gateway Proxmox VM (192.168.1.208) via SSH/Paramiko
  to deploy, test, inspect logs, and manage Fastify Docker containers. Trigger when user types
  /ssh-thlp, mentions the internal API gateway, or needs remote server deployment and debugging.
---

# SSH Internal Gateway Assistant (`/ssh-thlp`)

Operational standard and automation recipes for deploying, maintaining, and debugging the Thoen Hospital Internal API Gateway running on the Proxmox virtualized environment.

---

## 1. Environment Profile

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
> **Node.js is installed INSIDE the Docker container, NOT on the host OS bash.**
> Any `node`, `npm`, or syntax check must be executed via `docker exec thoen-api-gateway node ...`.

---

## 2. Security & Execution Rules

1. **Zero Hardcoded Credentials:** Never write SSH passwords or database credentials into repository files, persistent configs, or commits. Always prompt the user at runtime.
2. **Scratch Paramiko Pattern:** Write temporary Python scripts into the scratch directory:
   `<appDataDir>\brain\<conversation-id>\scratch\ssh_temp.py`.
   Execute using:
   ```powershell
   cmd.exe /c "python <appDataDir>\brain\<conversation-id>\scratch\ssh_temp.py"
   ```
   and immediately delete the scratch script upon completion.
3. **Zero Downtime / Pre-flight Validation:** Always perform syntax checks on modified `.js` files *before* restarting Docker containers.
4. **Anti-Cache & Audit Compliance:** Ensure all responses from endpoints pass `Cache-Control: no-store` and critical PHI endpoints log audit records.

---

## 3. Operational Recipes

### Recipe 1: Syntax & Pre-flight Check (Crucial before restart)
Check code validity inside the container without stopping the service:
```bash
docker exec thoen-api-gateway node --check /app/server.js
docker exec thoen-api-gateway node --check /app/routes/<plugin-name>.js
```

### Recipe 2: Fast Container Restart & Health Check
Restart the container and verify operational status:
```bash
docker restart thoen-api-gateway && sleep 2 && curl -s http://127.0.0.1:8443/health
```
**Expected Health Response:**
```json
{"status":"ok","timestamp":"...","uptime":2}
```

### Recipe 3: Live Logs & Diagnostic Inspection
Inspect live logs for runtime exceptions or database connection pool issues:
```bash
docker logs --tail 100 --timestamps thoen-api-gateway
```
Check container uptime and memory usage:
```bash
docker ps -f name=thoen-api-gateway
docker stats --no-stream thoen-api-gateway
```

### Recipe 4: Deploy / SFTP File Sync
When updating Gateway source code:
1. Target remote directory: `/home/thoen/thoen-api-gateway/routes/` or `/home/thoen/thoen-api-gateway/server.js`.
2. Keep mirrored backup or documentation in local `docs/gateway/`.
3. Use SFTP via Paramiko to transfer files cleanly.
4. Set permissions if needed (`chmod 644`).

---

## 4. Standard Paramiko Python Templates

### A. Remote Command Runner Template
Save to scratch, execute, and delete:
```python
import paramiko, sys

HOST = "192.168.1.208"
PORT = 22
USER = "thoen"
PASSWORD = sys.argv[1] # runtime prompt
COMMAND = sys.argv[2]

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

HOST = "192.168.1.208"
PORT = 22
USER = "thoen"
PASSWORD = sys.argv[1]
LOCAL_FILE = sys.argv[2]
REMOTE_FILE = sys.argv[3]

transport = paramiko.Transport((HOST, PORT))
try:
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(LOCAL_FILE, REMOTE_FILE)
    print(f"Uploaded {LOCAL_FILE} -> {REMOTE_FILE} successfully.")
    sftp.close()
finally:
    transport.close()
```

---

## 5. Gateway Plugin Inventory Reference

All plugins are registered under `/home/thoen/thoen-api-gateway/routes/`:

| Plugin File | Route Prefix | Purpose | Key Tables Accessed |
| :--- | :--- | :--- | :--- |
| `member.js` | `/api/member` | Member auth & profile | `opduser`, `doctor` |
| `clinical.js` | `/api/clinical` | Lab tracker, ER, Loratadine | `lab_head`, `er_regist`, `ovst` |
| `appointment.js`| `/api/appointment` | Check appointment date | `oapp` |
| `checkup.js` | `/api/checkup` | Health checkup records | Checkup DB |
| `salary.js` | `/api/salary` | Staff encrypted pay slips | External Salary DB |
| `hospital.js` | `/api/hospital` | Bed census, wait queue, ER | `ipt`, `ovst`, `er_regist` |
| `smart-refer.js`| `/api/smart-refer` | Refer out tracker | `referout` |
| `queue.js` | `/api/queue` | Real-time queue monitor | `ovst_queue` |

---

## 6. Handover Checklist
Before concluding an SSH session:
- [ ] Syntax check verified without errors (`docker exec ... node --check`).
- [ ] Container restarted cleanly (`docker restart thoen-api-gateway`).
- [ ] `/health` returns `200 OK` with `"status":"ok"`.
- [ ] Tested at least one functional endpoint with valid `x-api-key`.
- [ ] All temporary scripts in `<appDataDir>\brain\<conversation-id>\scratch\` deleted.
