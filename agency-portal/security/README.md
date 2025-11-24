# Agency Portal - Security Module

**Modular security layer that can be enabled incrementally without affecting existing code.**

## 🔒 Security Features

### 1. **Authentication** (JWT-based)
- User registration and login
- Token-based authentication
- Refresh token support
- Password hashing with bcrypt

### 2. **Input Validation**
- Request body validation
- XSS protection
- SQL injection prevention
- Email/domain validation

### 3. **Rate Limiting**
- Per-IP rate limiting
- Per-user rate limiting
- Configurable limits per endpoint

### 4. **CORS Protection**
- Whitelist specific origins
- Credential handling
- Method restrictions

### 5. **Security Headers**
- Helmet.js integration
- CSP headers
- XSS protection headers

---

## 📦 Installation

```bash
cd agency-portal

# Install security dependencies
npm install jsonwebtoken bcryptjs express-validator express-rate-limit helmet cors dotenv
npm install --save-dev @types/jsonwebtoken @types/bcryptjs
```

---

## ⚙️ Configuration

### 1. Enable Security Features in `.env`

```bash
# Add to agency-portal/.env or root .env

# Security Feature Flags (set to 'true' to enable)
ENABLE_AUTHENTICATION=false
ENABLE_RATE_LIMITING=false
ENABLE_INPUT_VALIDATION=false
ENABLE_CORS_PROTECTION=false
ENABLE_SECURITY_HEADERS=false

# JWT Configuration (if authentication enabled)
JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
ALLOWED_ORIGINS=https://portal.asi360.com,https://monitor.asi360.com

# Admin User (first user to create)
ADMIN_EMAIL=admin@asi360.com
ADMIN_PASSWORD=ChangeThisPassword123!
```

### 2. Generate JWT Secrets

```bash
# Generate strong JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Add these to your .env file
```

---

## 🚀 Usage

### Quick Start - Enable All Security

```javascript
// In server.js, add at the top:
const security = require('./security');

// After initializing express app:
app.use(security.initialize(app));
```

### Gradual Adoption - Enable Features Individually

```javascript
const security = require('./security');

// Enable only specific features
app.use(security.middleware.helmet());           // Security headers
app.use(security.middleware.cors());             // CORS protection
app.use('/api/', security.middleware.rateLimit()); // Rate limiting

// Protect specific routes with authentication
app.post('/api/clients',
  security.middleware.authenticate(),  // Require auth
  security.validators.client,          // Validate input
  async (req, res) => {
    // Your existing code
  }
);
```

---

## 🔐 Authentication Usage

### 1. Register Admin User (First Time)

```bash
# Run the setup script to create admin user
node security/scripts/setup-admin.js
```

### 2. Login and Get Token

```bash
# Login request
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@asi360.com",
    "password": "ChangeThisPassword123!"
  }'

# Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@asi360.com",
    "role": "admin"
  }
}
```

### 3. Use Token in Requests

```bash
# Include token in Authorization header
curl -X GET http://localhost:3000/api/clients \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Refresh Token

```bash
# When token expires, use refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## 📝 API Endpoints

### Authentication Endpoints

```
POST   /api/auth/register    - Register new user (admin only)
POST   /api/auth/login       - Login and get tokens
POST   /api/auth/refresh     - Refresh access token
POST   /api/auth/logout      - Logout (invalidate token)
GET    /api/auth/me          - Get current user info
```

---

## 🧪 Testing Security

### Test Authentication

```bash
# Without token (should fail)
curl -X GET http://localhost:3000/api/clients

# With token (should succeed)
curl -X GET http://localhost:3000/api/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Rate Limiting

```bash
# Send 101 requests rapidly (should be blocked after 100)
for i in {1..101}; do
  curl http://localhost:3000/api/health
done
```

### Test Input Validation

```bash
# Invalid email (should fail)
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "domain": "test.com",
    "contact_email": "not-an-email"
  }'
```

---

## 🔄 Migration Path

### Phase 1: Non-Breaking (Week 1)
1. Install dependencies
2. Add security files (no changes to server.js)
3. Test in development

### Phase 2: Optional Features (Week 2)
1. Enable security headers (`ENABLE_SECURITY_HEADERS=true`)
2. Enable CORS protection (`ENABLE_CORS_PROTECTION=true`)
3. Test existing functionality

### Phase 3: Rate Limiting (Week 3)
1. Enable rate limiting (`ENABLE_RATE_LIMITING=true`)
2. Monitor for false positives
3. Adjust limits as needed

### Phase 4: Input Validation (Week 4)
1. Enable validation (`ENABLE_INPUT_VALIDATION=true`)
2. Test all API endpoints
3. Fix any validation errors

### Phase 5: Authentication (Week 5)
1. Create admin user
2. Enable authentication (`ENABLE_AUTHENTICATION=true`)
3. Update frontend to handle tokens
4. Test end-to-end

---

## 🛡️ Security Best Practices

### Environment Variables
```bash
# Never commit these to git
.env
.env.local
.env.production

# Use strong secrets (64+ characters)
JWT_SECRET=<64-character-random-string>
```

### Token Storage
```javascript
// Frontend: Store in httpOnly cookie (best)
// Or localStorage (if cookie not possible)
localStorage.setItem('token', token);

// Always use HTTPS in production
```

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

---

## 📊 Security Checklist

Before enabling in production:

- [ ] Change default admin password
- [ ] Generate new JWT secrets
- [ ] Enable HTTPS
- [ ] Set appropriate rate limits
- [ ] Configure allowed CORS origins
- [ ] Test all endpoints with authentication
- [ ] Set up monitoring/logging
- [ ] Create backup admin account
- [ ] Document API token usage for team

---

## 🔧 Troubleshooting

### "Invalid token" errors
- Check token hasn't expired
- Verify JWT_SECRET matches between requests
- Ensure Authorization header format: `Bearer <token>`

### Rate limit blocking legitimate users
- Increase `RATE_LIMIT_MAX_REQUESTS`
- Increase `RATE_LIMIT_WINDOW_MS`
- Whitelist specific IPs if needed

### CORS errors
- Add your domain to `ALLOWED_ORIGINS`
- Ensure credentials are enabled if using cookies
- Check browser console for specific CORS error

---

## 📚 Additional Resources

- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🆘 Support

If you encounter issues:
1. Check feature flags in `.env`
2. Review server logs
3. Test with `ENABLE_*=false` to isolate issue
4. See main README for general support

---

**Version:** 1.0.0
**Last Updated:** November 22, 2025
**Status:** Production Ready
