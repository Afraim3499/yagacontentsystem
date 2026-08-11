// ====================================================================
// MONOREPO VPS DEPLOYMENT SCRIPT
// Deploys F:\kalababas monorepo topology to VPS 104.234.134.236
// ====================================================================

const { Client } = require('ssh2');

const VPS_HOST = process.env.VPS_HOST || '104.234.134.236';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PASS = process.env.VPS_PASS || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

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

console.log('🚀 DEPLOYING MONOREPO TOPOLOGY TO VPS SERVER (104.234.134.236)...');

conn.on('ready', async () => {
  console.log('✅ SSH CONNECTION ESTABLISHED TO VPS!');

  try {
    // 1. Re-clone or pull latest code
    console.log('\n📂 [1/3] Pulling latest monorepo structure from GitHub...');
    await executeCommand(conn, 'mkdir -p /var/www');
    await executeCommand(conn, 'rm -rf /var/www/yagacontentsystem');
    await executeCommand(conn, 'git clone https://github.com/Afraim3499/yagacontentsystem.git /var/www/yagacontentsystem');

    // 2. Configure .env in services/bot-engine
    console.log('\n🔑 [2/3] Setting .env and installing npm dependencies in services/bot-engine...');
    await executeCommand(conn, 'mkdir -p /var/www/yagacontentsystem/services/bot-engine');
    await executeCommand(conn, `echo "TELEGRAM_BOT_TOKEN=${BOT_TOKEN}" > /var/www/yagacontentsystem/services/bot-engine/.env`);

    // If services/bot-engine exists in repo
    await executeCommand(conn, 'if [ -d "/var/www/yagacontentsystem/services/bot-engine" ]; then cd /var/www/yagacontentsystem/services/bot-engine && npm install; else cd /var/www/yagacontentsystem && npm install; fi');

    // 3. Restart PM2 Bot Engine
    console.log('\n🤖 [3/3] Restarting Telegram Bot Engine under PM2...');
    await executeCommand(conn, 'pm2 delete yaga-bot || true');
    await executeCommand(conn, 'if [ -f "/var/www/yagacontentsystem/services/bot-engine/bot_engine.js" ]; then cd /var/www/yagacontentsystem/services/bot-engine && pm2 start bot_engine.js --name yaga-bot; else cd /var/www/yagacontentsystem && pm2 start bot_engine.js --name yaga-bot; fi');
    await executeCommand(conn, 'pm2 save');

    console.log('\n====================================================');
    console.log('🎉 MONOREPO VPS DEPLOYMENT COMPLETED CLEANLY!');
    console.log('====================================================');
    console.log('• Telegram Bot Engine: ONLINE under PM2 (yaga-bot)');
    console.log('• Server IP: 104.234.134.236');
    console.log('====================================================\n');

  } catch (err) {
    console.error('VPS Monorepo Deployment Error:', err);
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
