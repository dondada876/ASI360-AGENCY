#!/bin/bash
# VNC startup script for ASI 360 desktop editor

# Set VNC password
mkdir -p /root/.vnc
echo "$VNC_PASSWORD" | vncpasswd -f > /root/.vnc/passwd
chmod 600 /root/.vnc/passwd

# Start VNC server
vncserver :0 -geometry $RESOLUTION -depth 24

# Keep container running
tail -f /root/.vnc/*.log
