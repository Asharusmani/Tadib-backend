// utils/deviceDetector.js
const axios = require('axios');

/**
 * Extract device, browser, OS info from request (Simple version)
 */
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  
  // Detect device type
  let device = 'Desktop';
  if (/mobile/i.test(userAgent)) {
    device = 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    device = 'Tablet';
  }
  
  // Detect browser
  let browser = 'Unknown Browser';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
    browser = 'Opera';
  }
  
  // Detect OS
  let os = 'Unknown OS';
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'MacOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }
  
  // Get IP address
  const ipAddress = req.ip || 
                   req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   'Unknown';
  
  return {
    device,
    browser,
    os,
    ipAddress: ipAddress.replace('::ffff:', ''), // Clean IPv6 prefix
    userAgent
  };
}

/**
 * Get approximate location from IP using free API
 */
async function getLocationFromIP(ipAddress) {
  try {
    // Skip local IPs
    if (!ipAddress || 
        ipAddress === 'Unknown' || 
        ipAddress.startsWith('127.') || 
        ipAddress.startsWith('192.168.') ||
        ipAddress.startsWith('10.') ||
        ipAddress === '::1') {
      return 'Local Network';
    }
    
    // Free IP location API (no key required)
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
      timeout: 3000 // 3 second timeout
    });
    
    if (response.data.status === 'success') {
      const { city, country } = response.data;
      return city ? `${city}, ${country}` : country;
    }
  } catch (error) {
    console.log('Location detection skipped:', error.message);
  }
  
  return null;
}

module.exports = {
  getDeviceInfo,
  getLocationFromIP
};