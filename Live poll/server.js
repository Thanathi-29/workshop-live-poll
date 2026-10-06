const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Find local IPv4 Wi-Fi / Ethernet address
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function createServer(port) {
  const server = http.createServer((req, res) => {
    const reqUrl = req.url.split('?')[0];

    // API endpoint to give the browser the local IP address for phone QR codes
    if (reqUrl === '/api/ip') {
      const ip = getLocalIp();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ ip, port: port, voteUrl: `http://${ip}:${port}/vote.html` }));
      return;
    }

    // Resolve static file path
    let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : reqUrl);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        filePath = path.join(__dirname, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server Error');
        } else {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
          });
          res.end(content);
        }
      });
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      createServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    const ip = getLocalIp();
    console.log('\n==================================================');
    console.log('🚀 LIVE POLL SERVER IS READY!');
    console.log('==================================================');
    console.log(`💻 Presenter Screen (Laptop) : http://localhost:${port}/board.html`);
    if (ip !== 'localhost') {
      console.log(`📱 Phone Voting Link (Wi-Fi) : http://${ip}:${port}/vote.html`);
    }
    console.log('==================================================\n');
  });
}

createServer(PORT);
