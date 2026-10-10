module.exports = {
  apps: [
    // 1. Go High-Performance Microservice (Port 8080)
    {
      name: 'thoen-go-backend',
      script: './thoen-backend.exe',
      cwd: './backend-go',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '150M',
      env: {
        PORT: 8080,
        GIN_MODE: 'release'
      }
    },
    // 2. Next.js Web Application (Port 6060)
    {
      name: 'thoen-hospital-website',
      script: './node_modules/next/dist/bin/next',
      args: 'start --hostname 0.0.0.0 --port 6060',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};