#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, 'website', 'dist');

const server = http.createServer((req, res) => {
  // Remove query parameters for file lookup
  const urlPath = req.url.split('?')[0];

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  try {
    // Check if directory
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Try with trailing slash
      const dirPath = path.join(filePath, 'index.html');
      try {
        fs.statSync(dirPath);
        filePath = dirPath;
      } catch (dirError) {
        res.writeHead(404);
        res.end('404 Not Found', 'utf-8');
        return;
      }
    } else {
      res.writeHead(500);
      res.end('Server Error: ' + error.code, 'utf-8');
      return;
    }
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Server Error: ' + error.code, 'utf-8');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[extname] || 'text/html' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n✓ Preview server running at http://localhost:${PORT}/previews/maciej-misnik/`);
  console.log(`  Open in browser\n`);
});