# Deployment Guide: Seentics Analytics on AWS EC2

This guide will help you set up an AWS EC2 instance to host your application using Docker and configure automatic deployment via GitHub Actions.

## Prerequisites
- An AWS Account
- A GitHub Repository for this project
- Domain name (optional but recommended for SSL/production)

## Step 1: Launch AWS EC2 Instance

1.  **Login to AWS Console** and go to **EC2 Dashboard**.
2.  **Launch Instance**:
    *   **Name**: Seentics Analytics
    *   **AMI**: Amazon Linux 2023 or Ubuntu 22.04 LTS (Ubuntu is recommended for easier Docker setup).
    *   **Instance Type**: `t3.medium` (4GB RAM is sufficient for this stack).
    *   **Key Pair**: Create a new key pair (e.g., `seentics-key`), download the `.pem` file, and keep it safe.
    *   **Network Settings**: Allow SSH traffic from anywhere (0.0.0.0/0) or just your IP. Allow HTTP (80) and HTTPS (443). Also open ports `3000` (Frontend) and `3002` (Backend) in the Security Group if you aren't using a reverse proxy yet. For production, it's best to use a reverse proxy (Nginx) to route 80/443 to your containers, but for now opening ports works.
        *   Security Group Inbound Rules:
            *   SSH (22)
            *   HTTP (80)
            *   HTTPS (443)
3.  **Launch** the instance.

## Step 2: Install Docker on EC2

ssh into your instance:
```bash
chmod 400 path/to/seentics-key.pem
ssh -i path/to/seentics-key.pem ubuntu@<your-ec2-public-ip>
```

Run the following commands to install Docker and Docker Compose (for Ubuntu):

```bash
# Update packages
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow 'ubuntu' user to run docker commands without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker compose version
```

## Step 3: Setup Project on EC2

1.  **Generate SSH Key for GitHub**:
    Inside your EC2 instance:
    ```bash
    ssh-keygen -t ed25519 -C "deploy@seentics"
    # Press Enter for default location and no passphrase
    cat ~/.ssh/id_ed25519.pub
    ```
2.  **Add Key to GitHub**:
    *   Go to your GitHub Repo -> **Settings** -> **Deploy Keys** -> **Add deploy key**.
    *   Title: "AWS EC2"
    *   Paste the key from the previous step.
    *   **CHECK "Allow write access" is NOT needed (read-only is fine), but uncheck it.**
3.  **Clone the Repository**:
    ```bash
    cd ~
    git clone git@github.com:skshohagmiah/seentics-analytics.git
    # Use your actual repo URL
    ```
    *Note: If `git clone` fails with permission denied, make sure you added the Deploy Key correctly.*

## Step 4: Configure GitHub Secrets

Go to your GitHub Repo -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**. Add the following:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `EC2_HOST` | `<your-ec2-public-ip>` | The Public IP of your EC2 instance. |
| `EC2_USER` | `ubuntu` | The user you use to SSH (usually `ubuntu` or `ec2-user`). |
| `EC2_SSH_KEY` | Content of your `.pem` file | The private key you downloaded when creating the EC2 instance. Paste the ENTIRE content including `-----BEGIN RSA PRIVATE KEY-----`. |
| `POSTGRES_USER` | `seentics` | Database username. |
| `POSTGRES_PASSWORD` | `<secure-password>` | Generate a strong password. |
| `POSTGRES_DB` | `seentics_analytics` | Database name. |
| `JWT_SECRET` | `<secure-random-string>` | Secret for JWT tokens. |
| `REDIS_PASSWORD` | `<secure-password>` | Password for Redis. |
| `GLOBAL_API_KEY` | `<secure-random-string>` | API Key for internal services. |
| `NEXT_PUBLIC_API_URL` | `http://<your-ec2-public-ip>:3002` | **Important**: Use your EC2 IP or Domain. This is baked into the frontend build. |

## Step 5: Setup SSL (First Time Only)

1.  **Point your Domain**: Ensure `api.seentics.com` points to your EC2 IP address in your DNS provider (e.g., Godaddy, Namecheap, Cloudflare).
2.  **SSH into EC2**:
    ```bash
    ssh -i path/to/seentics-key.pem ubuntu@<your-ec2-public-ip>
    cd ~/seentics-analytics
    ```
3.  **Run Initialization Script**:
    ```bash
    sudo ./init-letsencrypt.sh
    ```
    This script will:
    *   Generate self-signed certificates to let Nginx start.
    *   Start Nginx.
    *   Request real certificates from Let's Encrypt for `api.seentics.com`.
    *   Reload Nginx with the new valid certificates.

## Step 6: Configure Frontend on Vercel

1.  Go to your project on **Vercel**.
2.  Navigate to **Settings** -> **Environment Variables**.
3.  Add or Update `NEXT_PUBLIC_API_URL`:
    *   Key: `NEXT_PUBLIC_API_URL`
    *   Value: `https://api.seentics.com`
4.  **Redeploy** your frontend on Vercel for the changes to take effect.

## Step 7: Automated Deployment

1.  Push your changes (including the new `.github/workflows/deploy.yml` and `docker-compose.yml` updates) to the `main` branch.
2.  Go to the **Actions** tab in GitHub to see the deployment running.
3.  Once finished, your backend will be live at `https://api.seentics.com`.

## Troubleshooting

### 1. "Database does not exist" Error
If you see logs like `FATAL: database "seentics_analytics" does not exist`, it means the Postgres volume was created before the correct configuration was applied. To fix this (WARNING: This deletes all data):

```bash
# Stop containers and remove volumes
docker compose down -v

# Restart containers
docker compose up -d --build
```

### 2. "Network Error" or Timeout on Frontend
If `api.seentics.com` times out:
1.  **Check Security Groups**: Ensure your AWS Security Group allows Inbound traffic on ports **80** and **443** from `0.0.0.0/0`.
2.  **Check Nginx Status**:
    ```bash
    docker compose logs nginx
    ```
    If Nginx isn't running, your SSL certificates might be missing. Run `./init-letsencrypt.sh` again.

### 3. "No such service: nginx/certbot"
If you see this error, your `docker-compose.yml` is outdated. Pull the latest code:
```bash
git pull origin main
```

## Logs & Monitoring

- **Logs**:
    ```bash
    # On EC2
    cd ~/seentics-analytics
    docker compose logs -f
    ```
- **Resources**:
    ```bash
    docker stats
    ```
