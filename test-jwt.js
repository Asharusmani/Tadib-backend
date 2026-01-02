// test-jwt.js
// Run this in your backend to verify JWT is working
// Usage: node test-jwt.js

require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('\n========== JWT TOKEN TEST ==========\n');

// 1. Check JWT_SECRET
console.log('1️⃣ Checking JWT_SECRET...');
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is NOT set in environment!');
  console.log('Available env vars:', Object.keys(process.env).filter(k => !k.includes('SECRET')));
  process.exit(1);
}
console.log('✅ JWT_SECRET exists');
console.log('   Length:', process.env.JWT_SECRET.length);
console.log('   Preview:', process.env.JWT_SECRET.substring(0, 10) + '...\n');

// 2. Create a test token
console.log('2️⃣ Creating test token...');
const testPayload = {
  userId: '694f965aace288db0bf40078', // Use the actual user ID from your logs
  email: 'accepter@gmail.com',
  iat: Math.floor(Date.now() / 1000)
};

const testToken = jwt.sign(
  testPayload,
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('✅ Token created successfully');
console.log('   Token length:', testToken.length);
console.log('   Token preview:', testToken.substring(0, 50) + '...');
console.log('   Full token:', testToken, '\n');

// 3. Verify the token
console.log('3️⃣ Verifying token...');
try {
  const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
  console.log('✅ Token verified successfully');
  console.log('   Decoded payload:', JSON.stringify(decoded, null, 2), '\n');
} catch (error) {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
}

// 4. Test with the actual token from your logs
console.log('4️⃣ Testing actual token from logs...');
const actualToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTRmOTY1YWFjZTI4OGRiMGJmNDAwNzgiLCJpYXQiOjE3NjczNDE4MjksImV4cCI6MTc2Nzk0NjYyOX0.ZMKHAwCh60vIH-QSebEOOxwR8x3FzCl23d-iTEjqv1A';

try {
  const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
  console.log('✅ Actual token verified successfully');
  console.log('   Decoded payload:', JSON.stringify(decoded, null, 2));
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = decoded.exp - now;
  
  if (expiresIn > 0) {
    console.log('   ✅ Token is still valid');
    console.log('   ⏰ Expires in:', Math.floor(expiresIn / 3600), 'hours');
  } else {
    console.log('   ❌ Token has EXPIRED');
    console.log('   ⏰ Expired', Math.floor(-expiresIn / 3600), 'hours ago');
  }
} catch (error) {
  console.error('❌ Verification of actual token failed:', error.message);
  console.error('   This is likely why you\'re getting 401 errors!');
  
  if (error.name === 'TokenExpiredError') {
    console.log('   💡 Solution: Generate a new token by logging in again');
  } else if (error.name === 'JsonWebTokenError') {
    console.log('   💡 Solution: Check if JWT_SECRET matches what was used to create the token');
  }
}

console.log('\n========== TEST COMPLETE ==========\n');