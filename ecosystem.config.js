module.exports = {
  apps: [
    {
      name: 'thoen-hospital-website',
      // Runs the Next.js production server binary directly
      script: './node_modules/next/dist/bin/next',
      args: 'start --hostname 192.168.1.142 --port 6060',
      instances: 'max',       // Run in cluster mode to utilize all CPU cores
      exec_mode: 'cluster',    // Enables load balancing across instances
      watch: false,            // Do not watch files in production
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
