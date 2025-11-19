#!/bin/bash
# ASI 360 Vast.ai Docker Image Builder
# Builds all three Docker images and pushes them to Docker Hub

set -e  # Exit on error

# Configuration
DOCKER_USERNAME="asi360"  # Change this to your Docker Hub username
DROPLET_IP="104.248.69.86"
DROPLET_USER="root"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════"
echo "  ASI 360 Vast.ai Docker Image Builder"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Install from: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${YELLOW}Step 1: Building Docker images...${NC}"
echo ""

# Build video-editor image
echo "Building video-editor image..."
cd video-editor
docker build -t ${DOCKER_USERNAME}/video-editor:latest .
echo -e "${GREEN}✓ video-editor built${NC}"
cd ..

# Build ai-services image
echo ""
echo "Building ai-services image..."
cd ai-services
docker build -t ${DOCKER_USERNAME}/ai-services:latest .
echo -e "${GREEN}✓ ai-services built${NC}"
cd ..

# Build render-farm image
echo ""
echo "Building render-farm image..."
cd render-farm
docker build -t ${DOCKER_USERNAME}/render-farm:latest .
echo -e "${GREEN}✓ render-farm built${NC}"
cd ..

echo ""
echo -e "${YELLOW}Step 2: Testing images locally (optional)...${NC}"
echo ""
echo "You can test images with:"
echo "  docker run --rm ${DOCKER_USERNAME}/video-editor:latest python3 --version"
echo "  docker run --rm ${DOCKER_USERNAME}/ai-services:latest python3 --version"
echo "  docker run --rm ${DOCKER_USERNAME}/render-farm:latest blender --version"
echo ""

read -p "Test images now? (y/n): " TEST_IMAGES
if [ "$TEST_IMAGES" = "y" ]; then
    echo "Testing video-editor..."
    docker run --rm ${DOCKER_USERNAME}/video-editor:latest python3 --version
    echo ""
    echo "Testing ai-services..."
    docker run --rm ${DOCKER_USERNAME}/ai-services:latest python3 --version
    echo ""
    echo "Testing render-farm..."
    docker run --rm ${DOCKER_USERNAME}/render-farm:latest blender --version
    echo ""
    echo -e "${GREEN}✓ All images tested successfully${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Pushing to Docker Hub...${NC}"
echo ""
echo "You need to login to Docker Hub first"
echo "If you don't have an account, create one at: https://hub.docker.com"
echo ""

docker login

echo ""
echo "Pushing video-editor..."
docker push ${DOCKER_USERNAME}/video-editor:latest

echo ""
echo "Pushing ai-services..."
docker push ${DOCKER_USERNAME}/ai-services:latest

echo ""
echo "Pushing render-farm..."
docker push ${DOCKER_USERNAME}/render-farm:latest

echo ""
echo -e "${GREEN}✓ All images pushed to Docker Hub${NC}"

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 Build Complete!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Your Docker images are now available:"
echo "  ${DOCKER_USERNAME}/video-editor:latest"
echo "  ${DOCKER_USERNAME}/ai-services:latest"
echo "  ${DOCKER_USERNAME}/render-farm:latest"
echo ""
echo "Next Steps:"
echo "1. Install vastai CLI:"
echo "   pip install vastai"
echo ""
echo "2. Configure vastai with your API key:"
echo "   vastai set api-key YOUR_API_KEY"
echo "   Get key from: https://cloud.vast.ai/account/"
echo ""
echo "3. Deploy to Vast.ai:"
echo "   cd scripts"
echo "   python3 vastai-deploy.py deploy-video-editor"
echo ""
echo "4. Or run auto-scaling manager on droplet:"
echo "   ssh $DROPLET_USER@$DROPLET_IP"
echo "   cd /root/asi360-agency/vastai-images/scripts"
echo "   python3 autoscale-manager.py"
echo ""
echo "════════════════════════════════════════════════════════"
