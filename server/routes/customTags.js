const express = require('express');
const { USE_MYSQL } = require('../config/database');

const router = express.Router();

// Get database connection based on mode
let db;
if (USE_MYSQL) {
  db = require('../../database/config');
} else {
  db = require('../config/database').db;
}

// Get all custom tags (shared across all users)
router.get('/', async (req, res) => {
  console.log('📋 Getting all custom tags');

  try {
    let tags;

    if (USE_MYSQL) {
      tags = await db.query(
        `SELECT id, tag_name, created_at, created_by 
         FROM custom_tags 
         ORDER BY tag_name ASC`
      );
    } else {
      tags = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id, tag_name, created_at, created_by 
           FROM custom_tags 
           ORDER BY tag_name ASC`,
          [],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    }

    console.log(`✅ Retrieved ${tags.length} custom tags`);
    res.json({
      success: true,
      tags: tags.map(tag => tag.tag_name) // Return just the tag names
    });
  } catch (err) {
    console.error('❌ Error fetching custom tags:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom tags'
    });
  }
});

// Add a new custom tag
router.post('/', async (req, res) => {
  const { tagName, userId } = req.body;

  if (!tagName || !tagName.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Tag name is required'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  const trimmedTag = tagName.trim();
  console.log(`➕ Adding custom tag: "${trimmedTag}" by user ${userId}`);

  try {
    // Check if tag already exists
    let existingTag;

    if (USE_MYSQL) {
      const results = await db.query(
        'SELECT id FROM custom_tags WHERE tag_name = ?',
        [trimmedTag]
      );
      existingTag = results.length > 0 ? results[0] : null;
    } else {
      existingTag = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM custom_tags WHERE tag_name = ?',
          [trimmedTag],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });
    }

    if (existingTag) {
      console.log('⚠️ Tag already exists');
      return res.json({
        success: true,
        message: 'Tag already exists',
        tagExists: true
      });
    }

    // Insert new tag
    let result;

    if (USE_MYSQL) {
      result = await db.query(
        'INSERT INTO custom_tags (tag_name, created_by) VALUES (?, ?)',
        [trimmedTag, userId]
      );
      console.log(`✅ Custom tag added with ID: ${result.insertId}`);
      res.json({
        success: true,
        message: 'Custom tag added successfully',
        tag: {
          id: result.insertId,
          tag_name: trimmedTag
        }
      });
    } else {
      result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO custom_tags (tag_name, created_by) VALUES (?, ?)',
          [trimmedTag, userId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ lastID: this.lastID });
            }
          }
        );
      });
      console.log(`✅ Custom tag added with ID: ${result.lastID}`);
      res.json({
        success: true,
        message: 'Custom tag added successfully',
        tag: {
          id: result.lastID,
          tag_name: trimmedTag
        }
      });
    }
  } catch (err) {
    console.error('❌ Error adding custom tag:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to add custom tag'
    });
  }
});

// Delete a custom tag (optional - for future use)
router.delete('/:tagId', async (req, res) => {
  const { tagId } = req.params;
  const { userId } = req.body;

  console.log(`🗑️ Deleting custom tag ${tagId} by user ${userId}`);

  try {
    let result;

    if (USE_MYSQL) {
      result = await db.query(
        'DELETE FROM custom_tags WHERE id = ?',
        [tagId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }
    } else {
      result = await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM custom_tags WHERE id = ?',
          [tagId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ changes: this.changes });
            }
          }
        );
      });

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }
    }

    console.log('✅ Custom tag deleted');
    res.json({
      success: true,
      message: 'Custom tag deleted successfully'
    });
  } catch (err) {
    console.error('❌ Error deleting custom tag:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom tag'
    });
  }
});

module.exports = router;
