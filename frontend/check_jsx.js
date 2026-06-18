const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('d:/Admin/Desktop/InstaPark-Combined/instapark-app/frontend/app/(driver)/tasks.jsx', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx']
});

traverse(ast, {
  JSXText(path) {
    const text = path.node.value;
    if (text.trim().length > 0) {
      if (path.parent.type !== 'JSXElement' || (path.parent.openingElement.name.name !== 'Text' && path.parent.openingElement.name.name !== 'style')) {
        console.log(`Found stray text at line ${path.node.loc.start.line}: "${text}" in ${path.parent.openingElement?.name?.name || path.parent.type}`);
      }
    }
  }
});
console.log("Done checking");
