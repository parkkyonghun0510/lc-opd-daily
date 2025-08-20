// Test API endpoint to check environment variables
export default function handler(req, res) {
  const envVars = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'SET' : 'NOT SET',
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? 'SET' : 'NOT SET',
    VAPID_CONTACT_EMAIL: process.env.VAPID_CONTACT_EMAIL ? 'SET' : 'NOT SET',
    DRAGONFLY_URL: process.env.DRAGONFLY_URL ? 'SET' : 'NOT SET',
  };

  res.status(200).json({
    message: 'Environment Variables Test',
    variables: envVars,
    publicKeyLength: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length || 0,
    publicKeyPreview: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) || 'NOT FOUND'
  });
}