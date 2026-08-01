// ====================================================================
// MONOREPO MIGRATION SCRIPT — MERGE OPERATIONS INTO F:\kalababas
// ====================================================================

const fs = require('fs');
const path = require('path');

const SRC_DIR = 'd:\\yagacallls content operation';
const DEST_DIR = 'F:\\kalababas';

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (childItemName === 'node_modules' || childItemName === '.git' || childItemName === '.system_generated' || childItemName === 'dist') return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('🚀 Migrating Content Operations System into F:\\kalababas...');

// 1. Create subdirectories
const opsCrmDir = path.join(DEST_DIR, 'operations-crm');
const botEngineDir = path.join(DEST_DIR, 'services', 'bot-engine');
const docsDir = path.join(DEST_DIR, 'docs');
const deployDir = path.join(DEST_DIR, 'deploy');

fs.mkdirSync(opsCrmDir, { recursive: true });
fs.mkdirSync(botEngineDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(deployDir, { recursive: true });

// 2. Copy CRM App
console.log('📦 [1/4] Copying CRM Web App to F:\\kalababas\\operations-crm...');
copyRecursiveSync(path.join(SRC_DIR, 'crm-app'), opsCrmDir);

// 3. Copy Bot Engine & Database Scripts
console.log('🤖 [2/4] Copying Bot Engine & DB Migration scripts to F:\\kalababas\\services\\bot-engine...');
const botFiles = [
  'bot_engine.js',
  'bot_engine_serverless.js',
  'update_schema_v3.js',
  'update_schema_v4.js',
  'update_schema_v5.js',
  'supabase_schema.sql',
  'package.json',
  'package-lock.json',
  '.env'
];

botFiles.forEach(file => {
  const srcFile = path.join(SRC_DIR, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(botEngineDir, file));
  }
});

// 4. Copy Documentation Suite
console.log('📑 [3/4] Copying Documentation Suite to F:\\kalababas\\docs...');
const docFiles = [
  '01_TEAM_MEMBER_GUIDE.md',
  '02_OWNERS_OPERATIONAL_GUIDE.md',
  '03_CHIEF_SYSTEM_ENGINEER_RUNBOOK.md',
  'engineering.md',
  'instructions.md'
];

docFiles.forEach(file => {
  const srcFile = path.join(SRC_DIR, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(docsDir, file));
  }
});

// 5. Create Master PM2 Ecosystem & Nginx Configs
console.log('⚙️ [4/4] Generating Master PM2 Ecosystem & Nginx Production Configs...');

const pm2Ecosystem = `
module.exports = {
  apps: [
    {
      name: 'yagacalls-website',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/kalababas',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'yaga-bot-engine',
      script: 'bot_engine.js',
      cwd: '/var/www/kalababas/services/bot-engine',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
`;

const nginxConfig = `
# ====================================================================
# MASTER NGINX REVERSE PROXY CONFIGURATION FOR YAGACALLS ECOSYSTEM
# Domain: yagacalls.com | Server IP: 104.234.134.236
# ====================================================================

# 1. Main Next.js Website (yagacalls.com)
server {
    listen 80;
    server_name yagacalls.com www.yagacalls.com 104.234.134.236;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Operations CRM Portal (crm.yagacalls.com)
server {
    listen 80;
    server_name crm.yagacalls.com;

    location / {
        root /var/www/kalababas/operations-crm/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

# 3. Self-Hosted n8n Workflow Automation (n8n.yagacalls.com)
server {
    listen 80;
    server_name n8n.yagacalls.com;

    location / {
        proxy_pass http://127.0.0.1:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

fs.writeFileSync(path.join(deployDir, 'pm2-ecosystem.config.js'), pm2Ecosystem.trim());
fs.writeFileSync(path.join(deployDir, 'nginx-yagacalls.conf'), nginxConfig.trim());

console.log('\n====================================================');
console.log('🎉 MONOREPO MIGRATION COMPLETED CLEANLY!');
console.log('====================================================');
console.log('📁 Main Next.js Site:       F:\\kalababas\\app');
console.log('📁 Operations CRM:          F:\\kalababas\\operations-crm');
console.log('📁 Bot Engine Service:      F:\\kalababas\\services\\bot-engine');
console.log('📁 System Documentation:    F:\\kalababas\\docs');
console.log('📁 PM2 & Nginx Deployment:  F:\\kalababas\\deploy');
console.log('====================================================\n');
