module.exports = {
  apps: [
    {
      name: 'groupware-backend',
      cwd: 'C:/groupware/backend',
      script: 'server.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: 'C:/groupware/logs/backend-error.log',
      out_file:   'C:/groupware/logs/backend-out.log',
      time: true
    },
    {
      name: 'groupware-frontend',
      cwd: 'C:/groupware/frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--port 3000 --host',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: 'C:/groupware/logs/frontend-error.log',
      out_file:   'C:/groupware/logs/frontend-out.log',
      time: true
    }
  ]
};
