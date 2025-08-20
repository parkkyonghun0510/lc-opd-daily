// Debug page to check environment variables in the browser
import { useEffect, useState } from 'react';
import { EnvironmentValidator } from '../src/lib/env-validator';

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function DebugEnv() {
  const [envData, setEnvData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    // Check what environment variables are available in the browser
    const browserEnv = {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'NOT FOUND',
      // Note: Private env vars won't be available in browser
    };

    // Test the validator
    const validator = EnvironmentValidator.getInstance();
    validator.clearCache(); // Clear any cached results
    const result = validator.validateEnvironment();

    setEnvData(browserEnv);
    setValidationResult(result);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Environment Debug Page</h1>
      
      <h2>Browser Environment Variables:</h2>
      <pre>{JSON.stringify(envData, null, 2)}</pre>
      
      <h2>Validation Result:</h2>
      <pre>{JSON.stringify(validationResult, null, 2)}</pre>
      
      <h2>Environment Variable Details:</h2>
      <p>NEXT_PUBLIC_VAPID_PUBLIC_KEY length: {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length || 0}</p>
      <p>First 20 characters: {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) || 'NOT FOUND'}</p>
    </div>
  );
}