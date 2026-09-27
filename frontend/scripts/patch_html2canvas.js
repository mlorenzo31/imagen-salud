const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/html2canvas/dist/html2canvas.js',
  'node_modules/html2canvas/dist/html2canvas.esm.js',
  'node_modules/html2canvas/dist/html2canvas.min.js',
  'node_modules/html2canvas/dist/lib/css/types/color.js'
];

targets.forEach(relPath => {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('Skipping non-existent:', relPath);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Pattern 1: throw new Error("Attempting to parse an unsupported color function ...
  const regexThrow = /throw new Error\(\s*["']Attempting to parse an unsupported color function\s*["']\s*\+\s*value\.name\s*\+\s*["']["']\s*\);?/g;
  if (regexThrow.test(content)) {
    content = content.replace(regexThrow, 'return (typeof exports !== "undefined" && exports.COLORS) ? exports.COLORS.TRANSPARENT : ((typeof COLORS !== "undefined") ? COLORS.TRANSPARENT : 0);');
    modified = true;
  }

  // Also check minified variations
  const regexMin = /throw new Error\(["']Attempting to parse an unsupported color function [^)]+\);?/g;
  if (regexMin.test(content)) {
    content = content.replace(regexMin, 'return 0;');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Successfully patched:', relPath);
  } else {
    console.log('Already patched or not matched:', relPath);
  }
});
