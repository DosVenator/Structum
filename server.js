// server.js
const express = require('express');
const path = require('path');

const app = express();

// Railway/Proxy
app.set('trust proxy', 1);

// JSON/Forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck (чтобы Railway видел что сервер жив)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// PORT from Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
});