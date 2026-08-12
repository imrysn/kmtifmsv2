const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix setImmediate missing
  if (content.includes(`const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');`) && !content.includes(`const { setImmediate } = require('timers');`)) {
    content = content.replace(
      `const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');`,
      `const { safeDeleteFile, streamCopy } = require('../utils/fileUtils');\nconst { setImmediate } = require('timers');`
    );
  }

  // Replace `catch (_) {}`, `catch (e) {}`, `catch (err) {}` with `catch { /* ignored */ }`
  content = content.replace(/catch \([a-zA-Z_]+\) \{\}/g, 'catch { /* ignored */ }');

  // Replace `catch (_) {` with `catch {` where block is not empty but var is unused
  content = content.replace(/catch \([_e]\) \{/g, 'catch {');
  
  // Replace `catch (err) {` if err is unused (but maybe unsafe if we don't know). We know 'err' is unused at 1242
  
  fs.writeFileSync(filePath, content);
};

fixFile('server/services/fileService.js');
console.log('Fixed fileService.js');
