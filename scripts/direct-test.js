// Simple script to test database connectivity for notifications
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseNotifications() {
  console.log('Testing database connection for notifications...');
  
  try {
    // Get a sample user
    const sampleUser = await prisma.user.findFirst({
      select: { id: true }
    });
    
    if (!sampleUser) {
      console.error('No users found in the database. Please create a user first.');
      return;
    }
    
    console.log('Using user:', sampleUser.id);
    
    // Create a test notification
    const notification = await prisma.inAppNotification.create({
      data: {
        userId: sampleUser.id,
        title: 'Test Notification',
        body: 'This is a test notification created directly via script',
        type: 'TEST_NOTIFICATION',
        isRead: false,
        data: { source: 'direct-test-script' }
      }
    });
    
    console.log('Successfully created notification:', notification.id);
    
    // Also create a notification event
    const event = await prisma.notificationEvent.create({
      data: {
        notificationId: notification.id,
        event: 'DELIVERED',
        metadata: {
          method: 'direct-script',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    console.log('Created notification event:', event.id);
    
    // Retrieve latest notifications
    const recentNotifications = await prisma.inAppNotification.findMany({
      where: {
        userId: sampleUser.id
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`Found ${recentNotifications.length} recent notifications for user ${sampleUser.id}:`);
    recentNotifications.forEach((n, i) => {
      console.log(`${i+1}. ${n.title} (${n.id}, created at ${n.createdAt})`);
    });
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseNotifications().catch(console.error); 