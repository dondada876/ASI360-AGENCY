# ASI 360 Desktop Video Editor (Remote Workstation)

**Interactive GPU workstation** with full Linux desktop for remote video editing, 3D modeling, and graphic design.

## What's Included

### Desktop Environment
- **XFCE4** - Lightweight, responsive desktop
- **VNC Server** - Traditional remote desktop (port 5900)
- **noVNC** - Browser-based access (port 6080) - NO CLIENT SOFTWARE NEEDED
- **Parsec** - Ultra-low latency gaming-grade remote desktop

### Video Editing Tools
- **Kdenlive** - Professional video editor (like Adobe Premiere)
- **FFmpeg** - Command-line video processing
- **Blender** - 3D modeling & animation
- **OBS Studio** - Screen recording & streaming

### Design Tools
- **GIMP** - Image editing (like Photoshop)
- **Inkscape** - Vector graphics (like Illustrator)
- **Audacity** - Audio editing

### Utilities
- **Firefox** - Web browser
- **VLC** - Media player
- **rclone** - Cloud storage mounting (Google Drive, Dropbox, S3)
- **Python 3** - Scripting & automation

## Use Cases

### 1. Video Editing for Client Projects
- Edit 4K video with GPU acceleration
- Export in multiple formats
- Apply effects and transitions
- Only pay for the hours you're actively editing

### 2. 3D Modeling & Animation
- Create product visualizations
- Render animations
- Export for web/video

### 3. Graphic Design
- Create marketing materials
- Edit photos for client websites
- Design logos and graphics

### 4. Live Streaming / Recording
- Record tutorials
- Stream to YouTube/Twitch
- Screen recording for demos

## Connection Methods

### Method 1: noVNC (Browser-Based) - EASIEST

**No software installation needed!** Just open a web browser.

```bash
# Deploy instance
python3 vastai-deploy.py deploy-desktop-editor

# Get instance IP
vastai show instances

# Open in browser
http://INSTANCE_IP:6080
```

**Default VNC Password**: `asi360secure` (change this!)

**Pros:**
- Works on any device (Mac, Windows, iPad, Chromebook)
- No software installation
- Works through firewalls

**Cons:**
- Lower performance than native clients
- ~100ms latency
- Best for casual editing

### Method 2: VNC Client - BETTER PERFORMANCE

Use any VNC client (RealVNC, TightVNC, etc.)

```bash
# macOS (built-in Screen Sharing)
open vnc://INSTANCE_IP:5900

# Windows (download TightVNC or RealVNC)
# Connect to: INSTANCE_IP:5900
# Password: asi360secure
```

**Pros:**
- Better performance than browser
- ~50ms latency
- Native copy/paste

**Cons:**
- Requires VNC client software
- Still some compression artifacts

### Method 3: Parsec - BEST FOR EDITING

**Ultra-low latency** gaming-grade remote desktop (15-30ms).

```bash
# 1. Create free Parsec account: https://parsec.app

# 2. SSH into Vast.ai instance
ssh root@INSTANCE_IP

# 3. Start Parsec (will open login page)
parsec

# 4. Login with your Parsec account

# 5. On your Mac/Windows, install Parsec client
# 6. Connect to the instance from Parsec app
```

**Pros:**
- Best performance (feels almost local)
- GPU-accelerated streaming
- Perfect for 4K editing
- Works over slow connections

**Cons:**
- Requires account + client software
- Some free tier limitations

## Quick Start Guide

### Step 1: Deploy Instance

```bash
cd /Users/dbucknor/Projects/asi360-agency/vastai-images/scripts

# Find cheap GPU with enough RAM
python3 vastai-deploy.py search --gpu-ram 16 --max-price 0.60

# Deploy desktop editor
python3 vastai-deploy.py deploy-desktop-editor
```

### Step 2: Get Instance IP & Port

```bash
vastai show instances

# Output example:
# ID    IP              STATUS
# 1234  203.0.113.45    running
```

### Step 3: Connect

**Option A - Browser (Easiest):**
```
http://203.0.113.45:6080
```

**Option B - VNC Client (Better):**
```
vnc://203.0.113.45:5900
Password: asi360secure
```

**Option C - Parsec (Best):**
1. SSH to instance: `ssh root@203.0.113.45`
2. Run: `parsec`
3. Login with Parsec account
4. Connect from Parsec app on your Mac/Windows

### Step 4: Mount Your Cloud Storage

Once connected to the desktop:

```bash
# Open Terminal in XFCE

# Configure Google Drive
rclone config

# Mount Google Drive to /storage
rclone mount gdrive: /storage --daemon

# Now your files appear in /storage folder!
```

### Step 5: Start Editing

- Open **Kdenlive** from Applications menu
- Load video from `/storage`
- Edit with GPU acceleration
- Export back to `/storage`
- Files sync to Google Drive automatically

### Step 6: Destroy When Done

**IMPORTANT**: Don't forget to destroy the instance when done to stop charges!

```bash
python3 vastai-deploy.py destroy 1234
```

## Cost Comparison

### Traditional Workstation
- **Mac Studio Max**: $3,999 upfront + depreciation
- **Windows Workstation**: $2,500-5,000
- **Monthly equivalent**: ~$100/mo (36-month life)

### Vast.ai Desktop Editor
- **GPU-accelerated workstation**: $0.50-0.70/hr
- **Edit 20 hours/month**: $10-14/mo
- **Edit 40 hours/month**: $20-28/mo
- **Savings**: **70-90% vs. buying workstation**

### Real Example: Client Website Video Production

**Scenario**: Edit 10 videos per month, 2 hours each

**Traditional Workstation:**
```
$3,999 Mac Studio ÷ 36 months = $111/mo
Plus electricity, maintenance
Total: ~$125/mo
```

**Vast.ai Desktop Editor:**
```
20 hours × $0.60/hr = $12/mo
Savings: $113/mo ($1,356/year)
```

## Advanced: Install DaVinci Resolve (Optional)

DaVinci Resolve is like Adobe Premiere Pro but free.

```bash
# SSH to instance
ssh root@INSTANCE_IP

# Download DaVinci Resolve
wget https://sw.blackmagicdesign.com/DaVinciResolve/v18.6.6/DaVinci_Resolve_18.6.6_Linux.zip

# Extract and install
unzip DaVinci_Resolve_18.6.6_Linux.zip
chmod +x DaVinci_Resolve_18.6.6_Linux.run
./DaVinci_Resolve_18.6.6_Linux.run

# Launch from desktop or terminal
/opt/resolve/bin/resolve
```

## Security Considerations

### Change Default VNC Password

```bash
# SSH to instance
ssh root@INSTANCE_IP

# Change password
vncpasswd
# Enter new password twice

# Restart VNC
pkill Xvnc
supervisorctl restart vnc
```

### Firewall (Vast.ai handles this)

Vast.ai automatically configures firewall to only allow:
- VNC port 5900
- noVNC port 6080
- SSH port 22

### Data Security

- Always use cloud storage (Google Drive, Dropbox) - **never** store sensitive files on instance
- Instances are ephemeral - destroyed after use
- Use rclone with encryption for sensitive projects

## Troubleshooting

### Can't Connect to noVNC

**Check instance is running:**
```bash
vastai show instances
# Should show "running"
```

**Check ports are exposed:**
```bash
ssh root@INSTANCE_IP
netstat -tuln | grep 6080
# Should show: 0.0.0.0:6080
```

### Desktop is Slow/Laggy

**Try lower resolution:**
```bash
# Edit /usr/local/bin/vnc-startup.sh
RESOLUTION=1280x720  # Instead of 1920x1080
```

**Use Parsec instead** for much better performance.

### Parsec Won't Connect

**Enable Parsec service:**
```bash
ssh root@INSTANCE_IP
systemctl start parsecgdd
systemctl enable parsecgdd
```

### Files Not Syncing to Google Drive

**Check rclone mount:**
```bash
# In instance terminal
mount | grep rclone
# Should show: gdrive: on /storage

# If not mounted, remount
rclone mount gdrive: /storage --daemon --vfs-cache-mode writes
```

## Performance Tips

### 1. Choose Right GPU

**Light editing (1080p):**
- GTX 1080 Ti (11GB) - $0.25-0.35/hr
- RTX 3060 (12GB) - $0.30-0.40/hr

**Heavy editing (4K):**
- RTX 3090 (24GB) - $0.45-0.55/hr
- RTX 4090 (24GB) - $0.60-0.80/hr

### 2. Use Parsec for Best Experience

Parsec uses GPU-accelerated H.265 encoding for ultra-low latency.

### 3. Proxy Editing for 4K

Edit with 1080p proxies, export in 4K to save time.

### 4. Pre-download Large Assets

Download stock footage/music to instance first, then edit locally.

## Workflow Example: Client Website Video

**Total time: 3 hours**
**Cost: $1.80 (at $0.60/hr)**

```
1. Deploy instance (2 min)
   python3 vastai-deploy.py deploy-desktop-editor

2. Connect via Parsec (1 min)

3. Mount Google Drive (1 min)
   rclone mount gdrive: /storage --daemon

4. Open Kdenlive, load project (1 min)

5. Edit video (2.5 hours)
   - GPU-accelerated effects
   - Real-time preview
   - No rendering lag

6. Export to Google Drive (15 min)
   - H.264 @ 1080p
   - Auto-uploads to Drive

7. Destroy instance (1 min)
   python3 vastai-deploy.py destroy INSTANCE_ID
```

**Result**: Professional video edited for $1.80 vs. $3,999 workstation.

## Comparison to Other Solutions

| Solution | Cost/Month | Pros | Cons |
|----------|-----------|------|------|
| **Mac Studio** | $111 | Local, always available | Huge upfront cost, depreciates |
| **Adobe Cloud** | $55 | Integrated, reliable | Subscription forever, no GPU |
| **AWS WorkSpaces** | $75+ | Managed, secure | Expensive, Windows-only |
| **Vast.ai Desktop** | $12-30 | Cheap, scalable | Pay-per-use, requires setup |

## Next Steps

1. **Deploy your first desktop instance** - Try editing for 1 hour ($0.60)
2. **Install Parsec** - Get gaming-grade performance
3. **Mount Google Drive** - Seamless file access
4. **Edit a client video** - Test the workflow
5. **Automate with deploy script** - Save instance configs

## Reference

- **Parsec**: https://parsec.app
- **Kdenlive Docs**: https://docs.kdenlive.org
- **Blender Manual**: https://docs.blender.org
- **rclone Guide**: https://rclone.org/drive

---

**Built for ASI 360 Agency** - Professional video editing without the professional price tag.
