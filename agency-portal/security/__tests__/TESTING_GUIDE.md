# Security Module - Testing Guide

## Running Tests

```bash
# Install test dependencies (if not already installed)
cd agency-portal
npm install --save-dev jest

# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run specific test file
npx jest security/__tests__/security.test.js
```

## Test Coverage

Current tests cover:
- ✅ Password validation (all requirements)
- ✅ Password hashing and comparison
- ✅ JWT token generation
- ✅ Configuration loading
- ✅ Feature flag validation

## Manual Testing

### 1. Test Without Security (Baseline)

```bash
# Start server with security disabled
cd agency-portal
ENABLE_AUTHENTICATION=false npm start

# Test health endpoint
curl http://localhost:3000/api/health

# Test clients endpoint (should work without auth)
curl http://localhost:3000/api/clients
```

### 2. Test With Authentication

```bash
# Enable authentication
ENABLE_AUTHENTICATION=true npm start

# Create admin user
npm run setup-admin

# Try accessing protected endpoint without token (should fail)
curl http://localhost:3000/api/clients

# Login and get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@asi360.com",
    "password": "YourPassword123!"
  }'

# Save the token from response, then use it
TOKEN="your-token-here"

# Access protected endpoint with token (should work)
curl http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Rate Limiting

```bash
# Enable rate limiting
ENABLE_RATE_LIMITING=true \
RATE_LIMIT_MAX_REQUESTS=5 \
npm start

# Send 6 requests rapidly (6th should be blocked)
for i in {1..6}; do
  echo "Request $i:"
  curl http://localhost:3000/api/health
  echo ""
done
```

### 4. Test Input Validation

```bash
# Enable validation
ENABLE_INPUT_VALIDATION=true npm start

# Try creating client with invalid email (should fail)
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Client",
    "domain": "test.com",
    "contact_email": "not-an-email"
  }'

# Should return validation error

# Try with valid data (should work)
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Client",
    "domain": "test.com",
    "contact_email": "valid@email.com"
  }'
```

### 5. Test CORS Protection

```bash
# Enable CORS protection
ENABLE_CORS_PROTECTION=true \
ALLOWED_ORIGINS=https://portal.asi360.com \
npm start

# Try from browser console on different origin
fetch('http://localhost:3000/api/health')
  .then(r => r.json())
  .then(console.log)

# Should be blocked by CORS if origin doesn't match
```

## Integration Tests

Create `agency-portal/__tests__/integration.test.js`:

```javascript
const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Login to get token for protected endpoints
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL || 'admin@asi360.com',
        password: process.env.ADMIN_PASSWORD || 'TestPassword123!'
      });

    if (response.body.success) {
      authToken = response.body.token;
    }
  });

  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
    });

    test('POST /api/auth/login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Endpoints', () => {
    test('GET /api/clients without token should fail', async () => {
      const response = await request(app).get('/api/clients');

      if (process.env.ENABLE_AUTHENTICATION === 'true') {
        expect(response.status).toBe(401);
      } else {
        expect(response.status).toBe(200);
      }
    });

    test('GET /api/clients with token should succeed', async () => {
      if (!authToken) {
        return; // Skip if authentication is disabled
      }

      const response = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

Run with:
```bash
npm test -- __tests__/integration.test.js
```

## Security Checklist

Before deploying to production, verify:

- [ ] All tests pass (`npm test`)
- [ ] JWT secrets changed from defaults
- [ ] Admin password is strong and unique
- [ ] Rate limits are appropriate for your traffic
- [ ] CORS origins are correctly configured
- [ ] All security features tested manually
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS is enabled in production
- [ ] Tokens are stored securely (httpOnly cookies or encrypted storage)
- [ ] Logging is configured (but doesn't log tokens/passwords)

## Troubleshooting Tests

### Tests fail with "Cannot find module"

```bash
# Make sure you're in the right directory
cd agency-portal

# Install dependencies
npm install
```

### Tests fail with "Connection refused"

Tests don't need the server running. If you see this error:
- Check that test is not trying to connect to a real server
- Use mocks for external dependencies (Supabase, Anthropic)

### Tests pass but feature doesn't work

- Check `.env` configuration
- Verify feature flags are set correctly
- Check server logs for errors
- Test manually with curl commands above

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd agency-portal && npm install
      - run: cd agency-portal && npm test
```
