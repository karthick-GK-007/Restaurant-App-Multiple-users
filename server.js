// Simple Node.js server for kagzso URL routing
// Run with: node server.js
// Then access: http://localhost:8000/kagzso/admin/suganya/madurai

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const BASE_DIR = __dirname;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Handle kagzso routing - serve the appropriate HTML file
    // Client-side routing will handle the path parsing
    if (pathname.startsWith('/kagzso/admin/')) {
        // Serve admin.html - client-side code will parse the pathname
        const filePath = path.join(BASE_DIR, 'admin.html');
        serveFile(filePath, res);
        return;
    } else if (pathname.startsWith('/kagzso/user/')) {
        // Serve index.html - client-side code will parse the pathname
        const filePath = path.join(BASE_DIR, 'index.html');
        serveFile(filePath, res);
        return;
    }

    // Default: serve static files
    if (pathname === '/') {
        pathname = '/index.html';
    }

    const filePath = path.join(BASE_DIR, pathname);
    serveFile(filePath, res);
});


function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log(`📝 Kagzso URLs:`);
    console.log(`   Admin: http://localhost:${PORT}/kagzso/admin/{hotel}/{branch}`);
    console.log(`   User:  http://localhost:${PORT}/kagzso/user/{hotel}/{branch}`);
});

