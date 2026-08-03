const http = require('http');

const data = JSON.stringify({
  name: 'Wanas Cafe',
  slug: 'wanas',
  businessType: 'CAFE',
  ownerUsername: 'admin',
  ownerPassword: 'password123',
  ownerFullName: 'Admin User',
  timezone: 'Africa/Cairo',
  currency: 'EGP'
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/platform/tenants',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Platform-Api-Key': 'dev-only-platform-key-change-me',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let resData = '';
  res.on('data', d => resData += d);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', resData);
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
