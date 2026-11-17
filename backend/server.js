require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Basic abuse protection on the credential endpoints.
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('[config] JWT_SECRET is missing. Copy .env.example to backend/.env first.');
    process.exit(1);
  }
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('[db] could not connect:', err.message);
      process.exit(1);
    });
}

module.exports = app;
