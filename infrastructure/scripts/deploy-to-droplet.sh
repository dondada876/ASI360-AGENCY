#!/bin/bash
# ASI 360 Agency Deployment Script
# Deploys multi-client WordPress hosting to Digital Ocean droplet

set -e  # Exit on error

echo "🚀 ASI 360 Agency Deployment Starting..."
echo ""

# Configuration
DROPLET_IP="104.248.69.86"  # ASI360-Agency droplet
DROPLET_USER="root"
SSH_KEY_PATH="~/.ssh/id_rsa"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Copy .env.example to .env and fill in your credentials"
    exit 1
fi

# Check if Docker Compose file exists
if [ ! -f docker-compose.yml ]; then
    echo "❌ docker-compose.yml not found!"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Creating new Digital Ocean droplet...${NC}"
echo "   Go to: https://cloud.digitalocean.com/droplets/new"
echo "   Recommended specs:"
echo "   - Image: Docker (One-click Apps)"
echo "   - Size: $48/mo (8GB RAM, 4 vCPUs) - can host 10-15 client sites"
echo "   - Datacenter: Choose closest to your clients"
echo ""
read -p "Have you created the droplet? (yes/no): " DROPLET_CREATED

if [ "$DROPLET_CREATED" != "yes" ]; then
    echo "Please create the droplet first, then run this script again"
    exit 0
fi

read -p "Enter your new droplet IP address: " DROPLET_IP

echo -e "${GREEN}✓ Droplet IP set to: $DROPLET_IP${NC}"
echo ""

echo -e "${YELLOW}Step 3: Configuring droplet...${NC}"

# Copy files to droplet
echo "   Copying project files..."
ssh -i $SSH_KEY_PATH $DROPLET_USER@$DROPLET_IP "mkdir -p /root/asi360-agency"

rsync -avz -e "ssh -i $SSH_KEY_PATH" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '*.log' \
    ./ $DROPLET_USER@$DROPLET_IP:/root/asi360-agency/

echo -e "${GREEN}✓ Files copied to droplet${NC}"
echo ""

echo -e "${YELLOW}Step 4: Installing Docker (if not already installed)...${NC}"

ssh -i $SSH_KEY_PATH $DROPLET_USER@$DROPLET_IP << 'ENDSSH'
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        echo "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    echo "Docker version:"
    docker --version
    echo "Docker Compose version:"
    docker-compose --version
ENDSSH

echo -e "${GREEN}✓ Docker installed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Starting services...${NC}"

ssh -i $SSH_KEY_PATH $DROPLET_USER@$DROPLET_IP << 'ENDSSH'
    cd /root/asi360-agency

    # Pull images
    echo "Pulling Docker images..."
    docker-compose pull

    # Start services
    echo "Starting services..."
    docker-compose up -d

    # Wait for services to start
    echo "Waiting for services to start..."
    sleep 10

    # Show status
    echo ""
    echo "Service status:"
    docker-compose ps
ENDSSH

echo -e "${GREEN}✓ Services started${NC}"
echo ""

echo -e "${YELLOW}Step 6: Configuring firewall...${NC}"

ssh -i $SSH_KEY_PATH $DROPLET_USER@$DROPLET_IP << 'ENDSSH'
    # Allow HTTP, HTTPS, SSH
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    echo "Firewall status:"
    ufw status
ENDSSH

echo -e "${GREEN}✓ Firewall configured${NC}"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Your ASI 360 agency platform is now running at:"
echo ""
echo "   🌐 Traefik Dashboard:  http://$DROPLET_IP:8080"
echo "   📊 Agency Portal:      https://portal.asi360.com"
echo "   📈 Monitoring:         https://monitor.asi360.com"
echo ""
echo "Client Sites:"
echo "   🏢 Client 1:           https://client1.asi360.com"
echo "   🌊 JCCIX Relief:       https://jccix.org"
echo ""
echo "Next Steps:"
echo "   1. Point your domains to droplet IP: $DROPLET_IP"
echo "   2. Wait for DNS propagation (5-30 minutes)"
echo "   3. Access WordPress admin at: https://your-domain.com/wp-admin"
echo "   4. Install Astra Pro theme + plugins"
echo ""
echo "Useful Commands:"
echo "   ssh $DROPLET_USER@$DROPLET_IP"
echo "   cd /root/asi360-agency"
echo "   docker-compose logs -f"
echo "   docker-compose ps"
echo "   docker-compose restart"
echo ""
echo "═══════════════════════════════════════════════════════════"
