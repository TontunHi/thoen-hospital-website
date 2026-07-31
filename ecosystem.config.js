module.exports = {
  apps: [
    {
      name: 'thoen-hospital-website',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false
    }
  ]
}
