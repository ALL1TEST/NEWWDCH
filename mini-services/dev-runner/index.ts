import { spawn } from 'child_process';

function startServer() {
  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: '3000' },
  });

  server.on('close', (code) => {
 console.log(`Server exited with code ${code}. Restarting in 2s...`);
    setTimeout(startServer, 2000);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    setTimeout(startServer, 2000);
  });
}

startServer();
