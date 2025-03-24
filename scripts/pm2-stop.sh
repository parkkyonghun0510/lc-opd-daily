#!/bin/bash

# Change to the project directory
cd "$(dirname "$0")/.."

# Stop the application with PM2
pm2 stop lc-opd-daily 