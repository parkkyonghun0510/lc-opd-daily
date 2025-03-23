# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment to AWS Lightsail.

## Available Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)

This workflow handles the complete CI/CD process for the main branches (main/master).

**Triggers:**
- Push to main/master branches
- Pull requests to main/master branches

**Jobs:**
- `test-and-build`: Runs tests, linting, type checking, and builds the application
- `deploy`: Deploys the application to AWS Lightsail (only on push to main/master)

### 2. Run Tests (`test.yml`)

This workflow runs tests for all branches.

**Triggers:**
- Push to any branch
- Pull requests to any branch

**Jobs:**
- `test`: Runs linting and type checking

## Environment Variables

The following environment variables must be set as GitHub repository secrets:

- `DATABASE_URL`: Connection string for the database
- `NEXTAUTH_SECRET`: Secret key for NextAuth.js
- `NEXTAUTH_URL`: URL for NextAuth.js
- `REDIS_URL`: Connection string for Redis

## AWS Lightsail Deployment Configuration

For deployment to AWS Lightsail with Apache, the following secrets are required:

- `SSH_PRIVATE_KEY`: The private SSH key to access your Lightsail instance
- `KNOWN_HOSTS`: The SSH known_hosts content for your Lightsail instance
- `SSH_USER`: The username to SSH into your Lightsail instance
- `SSH_HOST`: The hostname or IP address of your Lightsail instance

### Deployment Process

The deployment workflow:

1. Builds the Next.js application
2. Creates a deployment package with all necessary files
3. Transfers the package to your AWS Lightsail instance
4. Extracts files to the Apache web directory
5. Installs production dependencies
6. Configures and starts the application using PM2
7. Sets appropriate permissions for Apache

### Server Setup Requirements

Your AWS Lightsail instance should have:

- Node.js 18 or later installed
- PM2 for process management: `npm install -g pm2`
- Apache configured with a virtual host for your application
- Proper permissions for the deployment user to update web files

### Testing the Deployment

After the workflow runs, you can verify the deployment by:

1. Checking the GitHub Actions logs for any errors
2. Accessing your application at the configured domain/IP
3. Running `pm2 status` on your Lightsail instance to check the application status 