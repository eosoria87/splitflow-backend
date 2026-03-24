const express = require('express');
const cors = require('cors');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const app = express();

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({ 
    message: 'SplitFlow API',
    version: '1.0.0'
  });
});

// Swagger: spec JSON
app.get('/api/docs/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

// Swagger: UI via CDN (works in Vercel serverless)
app.get('/api/docs', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>SplitFlow API Docs</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function() {
        SwaggerUIBundle({
          url: '/api/docs/swagger.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout'
        });
      }
    </script>
  </body>
</html>`);
});

// Auth routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Group routes
const groupRoutes = require('./routes/group.routes');
app.use('/api/groups', groupRoutes);

// ========================================
// ERROR HANDLERS
// ========================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path 
  });
});

// Global Error Handler
const ApiError = require('./utils/ApiError');

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      timestamp: err.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ========================================
// START SERVER
// ========================================

// Only start the HTTP server when running directly (not in serverless environments like Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 SplitFlow API running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;