const fs = require('fs');
let content = fs.readFileSync('d:/Admin/Desktop/InstaPark-Combined/instapark-app/frontend/app/(driver)/tasks.jsx', 'utf8');

// Find the line containing the bad character and fix it
// The line looks like "          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36),"
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('backgroundColor: "#fff", borderTopLeftRadius: rp(36)')) {
    // Keep only whitespace and the <View...
    const match = lines[i].match(/(\s*)<View/);
    if (match) {
       lines[i] = lines[i].substring(0, match[0].length - 5) + lines[i].substring(lines[i].indexOf('<View'));
       // Or simply:
       lines[i] = lines[i].replace(/[^\x00-\x7F]+</, '<');
    }
  }
}

fs.writeFileSync('d:/Admin/Desktop/InstaPark-Combined/instapark-app/frontend/app/(driver)/tasks.jsx', lines.join('\n'));
console.log("Fixed invisible character");
