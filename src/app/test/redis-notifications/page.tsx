import { Metadata } from 'next';
import { RedisNotificationTester } from '@/components/test/RedisNotificationTester';

export const metadata: Metadata = {
  title: 'Redis Notification Tester',
  description: 'Test the Redis notification system',
};

export default function RedisNotificationTestPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Redis Notification System Test</h1>
      <p className="text-muted-foreground mb-8">
        This page allows you to test the Redis notification system by sending and receiving notifications in real-time.
      </p>
      
      <RedisNotificationTester />
    </div>
  );
}
