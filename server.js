const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');

const app = express();

// 📁 Статика
app.use(express.static(path.join(__dirname, 'public')));

// 🏠 Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔐 HTTPS
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000, '0.0.0.0', () => {
  console.log('✅ HTTPS сервер запущен: https://localhost:3000');
});