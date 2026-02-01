const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  timeout: 2000,
  path: '/healthz'
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1); 
  }
});

request.on('error', (err) => {
  console.log(`ERROR: ${err.message}`);
  process.exit(1);
});

request.end();