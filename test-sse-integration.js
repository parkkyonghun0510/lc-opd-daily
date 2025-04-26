import http from 'http';

// Simulates sending events to your SSE endpoints
async function testSSEIntegration() {
  console.log('=== SSE Integration Test ===');

  // 1. Simulate a dashboard update
  console.log('\n1. Simulating dashboard update...');
  await sendRequest('/api/simulate-dashboard-update?type=metrics');

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Simulate a notification for a specific user
  console.log('\n2. Simulating notification for user-123...');
  await sendRequest('/trigger-event?type=notification&message=New%20report%20available&userId=user-123');

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Simulate a system alert
  console.log('\n3. Simulating system alert...');
  await sendRequest('/api/simulate-system-alert?type=warning&message=System%20maintenance%20in%2015%20minutes');

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Get SSE statistics
  console.log('\n4. Getting SSE statistics...');
  await sendRequest('/api/sse-stats');

  console.log('\nTest complete! Check the browser client to see the events.');
}

// Helper function to send HTTP requests
async function sendRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`Response (${res.statusCode}):`);
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.log(`Raw response (${res.statusCode}): ${data}`);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error: ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

// Run the test
testSSEIntegration().catch(error => {
  console.error('Test failed:', error);
});
