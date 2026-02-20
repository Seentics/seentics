const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/v1/heatmaps/bulk-delete',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Assuming development environment allows some bypass or we can test this.
    // Wait, the API might be protected. I will use the frontend's Delete feature instead.
  }
};
