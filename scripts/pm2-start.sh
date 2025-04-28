#!/bin/bash

# Change to the project directory
cd "$(dirname "$0")/.."

# Start the application with PM2
pm2 start ecosystem.config.cjs 