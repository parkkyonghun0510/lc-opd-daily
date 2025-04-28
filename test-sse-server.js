import http from 'http';
import { URL } from 'url';

// Define user roles for role-based SSE testing
const UserRole = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  USER: 'user'
};

// Store connected clients with their roles
const clients = new Map();

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  // Set headers for SSE
  if (req.url.startsWith('/sse')) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const userId = params.get('userId') || 'anonymous';
    const userRole = params.get('role') || UserRole.USER;

    console.log(`Client connected to SSE endpoint - User ID: ${userId}, Role: ${userRole}`);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Store client information
    const clientId = Date.now().toString();
    clients.set(clientId, {
      id: clientId,
      userId,
      userRole,
      response: res
    });

    // Send initial connection message
    res.write(`event: connected\ndata: ${JSON.stringify({
      message: 'Connected to SSE server',
      userId,
      role: userRole
    })}\n\n`);

    // Send a ping every 5 seconds to keep the connection alive
    const pingInterval = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    }, 5000);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`Client disconnected from SSE endpoint - User ID: ${userId}`);
      clearInterval(pingInterval);
      clients.delete(clientId);
      console.log(`Active connections: ${clients.size}`);
    });

    // Create functions to send custom events (we'll expose these via other endpoints)
    if (!global.sseHandlers) {
      global.sseHandlers = {
        // Send event to a specific user
        sendToUser: (userId, eventType, data) => {
          let sent = 0;
          for (const client of clients.values()) {
            if (client.userId === userId) {
              console.log(`Sending ${eventType} event to user ${userId}:`, data);
              client.response.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
              sent++;
            }
          }
          return sent;
        },

        // Send event to users with specific role
        sendToRole: (role, eventType, data) => {
          let sent = 0;
          for (const client of clients.values()) {
            if (client.userRole === role) {
              console.log(`Sending ${eventType} event to ${role} ${client.userId}:`, data);
              client.response.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
              sent++;
            }
          }
          return sent;
        },

        // Broadcast to all clients
        broadcast: (eventType, data) => {
          console.log(`Broadcasting ${eventType} event to all clients:`, data);
          for (const client of clients.values()) {
            client.response.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
          }
          return clients.size;
        }
      };
    }
  }
  // Endpoint to trigger custom events
  else if (req.url.startsWith('/trigger-event')) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const eventType = params.get('type') || 'notification';
    const message = params.get('message') || 'Test notification';
    const targetType = params.get('target') || 'broadcast'; // broadcast, user, or role
    const targetId = params.get('targetId') || ''; // userId or role name

    // Create event data with common fields
    const eventData = {
      message,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };

    // Add report-specific fields if this is a report event
    if (eventType.startsWith('report')) {
      eventData.reportId = params.get('reportId') || Math.random().toString(36).substring(2, 9);
      eventData.branchId = params.get('branchId') || 'branch-' + Math.random().toString(36).substring(2, 5);
      eventData.branchName = params.get('branchName') || 'Test Branch';
      eventData.status = params.get('status') || 'pending_approval';
      eventData.reportType = params.get('reportType') || 'actual';
      eventData.date = params.get('date') || new Date().toISOString().split('T')[0];
    }

    if (global.sseHandlers) {
      let sent = 0;

      // Send event based on target type
      if (targetType === 'user' && targetId) {
        sent = global.sseHandlers.sendToUser(targetId, eventType, eventData);
      } else if (targetType === 'role' && targetId) {
        sent = global.sseHandlers.sendToRole(targetId, eventType, eventData);
      } else {
        sent = global.sseHandlers.broadcast(eventType, eventData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `Event ${eventType} sent to ${targetType}${targetId ? ' ' + targetId : ''}`,
        sentTo: sent
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'No active SSE connections' }));
    }
  }
  // Endpoint specifically for report approval events
  else if (req.url.startsWith('/report-approval')) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const action = params.get('action') || 'approve'; // approve or reject
    const reportId = params.get('reportId') || Math.random().toString(36).substring(2, 9);
    const branchId = params.get('branchId') || 'branch-' + Math.random().toString(36).substring(2, 5);
    const branchName = params.get('branchName') || 'Test Branch';
    const approverName = params.get('approverName') || 'Test Admin';
    const comments = params.get('comments') || '';
    const userId = params.get('userId') || ''; // Optional: specific user to notify

    // Create the event data
    const eventData = {
      reportId,
      branchId,
      branchName,
      status: action === 'approve' ? 'approved' : 'rejected',
      previousStatus: 'pending_approval',
      approverName,
      comments,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      reportType: params.get('reportType') || 'actual'
    };

    if (global.sseHandlers) {
      let sent = 0;
      const eventType = 'reportStatusUpdate';

      // If userId is provided, send to that specific user (e.g., the report submitter)
      if (userId) {
        sent = global.sseHandlers.sendToUser(userId, eventType, eventData);
      } else {
        // Otherwise, broadcast to all users
        sent = global.sseHandlers.broadcast(eventType, eventData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `Report ${action} event sent${userId ? ' to user ' + userId : ''}`,
        sentTo: sent,
        eventData
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'No active SSE connections' }));
    }
  }

  // Serve the HTML client
  else if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>SSE Test Client</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #events { border: 1px solid #ccc; padding: 10px; height: 300px; overflow-y: auto; margin-bottom: 20px; }
    .event { margin-bottom: 8px; padding: 8px; border-radius: 4px; }
    .event-connected { background-color: #d4edda; }
    .event-notification { background-color: #cce5ff; }
    .event-ping { background-color: #f8f9fa; color: #6c757d; font-size: 0.9em; }
    .event-dashboardUpdate { background-color: #fff3cd; }
    .event-reportStatusUpdate { background-color: #e2e3ff; }
    .controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .section { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    .section h3 { margin-top: 0; }
    button { padding: 8px 16px; cursor: pointer; }
    input, select { padding: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .approve-btn { background-color: #28a745; color: white; border: none; }
    .reject-btn { background-color: #dc3545; color: white; border: none; }
  </style>
</head>
<body>
  <h1>SSE Test Client</h1>

  <div class="section">
    <h3>Connection Settings</h3>
    <div class="grid">
      <div>
        <label for="userId">User ID:</label>
        <input id="userId" placeholder="User ID" value="user1">
      </div>
      <div>
        <label for="userRole">User Role:</label>
        <select id="userRole">
          <option value="admin">Admin</option>
          <option value="branch_manager">Branch Manager</option>
          <option value="user">Regular User</option>
        </select>
      </div>
    </div>
    <div class="controls" style="margin-top: 10px;">
      <button id="connect">Connect</button>
      <button id="disconnect">Disconnect</button>
      <span id="status">Disconnected</span>
    </div>
  </div>

  <div class="section">
    <h3>General Event Testing</h3>
    <div class="controls">
      <select id="eventType">
        <option value="notification">Notification</option>
        <option value="dashboardUpdate">Dashboard Update</option>
        <option value="reportStatusUpdate">Report Status Update</option>
        <option value="systemAlert">System Alert</option>
      </select>
      <input id="eventMessage" placeholder="Event message" value="Test message">
      <select id="targetType">
        <option value="broadcast">All Users</option>
        <option value="user">Specific User</option>
        <option value="role">By Role</option>
      </select>
      <input id="targetId" placeholder="User ID or Role" style="display: none;">
      <button id="sendEvent">Send Event</button>
    </div>
  </div>

  <div class="section">
    <h3>Report Approval Testing</h3>
    <div class="grid">
      <div>
        <label for="reportId">Report ID:</label>
        <input id="reportId" placeholder="Report ID" value="report-123">
      </div>
      <div>
        <label for="branchName">Branch Name:</label>
        <input id="branchName" placeholder="Branch Name" value="Test Branch">
      </div>
      <div>
        <label for="reportType">Report Type:</label>
        <select id="reportType">
          <option value="actual">Actual</option>
          <option value="plan">Plan</option>
        </select>
      </div>
      <div>
        <label for="notifyUserId">Notify User ID (optional):</label>
        <input id="notifyUserId" placeholder="User ID to notify">
      </div>
    </div>
    <div style="margin-top: 10px;">
      <label for="comments">Comments:</label>
      <textarea id="comments" placeholder="Approval/rejection comments" style="width: 100%; height: 60px;"></textarea>
    </div>
    <div class="controls" style="margin-top: 10px;">
      <button id="approveReport" class="approve-btn">Approve Report</button>
      <button id="rejectReport" class="reject-btn">Reject Report</button>
    </div>
  </div>

  <h2>Events</h2>
  <div id="events"></div>

  <script>
    let eventSource = null;
    const eventsContainer = document.getElementById('events');
    const statusElement = document.getElementById('status');
    const targetTypeSelect = document.getElementById('targetType');
    const targetIdInput = document.getElementById('targetId');

    // Show/hide target ID input based on target type selection
    targetTypeSelect.addEventListener('change', () => {
      const targetType = targetTypeSelect.value;
      if (targetType === 'user' || targetType === 'role') {
        targetIdInput.style.display = 'inline-block';
        targetIdInput.placeholder = targetType === 'user' ? 'User ID' : 'Role';
      } else {
        targetIdInput.style.display = 'none';
      }
    });

    // Connect to SSE endpoint with user ID and role
    document.getElementById('connect').addEventListener('click', () => {
      if (eventSource) {
        console.log('Already connected');
        return;
      }

      const userId = document.getElementById('userId').value || 'anonymous';
      const userRole = document.getElementById('userRole').value || 'user';

      // Create new EventSource with user ID and role
      eventSource = new EventSource(\`/sse?userId=\${encodeURIComponent(userId)}&role=\${encodeURIComponent(userRole)}\`);
      statusElement.textContent = 'Connecting...';

      // Connection opened
      eventSource.onopen = () => {
        statusElement.textContent = 'Connected';
        addEvent('system', { message: 'Connection established', userId, role: userRole }, 'event-connected');
      };

      // Connection error
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        statusElement.textContent = 'Error - Reconnecting...';
        addEvent('system', { message: 'Connection error - attempting to reconnect' }, 'event-error');
      };

      // Listen for messages (unnamed events)
      eventSource.onmessage = (event) => {
        console.log('Received message:', event.data);
        try {
          const data = JSON.parse(event.data);
          addEvent('message', data);
        } catch (e) {
          addEvent('message', { raw: event.data });
        }
      };

      // Listen for specific event types
      eventSource.addEventListener('connected', (event) => {
        console.log('Connected event:', event.data);
        try {
          const data = JSON.parse(event.data);
          addEvent('connected', data, 'event-connected');
        } catch (e) {
          addEvent('connected', { raw: event.data }, 'event-connected');
        }
      });

      // Add event listeners for all our event types
      [
        'notification',
        'dashboardUpdate',
        'reportStatusUpdate',
        'systemAlert',
        'ping'
      ].forEach(eventType => {
        eventSource.addEventListener(eventType, (event) => {
          console.log(\`\${eventType} event:\`, event.data);
          try {
            const data = JSON.parse(event.data);
            addEvent(eventType, data, \`event-\${eventType}\`);
          } catch (e) {
            addEvent(eventType, { raw: event.data }, \`event-\${eventType}\`);
          }
        });
      });
    });

    // Disconnect from SSE endpoint
    document.getElementById('disconnect').addEventListener('click', () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
        statusElement.textContent = 'Disconnected';
        addEvent('system', { message: 'Disconnected from server' }, 'event-system');
      }
    });

    // Send custom event
    document.getElementById('sendEvent').addEventListener('click', () => {
      const eventType = document.getElementById('eventType').value;
      const message = document.getElementById('eventMessage').value;
      const targetType = document.getElementById('targetType').value;
      const targetId = document.getElementById('targetId').value;

      let url = \`/trigger-event?type=\${encodeURIComponent(eventType)}&message=\${encodeURIComponent(message)}\`;

      // Add target parameters if needed
      if (targetType !== 'broadcast') {
        url += \`&target=\${encodeURIComponent(targetType)}&targetId=\${encodeURIComponent(targetId)}\`;
      }

      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('Event triggered:', data);
          if (!data.success) {
            addEvent('system', { message: \`Failed to send event: \${data.message}\` }, 'event-error');
          } else {
            addEvent('system', { message: \`Event sent: \${data.message}\` }, 'event-system');
          }
        })
        .catch(error => {
          console.error('Error triggering event:', error);
          addEvent('system', { message: \`Error: \${error.message}\` }, 'event-error');
        });
    });

    // Approve report
    document.getElementById('approveReport').addEventListener('click', () => {
      sendReportApproval('approve');
    });

    // Reject report
    document.getElementById('rejectReport').addEventListener('click', () => {
      sendReportApproval('reject');
    });

    // Helper function to send report approval/rejection
    function sendReportApproval(action) {
      const reportId = document.getElementById('reportId').value;
      const branchName = document.getElementById('branchName').value;
      const reportType = document.getElementById('reportType').value;
      const comments = document.getElementById('comments').value;
      const userId = document.getElementById('notifyUserId').value;

      let url = \`/report-approval?action=\${encodeURIComponent(action)}\`;
      url += \`&reportId=\${encodeURIComponent(reportId)}\`;
      url += \`&branchName=\${encodeURIComponent(branchName)}\`;
      url += \`&reportType=\${encodeURIComponent(reportType)}\`;
      url += \`&comments=\${encodeURIComponent(comments)}\`;

      if (userId) {
        url += \`&userId=\${encodeURIComponent(userId)}\`;
      }

      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('Report action triggered:', data);
          if (!data.success) {
            addEvent('system', { message: \`Failed to \${action} report: \${data.message}\` }, 'event-error');
          } else {
            addEvent('system', {
              message: \`Report \${action}d successfully\`,
              details: data.message,
              sentTo: data.sentTo
            }, 'event-system');
          }
        })
        .catch(error => {
          console.error(\`Error \${action}ing report:\`, error);
          addEvent('system', { message: \`Error: \${error.message}\` }, 'event-error');
        });
    }

    // Helper function to add event to the UI
    function addEvent(type, data, className = '') {
      const eventElement = document.createElement('div');
      eventElement.className = \`event \${className || 'event-' + type}\`;

      const timestamp = new Date().toLocaleTimeString();
      const formattedData = JSON.stringify(data, null, 2);

      eventElement.innerHTML = \`
        <strong>\${timestamp} - \${type}</strong>
        <pre>\${formattedData}</pre>
      \`;

      eventsContainer.prepend(eventElement);

      // Limit the number of events shown to prevent browser slowdown
      if (eventsContainer.children.length > 50) {
        eventsContainer.removeChild(eventsContainer.lastChild);
      }
    }
  </script>
</body>
</html>`);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`SSE test server running at http://localhost:${PORT}`);
  console.log(`- SSE endpoint: http://localhost:${PORT}/sse?userId=user1&role=admin`);
  console.log(`- Web client: http://localhost:${PORT}/`);
  console.log('\nAvailable endpoints:');
  console.log(`- General events: http://localhost:${PORT}/trigger-event?type=notification&message=Test`);
  console.log(`- Role-based events: http://localhost:${PORT}/trigger-event?type=notification&message=Test&target=role&targetId=admin`);
  console.log(`- User-specific events: http://localhost:${PORT}/trigger-event?type=notification&message=Test&target=user&targetId=user1`);
  console.log(`- Report approval: http://localhost:${PORT}/report-approval?action=approve&reportId=123&branchName=TestBranch`);
  console.log(`- Report rejection: http://localhost:${PORT}/report-approval?action=reject&reportId=123&branchName=TestBranch&comments=Needs%20revision`);
});
