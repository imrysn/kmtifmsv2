const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix empty catch
  content = content.replace(/catch \(_\) \{\s+removeClient\(String\(userId\), res\);\s+\}/g, 'catch {\n      removeClient(String(userId), res);\n    }');
  content = content.replace(/catch \(_\) \{\s+clearInterval\(heartbeat\);\s+\}/g, 'catch {\n      clearInterval(heartbeat);\n    }');

  // Fix loose eqeqeq 
  content = content.replace(
    `const isOwner = req.user.id == userId; // intentional == not ===`,
    `const isOwner = req.user.id === parseInt(userId, 10);`
  );

  content = content.replace(
    /if \(req\.user\.id != userId && req\.user\.role !== 'ADMIN'\)/g,
    `if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'ADMIN')`
  );

  fs.writeFileSync(filePath, content);
};

fixFile('server/routes/notifications.js');
console.log('Fixed notifications.js');
