# Tests Directory

This directory contains various tests for the LC-OPD-Daily application.

## Directory Structure

- `/api` - API tests for authentication and other endpoints
- `/sse` - Server-Sent Events (SSE) tests for real-time communication
- `/workflow` - Tests for various workflow processes in the application

## Running Tests

To run specific tests, use the scripts in the `scripts/test` directory:

```bash
# Run API tests
npm run test:api

# Run SSE tests
npm run test:sse

# Run workflow tests
npm run test:workflow
```

## Adding New Tests

When adding new tests, please follow these guidelines:

1. Place tests in the appropriate subdirectory based on functionality
2. Follow the naming convention: `test-[feature].js`
3. Add a brief description at the top of each test file
4. Update this README if you add a new test category
