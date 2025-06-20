#!/bin/bash

# Change to the project directory
cd "$(dirname "$0")/.."

# Restart the application with PM2
pm2 restart lc-opd-daily 