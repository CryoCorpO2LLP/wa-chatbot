export default {
  apps: [{
    name: 'cryocorp-bot',
    script: './bot.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '512M',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.wwebjs_auth'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}