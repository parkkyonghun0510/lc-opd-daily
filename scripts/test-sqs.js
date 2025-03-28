// Test SQS connectivity
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import 'dotenv/config';

async function testSQSConnection() {
  console.log('Testing SQS connection...');
  console.log('AWS Region:', process.env.AWS_REGION);
  console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
  
  try {
    // Initialize SQS client
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    
    // Test connection by getting queue attributes
    const command = new GetQueueAttributesCommand({
      QueueUrl: process.env.AWS_SQS_NOTIFICATION_QUEUE_URL,
      AttributeNames: ['ApproximateNumberOfMessages']
    });
    
    const response = await sqsClient.send(command);
    
    console.log('SQS Connection successful!');
    console.log('Queue details:', response.Attributes);
    return true;
  } catch (error) {
    console.error('Error connecting to SQS:', error);
    return false;
  }
}

// Run the test
testSQSConnection().catch(console.error); 