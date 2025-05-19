module.exports = {
  apps: [{
    name: 'sunshine-cowhides',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '800M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'cache'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};