import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
// Initialize the SQS client
const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});
// Queue URL from environment
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '';
/**
 * Send a notification message to the SQS queue
 */
export async function sendToNotificationQueue(message) {
    try {
        console.log('Sending notification to queue:', {
            type: message.type,
            targetUsers: message.userIds?.length || 0
        });
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(message),
            // Add a message group ID for FIFO queues if needed
            // MessageGroupId: 'notifications',
            // Add message deduplication ID if using a FIFO queue
            // MessageDeduplicationId: `${message.type}-${Date.now()}`,
        });
        const response = await sqsClient.send(command);
        console.log('Message sent to SQS:', response.MessageId);
        return { MessageId: response.MessageId };
    }
    catch (error) {
        console.error('Error sending message to SQS:', error);
        throw error;
    }
}
/**
 * Receive messages from the notification queue
 */
export async function receiveFromNotificationQueue(maxMessages = 10) {
    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: 20, // Long polling
            AttributeNames: ['All'],
            MessageAttributeNames: ['All']
        });
        const response = await sqsClient.send(command);
        return response.Messages || [];
    }
    catch (error) {
        console.error('Error receiving messages from SQS:', error);
        throw error;
    }
}
/**
 * Delete a message from the queue after processing
 */
export async function deleteMessageFromQueue(receiptHandle) {
    try {
        const command = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle
        });
        await sqsClient.send(command);
        console.log('Message deleted from queue:', receiptHandle);
    }
    catch (error) {
        console.error('Error deleting message from SQS:', error);
        throw error;
    }
}
