// scripts/setup-cron.js
const fs = require('fs');
const path = require('path');

// Criar arquivo de configuração do cron para Render
const cronConfig = `
# Sync with Google Drive every 6 hours
0 */6 * * * cd /opt/render/project/src && node scripts/sync-drive-webp.js >> /opt/render/project/logs/sync.log 2>&1

# Cache cleanup daily at 3 AM
0 3 * * * cd /opt/render/project/src && node scripts/cache-cleanup.js >> /opt/render/project/logs/cleanup.log 2>&1

# Generate cache stats every hour
0 * * * * cd /opt/render/project/src && node scripts/cache-stats.js >> /opt/render/project/logs/stats.log 2>&1
`;

console.log('📋 Cron configuration for Render:');
console.log(cronConfig);

// Se estiver rodando localmente, criar arquivo de exemplo
if (process.env.NODE_ENV !== 'production') {
  const cronFile = path.join(__dirname, 'render-cron.example');
  fs.writeFileSync(cronFile, cronConfig);
  console.log(`\n✅ Example cron file created at: ${cronFile}`);
}