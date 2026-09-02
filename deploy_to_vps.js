const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const SSH_CONFIG = conn.connect({
  host: '167.86.76.229',
  port: 22,
  username: 'root',
  password: 'Rizwan34'
});

console.log("=== PUSHING UPDATES TO LIVE VPS (167.86.76.229) ===");
