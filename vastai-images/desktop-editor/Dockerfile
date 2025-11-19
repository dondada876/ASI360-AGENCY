# ASI 360 Desktop Video Editor for Vast.ai
# Full desktop environment with DaVinci Resolve, Premiere-like tools, VNC + Parsec
# Based on Ubuntu with XFCE desktop

FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install desktop environment and VNC
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-goodies \
    tightvncserver \
    novnc \
    websockify \
    supervisor \
    dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

# Install video editing tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    kdenlive \
    blender \
    gimp \
    inkscape \
    audacity \
    vlc \
    obs-studio \
    && rm -rf /var/lib/apt/lists/*

# Install Python and utilities
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    wget \
    curl \
    git \
    nano \
    vim \
    firefox \
    && rm -rf /var/lib/apt/lists/*

# Install Parsec for ultra-low latency remote desktop
RUN wget https://builds.parsec.app/package/parsec-linux.deb && \
    dpkg -i parsec-linux.deb || apt-get install -f -y && \
    rm parsec-linux.deb

# Install rclone for cloud storage
RUN curl https://rclone.org/install.sh | bash

# Install Python packages
RUN pip3 install --no-cache-dir \
    supabase \
    requests \
    python-dotenv

# Setup VNC
RUN mkdir -p /root/.vnc
COPY vnc-startup.sh /usr/local/bin/
COPY xstartup /root/.vnc/
RUN chmod +x /usr/local/bin/vnc-startup.sh
RUN chmod +x /root/.vnc/xstartup

# Create workspace directories
RUN mkdir -p /workspace /storage /projects /renders

# Expose VNC and noVNC ports
EXPOSE 5900 6080

# Environment variables
ENV DISPLAY=:0
ENV VNC_PASSWORD=asi360secure
ENV RESOLUTION=1920x1080

# Supervisor configuration for running multiple services
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Default command: start supervisor (VNC, noVNC, desktop)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
