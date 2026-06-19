const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add setImmediate
  if (!content.includes(`const { setImmediate } = require('timers');`)) {
    content = content.replace(
      `const { db, query, queryOne } = require('../config/database');`,
      `const { db, query, queryOne } = require('../config/database');\nconst { setImmediate } = require('timers');`
    );
  }

  // Fix empty catches
  content = content.replace(/catch \(_\) \{(?:\s*)\}/g, 'catch { /* ignored */ }');
  content = content.replace(/catch \(_\) \{/g, 'catch {');

  // Fix unnecessary try catch
  content = content.replace(
    /try \{\s+const teamMembers = await query\(\s+'SELECT u\.id, u\.username, u\.role FROM users u JOIN team_members tm ON u\.id = tm\.user_id WHERE tm\.team_id = \?',\s+\[teamId\]\s+\);\s+return teamMembers;\s+\} catch \(e\) \{\s+throw e;\s+\}/g,
    `const teamMembers = await query(
      'SELECT u.id, u.username, u.role FROM users u JOIN team_members tm ON u.id = tm.user_id WHERE tm.team_id = ?',
      [teamId]
    );
    return teamMembers;`
  );

  fs.writeFileSync(filePath, content);
};

fixFile('server/routes/assignments.js');
console.log('Fixed assignments.js');
