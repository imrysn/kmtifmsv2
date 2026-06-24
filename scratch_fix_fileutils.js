const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix unused variable in catch
  content = content.replace(/catch \(_\) \{/g, 'catch {');

  // Fix no-control-regex
  content = content.replace(
    `.replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_')`,
    `// eslint-disable-next-line no-control-regex\n    .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_')`
  );

  fs.writeFileSync(filePath, content);
};

fixFile('server/utils/fileUtils.js');
console.log('Fixed fileUtils.js');
