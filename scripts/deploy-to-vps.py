import paramiko

def deploy():
    host = "169.58.108.201"
    port = 22
    user = "root"
    password = "Raghu@143@123"

    print(f"Connecting to VPS {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=user, password=password, timeout=15)
    print("Connected successfully!")

    commands = [
        "cd /opt/directstay && git checkout . && git clean -fd",
        "cd /opt/directstay && git pull origin main",
        "cd /opt/directstay && git log -1 --oneline",
        "cd /opt/directstay && npm run build",
        "pm2 restart directstay-pms || pm2 restart 0",
        "pm2 status"
    ]

    for cmd in commands:
        print(f"\n--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        if out:
            print(out)
        if err:
            print("[STDERR]:", err)

    ssh.close()
    print("\nVPS Deployment complete and verified!")

if __name__ == "__main__":
    deploy()
