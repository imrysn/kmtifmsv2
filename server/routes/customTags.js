const express = require('express');
const { db } = require('../config/database');

const router = express.Router();

// Get all custom tags (shared across all users)
router.get('/', (req, res) => {
  console.log('📋 Getting all custom tags');

  db.all(
    `SELECT id, tag_name, created_at, created_by 
     FROM custom_tags 
     ORDER BY tag_name ASC`,
    [],
    (err, tags) => {
      if (err) {
        console.error('❌ Error fetching custom tags:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch custom tags'
        });
      }

      console.log(`✅ Retrieved ${tags.length} custom tags`);
      res.json({
        success: true,
        tags: tags.map(tag => tag.tag_name) // Return just the tag names
      });
    }
  );
});

// Add a new custom tag
router.post('/', (req, res) => {
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

  // Check if tag already exists
  db.get(
    'SELECT id FROM custom_tags WHERE tag_name = ?',
    [trimmedTag],
    (err, existingTag) => {
      if (err) {
        console.error('❌ Error checking for existing tag:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to check for existing tag'
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
      db.run(
        'INSERT INTO custom_tags (tag_name, created_by) VALUES (?, ?)',
        [trimmedTag, userId],
        function(err) {
          if (err) {
            console.error('❌ Error adding custom tag:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to add custom tag'
            });
          }

          console.log(`✅ Custom tag added with ID: ${this.lastID}`);
          res.json({
            success: true,
            message: 'Custom tag added successfully',
            tag: {
              id: this.lastID,
              tag_name: trimmedTag
            }
          });
        }
      );
    }
  );
});

// Delete a custom tag (optional - for future use)
router.delete('/:tagId', (req, res) => {
  const { tagId } = req.params;
  const { userId } = req.body;

  console.log(`🗑️ Deleting custom tag ${tagId} by user ${userId}`);

  // Optional: Only allow creator or admin to delete
  db.run(
    'DELETE FROM custom_tags WHERE id = ?',
    [tagId],
    function(err) {
      if (err) {
        console.error('❌ Error deleting custom tag:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete custom tag'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      console.log('✅ Custom tag deleted');
      res.json({
        success: true,
        message: 'Custom tag deleted successfully'
      });
    }
  );
});

module.exports = router;
