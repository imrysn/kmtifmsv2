const express = require('express');
const router = express.Router();
const performanceMonitor = require('../middleware/performanceMonitor');
const response = require('../utils/responseFormatter');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Apply authentication and ADMIN role to all routes in this router
router.use(authenticateToken);
router.use(authorizeRole('ADMIN'));

/**
 * Get performance metrics
 * GET /api/metrics/performance
 */
router.get('/performance', (req, res) => {
    const metrics = performanceMonitor.getMetrics();
    res.json(response.success(metrics, 'Performance metrics retrieved'));
});

module.exports = router;
