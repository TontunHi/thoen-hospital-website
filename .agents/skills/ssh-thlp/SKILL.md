---
name: ssh-thlp
description: >-
  Connects to a remote server via SSH (prompts for SSH IP, User, Password at runtime)
  to develop, deploy, and verify an internal API Gateway connecting to a backend database.
  Trigger when user types /ssh-thlp or asks to build an internal SSH API gateway.
---

# SSH Internal Gateway Assistant (`/ssh-thlp`)

Develop, deploy, and manage an internal API Gateway directly on a remote server via SSH to bridge communications with internal databases.

## Security & Operational Principles

- **Zero Hardcoded Credentials:** Never store SSH or Database credentials in repository files, persistent configs, or commits. Always prompt the user at runtime.
- **Paramiko Non-Interactive Execution:** Use temporary Python scripts utilizing `paramiko` placed in the scratch directory (`<appDataDir>\brain\<conversation-id>/scratch/`) to execute commands and transfer files without hanging on interactive TTY password prompts. Delete the scratch script immediately after execution.
- **Least-Privilege & PDPA Compliance:** Never log plaintext passwords or unmasked PHI/PII in chat output or terminal logs.

---

## Workflow Steps

### Step 1: Prompt for SSH Credentials
When invoked via `/ssh-thlp`, prompt the user for:
1. **SSH Host / IP**
2. **SSH Port** (default: `22`)
3. **SSH Username**
4. **SSH Password**

Do not proceed without these credentials.

### Step 2: Test Connection & Inspect Environment
1. Write a temporary Python script in `<appDataDir>\brain\<conversation-id>/scratch/ssh_exec.py` that connects using `paramiko`:
   ```python
   import paramiko, sys

   ssh = paramiko.SSHClient()
   ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
   ssh.connect(hostname=HOST, port=PORT, username=USER, password=PASS, timeout=10)
   stdin, stdout, stderr = ssh.exec_command("uname -a && which node python3 php pm2 systemctl 2>/dev/null")
   print(stdout.read().decode())
   ssh.close()
   ```
2. Execute the script via `run_command` wrapped in `cmd.exe /c "python <scratch_path>"`.
3. Verify connection and inspect installed runtimes (e.g., Node.js, Python 3, PHP, Process managers like PM2 or systemd).
4. Remove the temporary script immediately:
   `cmd.exe /c "del <scratch_path>"`

### Step 3: Prompt for Database & API Requirements
Once connected and the remote runtime is confirmed, ask the user:
1. **Database Type:** (e.g., MySQL / HOSxP, PostgreSQL, MSSQL, SQLite)
2. **Database Connection:** Host/IP, Port, DB Name, DB User, DB Password
3. **API Scope:** What endpoints or data payloads are required (e.g., REST endpoints, query filters, data format)

### Step 4: Develop & Upload Gateway Code
1. Write the API code using the runtime best suited for the remote machine (e.g., Express.js, FastAPI, or Slim/PHP):
   - Secure DB credentials in a `.env` file on the remote server with restricted permissions (`chmod 600 .env`).
   - Implement structured error handling, connection pooling, and health check endpoint (`/health`).
2. Transfer code files to the target remote directory using SFTP via a temporary Python paramiko script.
3. Install necessary dependencies on the remote server (e.g., `npm install`, `pip install`, or `composer install`).
4. Delete the temporary upload script from scratch.

### Step 5: Start & Verify Service
1. Start the API Gateway on the remote server (via `pm2`, a `systemd` service, or background daemon process).
2. Execute a verification test on the server (e.g., `curl -i http://127.0.0.1:<PORT>/health` and a sample DB query endpoint).
3. Confirm that responses return expected JSON status and no database connection errors occur.

### Step 6: Handover & Clean Up
1. Ensure all local temporary scratch files containing connection code are deleted.
2. Provide the user with:
   - Gateway status and base URL / Port on the remote machine.
   - List of available API endpoints and request/response examples.
   - Instructions for managing the process (e.g., `pm2 restart <name>` or `systemctl status <service>`).
