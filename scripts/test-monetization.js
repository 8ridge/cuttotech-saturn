// Monetization system test script
// Tests all monetization scenarios: creator detection, geo targeting, traffic split

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TARGET_URL = 'https://google.com';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/client_uuid=([^;]+)/);
  return match ? match[1] : null;
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'manual', // Don't follow redirects automatically
    });
    
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    
    return {
      status: response.status,
      headers,
      body: await response.text(),
    };
  } catch (error) {
    log(`❌ Request error: ${error.message}`, 'red');
    throw error;
  }
}

async function runTests() {
  log('\n🧪 Starting Monetization System Tests\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  let shortCode = null;
  let clientUuid = null;
  let creatorIp = null;
  
  // ============================================
  // STEP 1: CREATE SHORT LINK
  // ============================================
  log('\n📝 STEP 1: Creating short link...', 'blue');
  
  try {
    const createResponse = await makeRequest(`${BASE_URL}/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: TARGET_URL,
      }),
    });
    
    if (createResponse.status !== 200) {
      log(`❌ Failed to create link: ${createResponse.status}`, 'red');
      log(`Response: ${createResponse.body}`, 'red');
      return;
    }
    
    const createData = JSON.parse(createResponse.body);
    shortCode = createData.shortCode;
    clientUuid = extractCookie(createResponse.headers['set-cookie']);
    
    // Extract IP from response (we'll use localhost IP for creator IP test)
    creatorIp = '127.0.0.1';
    
    log(`✅ Link created: ${shortCode}`, 'green');
    log(`🍪 Cookie (client_uuid): ${clientUuid ? clientUuid.substring(0, 20) + '...' : 'NOT FOUND'}`, 'yellow');
    log(`📍 Creator IP (for test): ${creatorIp}`, 'yellow');
    
  } catch (error) {
    log(`❌ Error creating link: ${error.message}`, 'red');
    return;
  }
  
  if (!shortCode) {
    log('❌ No short code received, aborting tests', 'red');
    return;
  }
  
  // ============================================
  // STEP 2: TEST CREATOR UUID
  // ============================================
  log('\n🛡️ STEP 2: Testing Creator UUID detection...', 'blue');
  
  try {
    const uuidResponse = await makeRequest(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      headers: {
        'Cookie': `client_uuid=${clientUuid}`,
      },
    });
    
    const location = uuidResponse.headers.location;
    const isDirect = location === TARGET_URL;
    
    if (uuidResponse.status === 302 && isDirect) {
      log(`✅ PASS: Creator UUID recognized (redirected to original URL)`, 'green');
      log(`   Location: ${location}`, 'yellow');
    } else {
      log(`❌ FAIL: Expected 302 to ${TARGET_URL}, got ${uuidResponse.status}`, 'red');
      log(`   Location: ${location}`, 'red');
    }
  } catch (error) {
    log(`❌ Error testing Creator UUID: ${error.message}`, 'red');
  }
  
  // ============================================
  // STEP 3: TEST CREATOR IP
  // ============================================
  log('\n🛡️ STEP 3: Testing Creator IP detection...', 'blue');
  
  try {
    const ipResponse = await makeRequest(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      headers: {
        'x-forwarded-for': creatorIp,
      },
    });
    
    const location = ipResponse.headers.location;
    const isDirect = location === TARGET_URL;
    
    if (ipResponse.status === 302 && isDirect) {
      log(`✅ PASS: Creator IP recognized (redirected to original URL)`, 'green');
      log(`   Location: ${location}`, 'yellow');
    } else {
      log(`❌ FAIL: Expected 302 to ${TARGET_URL}, got ${ipResponse.status}`, 'red');
      log(`   Location: ${location}`, 'red');
    }
  } catch (error) {
    log(`❌ Error testing Creator IP: ${error.message}`, 'red');
  }
  
  // ============================================
  // STEP 4: TEST GEO MISMATCH (USA - no offer)
  // ============================================
  log('\n🌍 STEP 4: Testing Geo Mismatch (USA - no offer configured)...', 'blue');
  
  try {
    const usaResponse = await makeRequest(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      headers: {
        'x-forwarded-for': '8.8.8.8', // Google DNS (USA)
      },
    });
    
    const location = usaResponse.headers.location;
    const isDirect = location === TARGET_URL;
    
    if (usaResponse.status === 302 && isDirect) {
      log(`✅ PASS: Geo mismatch -> Direct redirect (no offer for USA)`, 'green');
      log(`   Location: ${location}`, 'yellow');
    } else {
      log(`❌ FAIL: Expected 302 to ${TARGET_URL}, got ${usaResponse.status}`, 'red');
      log(`   Location: ${location}`, 'red');
    }
  } catch (error) {
    log(`❌ Error testing Geo Mismatch: ${error.message}`, 'red');
  }
  
  // ============================================
  // STEP 5: TEST TARGET GEO (NIGERIA)
  // ============================================
  log('\n💰 STEP 5: Testing Target Geo (Nigeria - offer configured)...', 'blue');
  
  try {
    const nigeriaResponse = await makeRequest(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      headers: {
        'x-forwarded-for': '102.129.0.0', // Nigeria IP
      },
    });
    
    const location = nigeriaResponse.headers.location;
    const isDirect = location === TARGET_URL;
    const isOffer = location && location.includes('offer');
    
    if (nigeriaResponse.status === 302) {
      if (isDirect) {
        log(`🎲 Nigeria traffic sent to: DIRECT (original URL)`, 'yellow');
        log(`   Location: ${location}`, 'yellow');
        log(`   ✅ PASS: System working (50% rotation - got direct)`, 'green');
      } else if (isOffer) {
        log(`🎲 Nigeria traffic sent to: OFFER`, 'yellow');
        log(`   Location: ${location}`, 'yellow');
        log(`   ✅ PASS: System working (50% rotation - got offer)`, 'green');
      } else {
        log(`⚠️  Unexpected redirect location: ${location}`, 'yellow');
        log(`   Status: ${nigeriaResponse.status}`, 'yellow');
      }
    } else {
      log(`❌ FAIL: Expected 302, got ${nigeriaResponse.status}`, 'red');
      log(`   Location: ${location}`, 'red');
    }
  } catch (error) {
    log(`❌ Error testing Target Geo: ${error.message}`, 'red');
  }
  
  // ============================================
  // SUMMARY
  // ============================================
  log('\n' + '='.repeat(60), 'cyan');
  log('✅ Tests completed!', 'green');
  log(`\n📊 Test Summary:`, 'cyan');
  log(`   - Short code: ${shortCode}`, 'yellow');
  log(`   - Test URL: ${BASE_URL}/${shortCode}`, 'yellow');
  log(`   - Original URL: ${TARGET_URL}`, 'yellow');
  log('\n');
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

