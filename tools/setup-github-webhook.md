# GitHub Webhook Setup Guide

## Current Issue Analysis
The webhook is returning 403 Forbidden errors. Based on our troubleshooting:

1. Jenkins endpoint expects proper GitHub webhook headers
2. The webhook should include event type headers
3. Connection issues with Jenkins server (connection reset)

## GitHub Webhook Configuration

### Step 1: Access GitHub Repository Settings
1. Go to your GitHub repository: https://github.com/[username]/code
2. Click on **Settings** tab
3. Click on **Webhooks** in the left sidebar
4. Click **Add webhook** or edit existing webhook

### Step 2: Configure Webhook Settings

**Payload URL:**
```
http://165.232.68.132:8080/github-webhook/
```

**Content type:**
```
application/json
```

**Secret:** (Optional but recommended)
```
[Enter a secret token - this should match Jenkins configuration]
```

**Which events would you like to trigger this webhook?**
- Select "Just the push event" or
- Select "Let me select individual events" and choose:
  - Push
  - Pull requests (optional)
  - Repository (optional)

**Active:**
- ✅ Check this box

### Step 3: Jenkins Configuration Check

1. **Access Jenkins:**
   ```bash
   # Check if Jenkins is running
   curl -I http://165.232.68.132:8080
   
   # If connection fails, restart Jenkins
   sudo systemctl restart jenkins
   ```

2. **Jenkins Global Security Settings:**
   - Go to Jenkins → Manage Jenkins → Configure Global Security
   - Under "CSRF Protection":
     - ✅ Enable proxy compatibility
   - Under "Authorization":
     - Ensure webhook endpoint is accessible

3. **Jenkins Job Configuration:**
   - Go to your job configuration
   - Under "Build Triggers":
     - ✅ GitHub hook trigger for GITScm polling

### Step 4: Test Webhook

After configuration, test the webhook:

```bash
# Test webhook manually
curl -X POST \
  -H "X-GitHub-Event: push" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Delivery: 12345" \
  -d '{
    "ref": "refs/heads/main",
    "repository": {
      "name": "code",
      "full_name": "your-username/code",
      "html_url": "https://github.com/your-username/code"
    },
    "pusher": {
      "name": "your-username"
    }
  }' \
  http://165.232.68.132:8080/github-webhook/
```

### Step 5: Troubleshooting

**If webhook still returns 403:**

1. **Check Jenkins logs:**
   ```bash
   sudo journalctl -u jenkins -f
   ```

2. **Check Jenkins webhook plugin:**
   - Go to Jenkins → Manage Jenkins → Manage Plugins
   - Ensure "GitHub Integration Plugin" is installed

3. **Alternative webhook URL:**
   Try using the generic webhook:
   ```
   http://165.232.68.132:8080/generic-webhook-trigger/invoke
   ```

4. **Check firewall:**
   ```bash
   # Ensure port 8080 is open
   sudo ufw status
   sudo ufw allow 8080
   ```

### Step 6: Security Considerations

If you add a webhook secret:

1. **In GitHub:** Add the secret in webhook configuration
2. **In Jenkins:** 
   - Go to Manage Jenkins → Manage Credentials
   - Add "Secret text" credential with your webhook secret
   - Use this credential in job configuration

## Quick Fix Commands

```bash
# Restart Jenkins if needed
sudo systemctl restart jenkins

# Check Jenkins status
sudo systemctl status jenkins

# Check if Jenkins is listening on port 8080
sudo netstat -tlnp | grep 8080

# Test local Jenkins access
curl -I http://localhost:8080
```

## Expected Webhook Payload

GitHub sends webhooks with this structure:
```json
{
  "ref": "refs/heads/main",
  "before": "commit-hash",
  "after": "commit-hash",
  "repository": {
    "id": 123456,
    "name": "code",
    "full_name": "username/code",
    "html_url": "https://github.com/username/code"
  },
  "pusher": {
    "name": "username",
    "email": "user@email.com"
  },
  "commits": [...]
}
```

The webhook should trigger your Jenkins job automatically when you push to the main branch.
