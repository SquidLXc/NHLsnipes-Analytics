// PM2 Configuration - The ONLY file you need
module.exports = {
  apps: [
    // API Server - runs the built file directly
    {
      name: 'nhl-api',
      script: './artifacts/api-server/dist/index.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
      },
      autorestart: true,
      watch: false,
    },
    // Frontend - needs pnpm dev for hot reload
    {
      name: 'nhl-frontend',
      script: 'pnpm',
      args: '--filter @workspace/nhlsnipes run dev',
      cwd: __dirname,
      autorestart: true,
      watch: false,
    },
    // Ngrok tunnel
    {
      name: 'nhl-ngrok',
      script: 'C:\\Users\\jcsqu\\ngrok\\ngrok.exe',
      args: 'http 23191 --log=stdout',
      cwd: __dirname,
      autorestart: true,
      watch: false,
    },
  ],
};
