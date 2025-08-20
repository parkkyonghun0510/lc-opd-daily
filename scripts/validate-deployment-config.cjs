#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, fileName) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${fileName} exists`, 'green');
    return true;
  }
  log(`❌ ${fileName} not found`, 'red');
  return false;
}

function validateNextConfig() {
  log('\n--- Validating next.config.ts ---', 'bright');
  const nextConfigPath = path.join(projectRoot, 'next.config.ts');
  if (!checkFileExists(nextConfigPath, 'next.config.ts')) return false;

  const content = fs.readFileSync(nextConfigPath, 'utf8');
  let success = true;

  if (content.includes("output: 'standalone'")) {
    log('✅ `output: \'standalone\'` is set', 'green');
  } else {
    log('❌ `output: \'standalone\'` is not set', 'red');
    success = false;
  }

  if (content.includes("serverExternalPackages: ['ioredis']")) {
    log("✅ `serverExternalPackages: ['ioredis']` is set", 'green');
  } else {
    log("❌ `serverExternalPackages: ['ioredis']` is not set", 'red');
    success = false;
  }

  return success;
}

function validateDockerfile() {
  log('\n--- Validating Dockerfile ---', 'bright');
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  if (!checkFileExists(dockerfilePath, 'Dockerfile')) return false;

  const content = fs.readFileSync(dockerfilePath, 'utf8');
  let success = true;

  if (content.includes('RUN npx prisma generate')) {
    log('✅ `RUN npx prisma generate` is present', 'green');
  } else {
    log('❌ `RUN npx prisma generate` is missing', 'red');
    success = false;
  }

  if (content.includes('RUN npm run build:production')) {
    log('✅ `RUN npm run build:production` is present', 'green');
  } else {
    log('❌ `RUN npm run build:production` is missing', 'red');
    success = false;
  }

  if (content.includes('CMD ["./scripts/start-pm2.sh"]')) {
    log('✅ `CMD ["./scripts/start-pm2.sh"]` is present', 'green');
  } else {
    log('❌ `CMD ["./scripts/start-pm2.sh"]` is missing', 'red');
    success = false;
  }

  return success;
}

function validateRailwayJson() {
  log('\n--- Validating railway.json ---', 'bright');
  const railwayJsonPath = path.join(projectRoot, 'railway.json');
  if (!checkFileExists(railwayJsonPath, 'railway.json')) return false;

  const content = fs.readFileSync(railwayJsonPath, 'utf8');
  const config = JSON.parse(content);
  let success = true;

  if (config.build?.builder === 'DOCKERFILE') {
    log('✅ `build.builder` is set to `DOCKERFILE`', 'green');
  } else {
    log('❌ `build.builder` is not set to `DOCKERFILE`', 'red');
    success = false;
  }

  if (config.deploy?.startCommand === './scripts/start-pm2.sh') {
    log('✅ `deploy.startCommand` is set to `./scripts/start-pm2.sh`', 'green');
  } else {
    log('❌ `deploy.startCommand` is not set to `./scripts/start-pm2.sh`', 'red');
    success = false;
  }

  return success;
}

function validateEcosystemConfig() {
    log('\n--- Validating ecosystem.production.config.cjs ---', 'bright');
    const configPath = path.join(projectRoot, 'ecosystem.production.config.cjs');
    if (!checkFileExists(configPath, 'ecosystem.production.config.cjs')) return false;

    const config = require(configPath);
    let success = true;

    const app = config.apps.find(app => app.name === 'lc-opd-daily');
    if (app) {
        if (app.script === 'server.js') {
            log('✅ `script` is set to `server.js` for `lc-opd-daily` app', 'green');
        } else {
            log('❌ `script` is not set to `server.js` for `lc-opd-daily` app', 'red');
            success = false;
        }
    } else {
        log('❌ `lc-opd-daily` app not found in ecosystem.production.config.cjs', 'red');
        success = false;
    }

    const worker = config.apps.find(app => app.name === 'notification-worker');
    if (worker) {
        if (worker.script === 'dist/workers/dragonfly-worker.js') {
            log('✅ `script` is set to `dist/workers/dragonfly-worker.js` for `notification-worker` app', 'green');
        } else {
            log('❌ `script` is not set to `dist/workers/dragonfly-worker.js` for `notification-worker` app', 'red');
            success = false;
        }
    } else {
        log('❌ `notification-worker` app not found in ecosystem.production.config.cjs', 'red');
        success = false;
    }

    return success;
}


function main() {
  log('🚀 Starting Deployment Configuration Validation Script', 'bright');
  log('='.repeat(60));

  const results = [
    validateNextConfig(),
    validateDockerfile(),
    validateRailwayJson(),
    validateEcosystemConfig(),
  ];

  log('\n' + '='.repeat(60));
  if (results.every(Boolean)) {
    log('🎉 All deployment configuration checks passed successfully!', 'green');
  } else {
    log('❌ Some deployment configuration checks failed. Please review the logs above.', 'red');
    process.exit(1);
  }
}

main();