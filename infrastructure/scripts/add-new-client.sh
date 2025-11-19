#!/bin/bash
# ASI 360 - Add New Client Script
# Automatically adds a new WordPress site to the multi-client platform

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: ./add-new-client.sh <client-name> <domain>"
    echo "Example: ./add-new-client.sh acme acme.com"
    exit 1
fi

CLIENT_NAME=$1
DOMAIN=$2

echo "🎨 ASI 360 - Adding New Client"
echo "================================"
echo "Client Name: $CLIENT_NAME"
echo "Domain: $DOMAIN"
echo ""

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32)
ROOT_PASSWORD=$(openssl rand -base64 32)

echo "Step 1: Adding to docker-compose.yml..."

# Create new service block
cat << EOF >> docker-compose.yml

  # Client: $CLIENT_NAME
  ${CLIENT_NAME}_wordpress:
    image: wordpress:latest
    container_name: asi360_${CLIENT_NAME}_wp
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: ${CLIENT_NAME}_mysql
      WORDPRESS_DB_NAME: ${CLIENT_NAME}_db
      WORDPRESS_DB_USER: ${CLIENT_NAME}_user
      WORDPRESS_DB_PASSWORD: \${${CLIENT_NAME^^}_DB_PASSWORD}
    volumes:
      - ${CLIENT_NAME}_wp_data:/var/www/html
      - ./astra-pro-plugins:/var/www/html/wp-content/plugins/astra-addons:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${CLIENT_NAME}.rule=Host(\`$DOMAIN\`) || Host(\`www.$DOMAIN\`)"
      - "traefik.http.routers.${CLIENT_NAME}.entrypoints=websecure"
      - "traefik.http.routers.${CLIENT_NAME}.tls.certresolver=letsencrypt"
    depends_on:
      - ${CLIENT_NAME}_mysql
    networks:
      - asi360_network

  ${CLIENT_NAME}_mysql:
    image: mysql:8.0
    container_name: asi360_${CLIENT_NAME}_db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${CLIENT_NAME}_db
      MYSQL_USER: ${CLIENT_NAME}_user
      MYSQL_PASSWORD: \${${CLIENT_NAME^^}_DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${${CLIENT_NAME^^}_ROOT_PASSWORD}
    volumes:
      - ${CLIENT_NAME}_mysql_data:/var/lib/mysql
    networks:
      - asi360_network
EOF

# Add volumes
sed -i.bak "/^volumes:/a\\
  ${CLIENT_NAME}_wp_data:\\
  ${CLIENT_NAME}_mysql_data:" docker-compose.yml

echo "✓ docker-compose.yml updated"

echo "Step 2: Adding credentials to .env..."

cat << EOF >> .env

# Client: $CLIENT_NAME ($DOMAIN)
${CLIENT_NAME^^}_DB_PASSWORD=$DB_PASSWORD
${CLIENT_NAME^^}_ROOT_PASSWORD=$ROOT_PASSWORD
EOF

echo "✓ .env updated"

echo "Step 3: Creating client configuration..."

mkdir -p client-configs/$CLIENT_NAME

cat << EOF > client-configs/$CLIENT_NAME/config.json
{
  "client_name": "$CLIENT_NAME",
  "domain": "$DOMAIN",
  "wordpress_url": "https://$DOMAIN",
  "admin_email": "admin@$DOMAIN",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "astra_features": [
    "Spectra Pro",
    "Ultimate Elementor Addons",
    "AI Website Builder",
    "SureFeedback"
  ],
  "backup_enabled": true,
  "monitoring_enabled": true
}
EOF

echo "✓ Client configuration created"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Client Added Successfully!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Client: $CLIENT_NAME"
echo "Domain: $DOMAIN"
echo ""
echo "Next Steps:"
echo ""
echo "1. Point DNS A record to your droplet IP:"
echo "   $DOMAIN → YOUR_DROPLET_IP"
echo "   www.$DOMAIN → YOUR_DROPLET_IP"
echo ""
echo "2. Deploy to droplet:"
echo "   docker-compose up -d"
echo ""
echo "3. Wait 5-10 minutes for:"
echo "   - DNS propagation"
echo "   - SSL certificate generation"
echo "   - WordPress installation"
echo ""
echo "4. Access WordPress admin:"
echo "   https://$DOMAIN/wp-admin"
echo "   Username: admin"
echo "   Password: (check container logs)"
echo ""
echo "5. Install Astra Pro:"
echo "   - Theme: Astra"
echo "   - Plugins: Spectra Pro, Ultimate Elementor Addons"
echo "   - Activate with your license key"
echo ""
echo "Credentials saved in:"
echo "   .env (database passwords)"
echo "   client-configs/$CLIENT_NAME/config.json"
echo ""
echo "═══════════════════════════════════════════════════════════"
