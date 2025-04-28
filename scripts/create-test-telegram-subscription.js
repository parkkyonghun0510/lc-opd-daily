import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createTestTelegramSubscription() {
  try {
    // Find the user we're working with
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, name: true }
    });
    
    if (!user) {
      console.error('No users found in database');
      return;
    }
    
    //console.log(`Creating test Telegram subscription for user: ${user.email} (${user.id})`);
    
    // Check if subscription already exists
    const existingSub = await prisma.telegramSubscription.findUnique({
      where: { userId: user.id }
    });
    
    if (existingSub) {
      //console.log(`User already has a Telegram subscription with chat ID: ${existingSub.chatId}`);
      return;
    }
    
    // Create test subscription with a predictable chat ID for testing
    const subscription = await prisma.telegramSubscription.create({
      data: {
        userId: user.id,
        chatId: '123456789', // Test chat ID
        username: 'test_user'
      }
    });
    
    //console.log(`Created test Telegram subscription with ID: ${subscription.id}`);
    //console.log(`Chat ID: ${subscription.chatId}`);
    
  } catch (error) {
    console.error('Error creating test subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestTelegramSubscription(); 