const { Client } = require('ssh2');
const conn = new Client();

console.log('🚀 Connecting to VPS to update environment variables...');

conn.on('ready', () => {
  console.log('✅ SSH Connection established.');

  const command = `
    # Ensure variable is not duplicated, then append
    if ! grep -q "TELEGRAM_CONCIERGE_BOT_TOKEN" /var/www/yagacontentsystem/.env; then
      echo "TELEGRAM_CONCIERGE_BOT_TOKEN=8821931231:AAF43WpD1m-7RqJLKwnwltuiWwCTBTiQ6gM" >> /var/www/yagacontentsystem/.env
      echo "Added token to .env"
    else
      # Overwrite existing
      sed -i 's/TELEGRAM_CONCIERGE_BOT_TOKEN=.*/TELEGRAM_CONCIERGE_BOT_TOKEN=8821931231:AAF43WpD1m-7RqJLKwnwltuiWwCTBTiQ6gM/' /var/www/yagacontentsystem/.env
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
  host: '104.234.134.236',
  port: 22,
  username: 'root',
  password: 'Rizwan@34',
  readyTimeout: 30000
});
