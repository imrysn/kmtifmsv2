const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { db } = require('../config/database');
const { upload, uploadsDir, moveToUserFolder } = require('../config/middleware');
const { logActivity, logFileStatusChange } = require('../utils/logger');
const { getFileTypeDescription } = require('../utils/fileHelpers');
const { safeDeleteFile } = require('../utils/fileUtils');
const { createNotification, createAdminNotification } = require('./notifications');
const { syncDeletedFiles } = require('../services/fileSyncService');
const { networkDataPath } = require('../config/database');

const router = express.Router();

router.use(require('./files/uploadController'));
router.use(require('./files/reviewController'));
router.use(require('./files/downloadController'));
router.use(require('./files/managementController'));

module.exports = router;