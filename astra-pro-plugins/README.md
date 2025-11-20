# Astra Pro Plugins Directory

This directory should contain the Astra Pro WordPress plugins for deployment to client sites.

## About Astra Pro

Astra Pro is a premium WordPress theme and plugin suite that provides:
- Advanced customization options
- Performance optimization
- WooCommerce integration
- Custom layouts and headers
- White-label capabilities

**Official Website:** https://wpastra.com/

## Required Files

Place your licensed Astra Pro plugins in this directory:

```
astra-pro-plugins/
├── astra-addon/              # Main Astra Pro addon
│   ├── astra-addon.php
│   └── ...
├── astra-theme/              # Astra Pro theme (if separate)
│   ├── style.css
│   ├── functions.php
│   └── ...
└── README.md                 # This file
```

## Installation Instructions

### 1. Purchase License

Purchase an Astra Pro license from:
https://wpastra.com/pricing/

Recommended: **Growth Bundle** or **Essential Bundle** for agency use

### 2. Download Plugins

1. Log in to your Astra account
2. Navigate to "Downloads" section
3. Download the following:
   - Astra Pro (main addon)
   - Any additional extensions you need

### 3. Extract to This Directory

```bash
# Extract your downloaded plugins here
cd astra-pro-plugins/

# Example: Extract the zip file
unzip astra-addon.zip -d ./

# Verify structure
ls -la
```

### 4. Set Permissions

```bash
# Ensure proper permissions
chmod -R 755 astra-pro-plugins/
```

## Docker Volume Mount

The docker-compose.yml mounts this directory as read-only to all client WordPress containers:

```yaml
volumes:
  - ./astra-pro-plugins:/var/www/html/wp-content/plugins/astra-addons:ro
```

This ensures all clients have access to Astra Pro without duplicating files.

## License Activation

Each client site needs to activate the Astra Pro license:

1. Access WordPress admin: `https://client-domain.com/wp-admin`
2. Navigate to **Appearance → Astra Options**
3. Click on **License** tab
4. Enter your Astra Pro license key
5. Click **Activate License**

### License Management Tips

- **Single License**: Works for 1 site
- **Mini Agency Bundle**: Works for 25 sites
- **Agency Bundle**: Works for unlimited sites

For multi-client hosting, we recommend the **Agency Bundle** for unlimited activations.

## Alternative: Plugin Installation Per Site

If you don't have Astra Pro, you can:

1. **Use Free Astra Theme**: Install from WordPress.org (limited features)
2. **Use Different Theme**: Replace with another theme (Kadence, GeneratePress, etc.)
3. **Manual Install**: Install Astra Pro manually in each container

### Manual Installation

```bash
# For each client container
docker-compose exec client1_wordpress bash

# Inside container
cd /var/www/html/wp-content/plugins/
wget https://downloads.wordpress.org/theme/astra.x.x.x.zip
unzip astra.x.x.x.zip
chown -R www-data:www-data astra/

# Activate via WP-CLI
wp theme activate astra --allow-root
```

## Security Notes

- This directory is in `.gitignore` to prevent committing proprietary plugins
- Never commit licensed plugins to public repositories
- Keep your license keys secure (use `.env` if needed)
- Consider using a private plugin repository for team access

## Troubleshooting

### Plugins Not Showing in WordPress

1. Check file permissions: `ls -la astra-pro-plugins/`
2. Verify volume mount: `docker-compose exec client1_wordpress ls /var/www/html/wp-content/plugins/`
3. Check docker-compose.yml volume configuration
4. Restart containers: `docker-compose restart`

### License Activation Issues

1. Ensure license is valid and not expired
2. Check that site domain matches license
3. Verify internet connectivity from container
4. Contact Brainstorm Force support

## Support

- **Astra Support:** https://wpastra.com/support/
- **Documentation:** https://wpastra.com/docs/
- **ASI 360 Support:** See main README.md

## License

Astra Pro is licensed software. Ensure compliance with Brainstorm Force's license terms.

This placeholder README is part of ASI 360 Agency infrastructure.
