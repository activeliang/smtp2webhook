#!/bin/sh
set -e

if [ ! -f /app/log/email.log ]; then
  touch /app/log/email.log
fi

# cd /app && yarn install
node /app/src/app.js