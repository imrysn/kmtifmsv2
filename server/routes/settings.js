const express = require('express');
const router = express.Router();
const { db, USE_MYSQL } = require('../config/database');
const { logActivity } = require('../utils/logger');

// Initialize settings table if it doesn't exist
const initializeSettingsTable = async () => {
  try {
    if (USE_MYSQL) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          setting_key VARCHAR(255) UNIQUE NOT NULL,
          setting_value TEXT,
          description TEXT,
          updated_by VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Insert default settings if not exists
      await db.query(`
        INSERT IGNORE INTO settings (setting_key, setting_value, description)
        VALUES ('root_directory', '/home/admin/files', 'Root directory for file management system')
      `);
    } else {
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT,
            description TEXT,
            updated_by TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            // Insert default settings
            db.run(`
              INSERT OR IGNORE INTO settings (setting_key, setting_value, description)
              VALUES ('root_directory', '/home/admin/files', 'Root directory for file management system')
            `, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }
        });
      });
    }
  } catch (error) {
    console.error('Error initializing settings table:', error);
  }
};

// Initialize on module load
initializeSettingsTable();

// GET all settings
router.get('/', async (req, res) => {
  try {
    if (USE_MYSQL) {
      const settings = await db.query('SELECT * FROM settings');

      // Convert array to object for easier access
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.setting_key] = {
          value: setting.setting_value,
          description: setting.description,
          updated_by: setting.updated_by,
          updated_at: setting.updated_at
        };
      });

      res.json({ success: true, settings: settingsObj });
    } else {
      db.all('SELECT * FROM settings', [], (err, settings) => {
        if (err) {
          console.error('Error fetching settings:', err);
          return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
        }

        // Convert array to object
        const settingsObj = {};
        settings.forEach(setting => {
          settingsObj[setting.setting_key] = {
            value: setting.setting_value,
            description: setting.description,
            updated_by: setting.updated_by,
            updated_at: setting.updated_at
          };
        });

        res.json({ success: true, settings: settingsObj });
      });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// GET specific setting by key
router.get('/:key', async (req, res) => {
  const { key } = req.params;

  try {
    if (USE_MYSQL) {
      const settings = await db.query(
        'SELECT * FROM settings WHERE setting_key = ?',
        [key]
      );

      if (settings.length === 0) {
        return res.status(404).json({ success: false, message: 'Setting not found' });
      }

      res.json({
        success: true,
        setting: {
          key: settings[0].setting_key,
          value: settings[0].setting_value,
          description: settings[0].description,
          updated_by: settings[0].updated_by,
          updated_at: settings[0].updated_at
        }
      });
    } else {
      db.get(
        'SELECT * FROM settings WHERE setting_key = ?',
        [key],
        (err, setting) => {
          if (err) {
            console.error('Error fetching setting:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch setting' });
          }

          if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
          }

          res.json({
            success: true,
            setting: {
              key: setting.setting_key,
              value: setting.setting_value,
              description: setting.description,
              updated_by: setting.updated_by,
              updated_at: setting.updated_at
            }
          });
        }
      );
    }
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch setting' });
  }
});

// PUT update setting
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value, updated_by } = req.body;

  if (!value) {
    return res.status(400).json({ success: false, message: 'Setting value is required' });
  }

  try {
    if (USE_MYSQL) {
      const result = await db.query(
        `UPDATE settings 
         SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = ?`,
        [value, updated_by || 'system', key]
      );

      if (result.affectedRows === 0) {
        // Setting doesn't exist, insert it
        await db.query(
          `INSERT INTO settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)`,
          [key, value, updated_by || 'system']
        );
      }

      // Log activity
      if (updated_by) {
        logActivity(
          db,
          null,
          updated_by,
          'ADMIN',
          'General',
          `Updated setting: ${key} = ${value}`
        );
      }

      res.json({ success: true, message: 'Setting updated successfully' });
    } else {
      db.run(
        `INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_by, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [key, value, updated_by || 'system'],
        function(err) {
          if (err) {
            console.error('Error updating setting:', err);
            return res.status(500).json({ success: false, message: 'Failed to update setting' });
          }

          // Log activity
          if (updated_by) {
            logActivity(
              db,
              null,
              updated_by,
              'ADMIN',
              'General',
              `Updated setting: ${key} = ${value}`
            );
          }

          res.json({ success: true, message: 'Setting updated successfully' });
        }
      );
    }
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

module.exports = router;
