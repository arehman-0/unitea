/**
 * UniTea - Decentralized Trust System for Anonymous Campus Rumors
 *
 * A self-correcting trust system using:
 * - Blind Signatures for anonymous authentication
 * - Quality Repository Approach (QRA) for malicious user detection
 * - Mean Bisector Analysis for dynamic thresholds
 * - LSI for semantic feedback analysis
 *
 * @version 1.0.0
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const constants = require('./config/constants');

// Initialize data directory
const dataDir = path.resolve(constants.DATA_DIR);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

// Import routes
const authRoutes = require('./routes/auth');
const rumorRoutes = require('./routes/rumors');
const adminRoutes = require('./routes/admin');

// Import scheduled jobs
const auditLoop = require('./jobs/auditLoop');
const archiver = require('./jobs/archiver');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
app.use('/auth', authRoutes);
app.use('/rumors', rumorRoutes);
app.use('/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'UniTea',
    version: '1.0.0',
    description: 'Decentralized trust system for anonymous campus rumors',
    features: [
      'Blind Signature Authentication',
      'Quality Repository Approach (QRA)',
      'Mean Bisector Analysis',
      'Latent Semantic Indexing',
      'Anti-Collusion Detection'
    ],
    endpoints: {
      auth: '/auth',
      rumors: '/rumors',
      status: '/admin/status'
    },
    documentation: 'See API documentation for detailed endpoint information'
  });
});

// Status endpoint (shortcut)
app.get('/status', (req, res) => {
  res.redirect('/admin/status');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = constants.PORT;

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   ██╗   ██╗███╗   ██╗██╗████████╗███████╗ █████╗         ║');
  console.log('║   ██║   ██║████╗  ██║██║╚══██╔══╝██╔════╝██╔══██╗        ║');
  console.log('║   ██║   ██║██╔██╗ ██║██║   ██║   █████╗  ███████║        ║');
  console.log('║   ██║   ██║██║╚██╗██║██║   ██║   ██╔══╝  ██╔══██║        ║');
  console.log('║   ╚██████╔╝██║ ╚████║██║   ██║   ███████╗██║  ██║        ║');
  console.log('║    ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝        ║');
  console.log('║                                                           ║');
  console.log('║   Decentralized Trust System for Anonymous Campus Rumors  ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('API Endpoints:');
  console.log('  GET  /                    - API info');
  console.log('  GET  /status              - System status');
  console.log('  ');
  console.log('  Auth:');
  console.log('  GET  /auth/public-key     - Get server public key');
  console.log('  POST /auth/blind-sign     - Sign blinded token');
  console.log('  POST /auth/register-token - Register token');
  console.log('  ');
  console.log('  Rumors:');
  console.log('  POST /rumors              - Create rumor');
  console.log('  GET  /rumors              - List rumors');
  console.log('  GET  /rumors/:id          - Get rumor details');
  console.log('  POST /rumors/:id/vote     - Vote on rumor');
  console.log('  ');
  console.log('  Admin:');
  console.log('  GET  /admin/status        - Full system status');
  console.log('  POST /admin/audit/trigger - Trigger audit');
  console.log('');

  // Schedule jobs
  console.log('Scheduling jobs...');
  auditLoop.scheduleAuditLoop();
  archiver.scheduleArchiver();
  console.log('');
  console.log('UniTea is ready!');
  console.log('');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down UniTea...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down UniTea...');
  process.exit(0);
});

module.exports = app;
