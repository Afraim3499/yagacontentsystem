// ====================================================================
// YAGA CALLS OPERATIONS SYSTEM — AUTOMATED VPS PROVISIONING SCRIPT v2.0
// Target Host: 104.234.134.236 (CentOS / AlmaLinux / Ubuntu compatible)
// ====================================================================

const { Client } = require('ssh2');

const VPS_HOST = '104.234.134.236';
const VPS_USER = 'root';
const VPS_PASS = 'Rizwan@34';
const BOT_TOKEN = '8446355677:AAGln29V9MXOifeJc5NBZT0Dn68Z8innrQw';

const conn = new Client();

function executeCommand(ssh, command) {
  return new Promise((resolve, reject) => {
    console.log(`\n💻 EXEC: ${command}`);
    ssh.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';

      stream.on('close', (code, signal) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          console.log(`   OUT: ${stdout}`);
          console.error(`   ERR: ${stderr}`);
          resolve(stdout + '\n' + stderr);
        }
      }).on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data.toString());
      });
    });
  });
}

console.log('🚀 CONNECTING TO VPS SERVER (104.234.134.236)...');

conn.on('ready', async () => {
  console.log('✅ SSH CONNECTION ESTABLISHED TO VPS!');

  try {
    // Check OS
    const osRelease = await executeCommand(conn, 'cat /etc/os-release');
    console.log('🐧 OS INFRASTRUCTURE DETECTED:\n' + osRelease);

    const isRhel = osRelease.includes('AlmaLinux') || osRelease.includes('CentOS') || osRelease.includes('Rocky') || osRelease.includes('Fedora');

    if (isRhel) {
      console.log('\n📦 [1/6] Installing packages via DNF/YUM (RHEL/AlmaLinux)...');
      await executeCommand(conn, 'dnf install -y epel-release || yum install -y epel-release');
      await executeCommand(conn, 'dnf install -y git curl nginx certbot python3-certbot-nginx || yum install -y git curl nginx certbot');
      await executeCommand(conn, 'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -');
      await executeCommand(conn, 'dnf install -y nodejs || yum install -y nodejs');
    } else {
      console.log('\n📦 [1/6] Installing packages via APT (Ubuntu/Debian)...');
      await executeCommand(conn, 'apt-get update -y && apt-get install -y curl git nginx ufw certbot python3-certbot-nginx');
      await executeCommand(conn, 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -');
      await executeCommand(conn, 'apt-get install -y nodejs');
    }

    // Install PM2
    console.log('\n🟢 [2/6] Installing PM2 Process Manager...');
    await executeCommand(conn, 'npm install -g pm2');

    // Clone Repo
    console.log('\n📂 [3/6] Deploying codebase to /var/www/yagacontentsystem...');
    await executeCommand(conn, 'mkdir -p /var/www');
    await executeCommand(conn, 'rm -rf /var/www/yagacontentsystem');
    await executeCommand(conn, 'git clone https://github.com/Afraim3499/yagacontentsystem.git /var/www/yagacontentsystem');

    // Set .env
    console.log('\n🔑 [4/6] Setting environment variables & installing npm dependencies...');
    await executeCommand(conn, `echo "TELEGRAM_BOT_TOKEN=${BOT_TOKEN}" > /var/www/yagacontentsystem/.env`);
    await executeCommand(conn, 'cd /var/www/yagacontentsystem && npm install');

    // Start PM2
    console.log('\n🤖 [5/6] Launching Telegram Bot Engine 24/7 via PM2...');
    await executeCommand(conn, 'pm2 delete yaga-bot || true');
    await executeCommand(conn, 'cd /var/www/yagacontentsystem && pm2 start bot_engine.js --name yaga-bot');
    await executeCommand(conn, 'pm2 save');
    await executeCommand(conn, 'pm2 startup || true');

    // Configure Nginx & System Services
    console.log('\n🌐 [6/6] Starting Nginx Web Server...');
    await executeCommand(conn, 'systemctl enable nginx && systemctl restart nginx');

    console.log('\n====================================================');
    console.log('🎉 VPS PROVISIONING COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
    console.log('• Telegram Bot Engine: LIVE 24/7/365 under PM2 (yaga-bot)');
    console.log('• Server IP: http://104.234.134.236');
    console.log('====================================================\n');

  } catch (err) {
    console.error('VPS Deployment Error:', err);
  } finally {
    conn.end();
  }
}).on('error', (err) => {
  console.error('SSH Connection Error:', err.message);
}).connect({
  host: VPS_HOST,
  port: 22,
  username: VPS_USER,
  password: VPS_PASS,
  readyTimeout: 30000
});
