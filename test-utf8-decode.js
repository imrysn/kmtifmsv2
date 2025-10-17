// Test UTF-8 Filename Decoding
// Run this with: node test-utf8-decode.js

// Simulate the garbled filename that comes from the browser
const garblerFilename = 'ãƒãƒƒã‚ªãƒ‡ã‚£ãƒ¼ã‚¼ãƒ«é•·å²¡å‚考資料.pdf';

console.log('=== UTF-8 Filename Decoding Test ===\n');
console.log('1. Garbled filename (as received):');
console.log('  ', garblerFilename);
console.log('');

// Check if it matches the garbled pattern
const hasGarblerPattern = /[Ã¢â¬â¢Ã¤Â¸â‚¬Ã¦â€"‡Ã¨Â±Â¡]/.test(garblerFilename);
console.log('2. Contains garbled UTF-8 pattern:', hasGarblerPattern);
console.log('');

if (hasGarblerPattern) {
  // Decode it properly
  const buffer = Buffer.from(garblerFilename, 'binary');
  const decodedFilename = buffer.toString('utf8');
  
  console.log('3. Decoded filename (correct):');
  console.log('  ', decodedFilename);
  console.log('');
  
  console.log('✅ Decoding successful!');
  console.log('');
  console.log('Original Japanese:  バイオディーゼル長岡参考資料.pdf');
  console.log('Expected result:    ' + decodedFilename);
  console.log('Match:', decodedFilename === 'バイオディーゼル長岡参考資料.pdf' ? '✅' : '❌');
} else {
  console.log('No garbled pattern detected - filename is OK as-is');
}

console.log('\n=== Test Complete ===');

// Additional test cases
console.log('\n=== Additional Test Cases ===\n');

const testCases = [
  { input: 'test.pdf', expected: 'test.pdf', description: 'ASCII filename' },
  { input: 'æ—¥æœ¬èªž.pdf', expected: '日本語.pdf', description: 'Japanese' },
  { input: 'ä¸­æ–‡.docx', expected: '中文.docx', description: 'Chinese' },
  { input: 'íŒŒì�¼.xlsx', expected: '파일.xlsx', description: 'Korean' }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`  Input:    ${testCase.input}`);
  
  let result = testCase.input;
  if (/[Ã¢â¬â¢Ã¤Â¸â‚¬Ã¦â€"‡Ã¨Â±Â¡]/.test(testCase.input)) {
    const buffer = Buffer.from(testCase.input, 'binary');
    result = buffer.toString('utf8');
  }
  
  console.log(`  Output:   ${result}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Status:   ${result === testCase.expected ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
});
