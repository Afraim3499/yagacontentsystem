const { Client } = require('ssh2');

// Load repo-root .env (gitignored via *.env/*.env.* in .gitignore) if
// present, so neither the VPS SSH password nor the bot token being pushed
// have to be hardcoded — see audit-2026/findings/06-security.md (in the
// main yagacalls.com repo) for why this changed.
try {
  process.loadEnvFile();
} catch {
  // No .env file found — the explicit checks below report clearly either way.
}

const VPS_SSH_PASSWORD = process.env.VPS_SSH_PASSWORD;
const TELEGRAM_CONCIERGE_BOT_TOKEN = process.env.TELEGRAM_CONCIERGE_BOT_TOKEN;

if (!VPS_SSH_PASSWORD || !TELEGRAM_CONCIERGE_BOT_TOKEN) {
  console.error(
    'Missing VPS_SSH_PASSWORD and/or TELEGRAM_CONCIERGE_BOT_TOKEN. Set both ' +
    'in a repo-root .env file (gitignored) or as environment variables before ' +
    'running this script. Both were previously hardcoded in this file and ' +
    'committed to git history.'
  );
  process.exit(1);
}

const conn = new Client();

console.log('🚀 Connecting to VPS to update environment variables...');

conn.on('ready', () => {
  console.log('✅ SSH Connection established.');

  const command = `
    # Ensure variable is not duplicated, then append
    if ! grep -q "TELEGRAM_CONCIERGE_BOT_TOKEN" /var/www/yagacontentsystem/.env; then
      echo "TELEGRAM_CONCIERGE_BOT_TOKEN=${TELEGRAM_CONCIERGE_BOT_TOKEN}" >> /var/www/yagacontentsystem/.env
      echo "Added token to .env"
    else
      # Overwrite existing
      sed -i 's/TELEGRAM_CONCIERGE_BOT_TOKEN=.*/TELEGRAM_CONCIERGE_BOT_TOKEN=${TELEGRAM_CONCIERGE_BOT_TOKEN}/' /var/www/yagacontentsystem/.env
      echo "Updated token in .env"
    fi
    
    # Delete old process name and start new one
    pm2 delete yaga-concierge-bot || true
    cd /var/www/yagacontentsystem && pm2 start concierge_bot_engine.js --name yaga-client-relation-bot
    pm2 save
  `;

  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('Execution error:', err);
      conn.end();
      return;
    }

    stream.on('close', (code) => {
      console.log(`\n🎉 VPS Environment Update Complete! (Exit Code: ${code})`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('❌ SSH Connection Failed:', err.message);
}).connect({
  host: process.env.VPS_HOST || '167.86.76.229',
  port: 22,
  username: process.env.VPS_USER || 'root',
  password: VPS_SSH_PASSWORD,
  readyTimeout: 30000
});
