const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const SSH_CONFIG = {
  host: '104.234.134.236',
  port: 22,
  username: 'root',
  // Reading root SSH key or password if present, fallback to command execution
};

console.log("=== PUSHING UPDATES TO LIVE VPS (104.234.134.236) ===");
