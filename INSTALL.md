# Crew Upload Platform - Synology NAS Installation Guide

This guide walks you through deploying the Crew Upload Platform on your Synology RS1221+ NAS.

## Prerequisites

- Synology DSM 7.3.2 or later
- Container Manager (Docker) installed from Package Center
- SSH access enabled (Control Panel > Terminal & SNMP > Enable SSH)
- Domain `upload.turbo.net.au` pointing to your NAS public IP

---

## Step 1: Prepare Directories

SSH into your NAS or use File Station to create the required folders:

```bash
# SSH into NAS
ssh admin@your-nas-ip

# Create upload storage folder
sudo mkdir -p /volume1/CrewUploads
sudo chown 1000:1000 /volume1/CrewUploads

# Create container data folder
sudo mkdir -p /volume1/docker/crew-upload/data
sudo chown 1000:1000 /volume1/docker/crew-upload/data
```

---

## Step 2: Upload Project Files

Transfer the entire `crew-upload` folder to your NAS:

**Option A - Using File Station:**
1. Open File Station
2. Navigate to `/docker/`
3. Upload the `crew-upload` folder

**Option B - Using SCP:**
```bash
scp -r ./crew-upload admin@your-nas-ip:/volume1/docker/
```

---

## Step 3: Generate JWT Secret

Generate a secure random string for JWT signing:

```bash
# On your NAS via SSH, or locally:
openssl rand -hex 32
```

Copy this value - you'll need it in Step 4.
***REDACTED_JWT_SECRET***

---

## Step 4: Configure Environment

Edit the docker-compose.yml to set your JWT secret:

```bash
cd /volume1/docker/crew-upload
nano docker-compose.yml
```

Replace `${JWT_SECRET:-change-this-to-a-secure-random-string}` with:
```yaml
- JWT_SECRET=your-generated-secret-from-step-3
```

Save and exit (Ctrl+X, Y, Enter).

---

## Step 5: Build and Start Container

```bash
cd /volume1/docker/crew-upload

# Build the container (this takes a few minutes)
sudo docker-compose build

# Start the container
sudo docker-compose up -d

# Verify it's running
sudo docker-compose ps

# Check logs
sudo docker-compose logs -f
```

You should see: `Server running on port 3000`

---

## Step 6: Configure Reverse Proxy

1. Open **DSM > Control Panel > Login Portal > Advanced**
2. Click **Reverse Proxy**
3. Click **Create**

Configure as follows:

| Field | Value |
|-------|-------|
| Description | Crew Upload Portal |
| **Source** | |
| Protocol | HTTPS |
| Hostname | upload.turbo.net.au |
| Port | 443 |
| **Destination** | |
| Protocol | HTTP |
| Hostname | localhost |
| Port | 3847 |

4. Click **Custom Header** tab, add:
   - `X-Forwarded-Proto` = `https`
   - `X-Real-IP` = `$remote_addr`

5. Click **Advanced Settings**:
   - Proxy timeout (connect/read/send): `86400` seconds (24 hours)

6. Click **Save**

---

## Step 7: SSL Certificate

1. Open **DSM > Control Panel > Security > Certificate**
2. Click **Add**
3. Select **Add a new certificate**
4. Select **Get a certificate from Let's Encrypt**
5. Enter:
   - Domain: `upload.turbo.net.au`
   - Email: your email for certificate notifications
6. Click **Apply**

After certificate is issued:
1. Click **Settings**
2. Find the `upload.turbo.net.au` reverse proxy entry
3. Assign your new Let's Encrypt certificate
4. Click **OK**

---

## Step 8: Configure Postmark (Email)

1. Log in to [Postmark](https://postmarkapp.com)
2. Go to **Sender Signatures**
3. Add `noreply@turbo360.com.au` as a sender
4. Verify your domain if not already done
5. The API key is already in your docker-compose.yml

---

## Step 9: Test the Installation

1. Open `https://upload.turbo.net.au` in your browser
2. Login with password: `tcrew26`
3. Create a test session
4. Upload a small file
5. Verify:
   - File appears in `/volume1/CrewUploads/[Project]/[Crew]/[Date]/`
   - Email notification is received

---

## Maintenance Commands

```bash
# View logs
sudo docker-compose logs -f crew-upload

# Restart container
sudo docker-compose restart

# Stop container
sudo docker-compose down

# Update and rebuild
cd /volume1/docker/crew-upload
git pull  # if using git
sudo docker-compose build
sudo docker-compose up -d

# Check disk space
df -h /volume1/CrewUploads
```

---

## Backup Configuration

Add to Hyper Backup:
- `/volume1/docker/crew-upload/data/` (database and logs)

Upload files (`/volume1/CrewUploads/`) should be backed up according to your media backup strategy.

---

## Troubleshooting

### Container won't start
```bash
# Check logs
sudo docker-compose logs crew-upload

# Check if port is in use
sudo netstat -tlnp | grep 3847
```

### Upload fails
- Check reverse proxy timeout is set to 86400
- Ensure max body size is unlimited in reverse proxy
- Check container logs for errors

### SSL certificate issues
- Ensure port 80 is open for Let's Encrypt verification
- Check DNS is correctly pointing to NAS

### Permission denied on uploads
```bash
sudo chown -R 1000:1000 /volume1/CrewUploads
sudo chmod -R 755 /volume1/CrewUploads
```

---

## Security Notes

- The upload password (`tcrew26`) is intended for authorized crew only
- Consider changing it periodically
- All uploads are logged in the SQLite database
- Failed login attempts are rate-limited (10 per hour per IP)

---

## Support

For technical issues:
- Check container logs first
- Contact: hello@turbo360.com.au
