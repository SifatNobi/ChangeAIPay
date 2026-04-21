// Simple API smoke tests for ChangeAIPay backend
// Requirements: backend server running on localhost:3000 (or API_BASE_URL env)
// Dependencies: axios (included in backend package.json)

const axios = require('axios');
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function post(path, data, token) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const res = await axios.post(`${API_BASE}${path}`, data, { headers });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err?.response?.data || err.message };
  }
}

async function get(path, token) {
  try {
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const res = await axios.get(`${API_BASE}${path}`, { headers });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err?.response?.data || err.message };
  }
}

async function run() {
  console.log('== ChangeAIPay API smoke test ==');
  // 1) health
  console.log('Checking /health...');
  let r = await get('/health');
  console.log('health:', r);

  // Test credentials
  const testUser = {
    name: 'API Test User',
    email: 'apitest+' + Date.now() + '@example.com',
    password: 'TestPassword123!'
  };

  // 2) register
  console.log('Registering test user...');
  r = await post('/auth/register', testUser);
  if (!r.ok) {
    console.error('Register failed:', r.error);
    console.log('Continuing to login test only if a pre-existing user exists. If you want register to run, ensure wallet RPC is available.');
    // Do not exit; proceed to login stage in hopes of an existing user
    // This may fail gracefully if no user exists.
  }
  const token = r.data?.token;
  console.log('Register result:', { token: !!token, user: r.data?.user?.email });

  // 3) login
  console.log('Logging in...');
  r = await post('/auth/login', { email: testUser.email, password: testUser.password });
  if (!r.ok) {
    console.error('Login failed:', r.error);
    process.exit(1);
  }
  const loginToken = r.data?.token;
  console.log('Login result: token received:', !!loginToken);

  // 4) profile
  console.log('Fetching profile...');
  r = await get('/user/profile', loginToken);
  console.log('Profile:', r);
}

run().catch((e) => {
  console.error('Unexpected error during tests:', e);
  process.exit(1);
});
