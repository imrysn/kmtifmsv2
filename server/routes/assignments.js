const express = require('express');
const router = express.Router();

router.use(require('./assignments/coreController'));
router.use(require('./assignments/actionController'));
router.use(require('./assignments/commentController'));
router.use(require('./assignments/attachmentController'));

module.exports = router;