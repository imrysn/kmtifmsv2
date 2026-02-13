const express = require('express');
const db = require('../../database/config');

const router = express.Router();

// Get all custom tags (shared across all users)
router.get('/', async (req, res) => {
  console.log('📋 Getting all custom tags');

  try {
    const tags = await db.query(
      `SELECT id, tag_name, created_at, created_by 
       FROM custom_tags 
       ORDER BY tag_name ASC`
    );

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
    const results = await db.query(
      'SELECT id FROM custom_tags WHERE tag_name = ?',
      [trimmedTag]
    );
    const existingTag = results.length > 0 ? results[0] : null;

    if (existingTag) {
      console.log('⚠️  Tag already exists');
      return res.json({
        success: true,
        message: 'Tag already exists',
        tagExists: true
      });
    }

    // Insert new tag
    const result = await db.query(
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

  console.log(`🗑️  Deleting custom tag ${tagId} by user ${userId}`);

  try {
    const result = await db.query(
      'DELETE FROM custom_tags WHERE id = ?',
      [tagId]
    );

    if (result.affectedRows === 0) {
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
  } catch (err) {
    console.error('❌ Error deleting custom tag:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom tag'
    });
  }
});

module.exports = router;
