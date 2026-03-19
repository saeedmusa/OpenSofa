module.exports = {
  apps: [
    {
      name: 'opensofa',
      script: 'dist/main.js',
      node_args: '--max-old-space-size=512',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      listen_timeout: 10000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
