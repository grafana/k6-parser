import * as a from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'fs';

const file = fs.readFileSync('./scripts/02.js', 'utf8');
const ast = a.Parser.parse(file, { ecmaVersion: 9, sourceType: 'module' });

const imports = [];
const countByImport = {};
const countByMethod = {};

walk.ancestor(ast, {
  ImportDeclaration(node,_) {
    const specifiers = node.specifiers.map(specifier => specifier.local.name);

    imports.push({
      source: node.source.value,
      specifiers: specifiers
    });
  },
  Identifier(node, ancestors) {
    const importName = node.name;

    for (const imp of imports) {
      if (imp.specifiers.includes(importName)) {
        const parentNode = ancestors[ancestors.length - 2];
        if (parentNode.type === 'MemberExpression') {
          const method = parentNode.property.name;

          if (!countByMethod[importName]) {
            countByMethod[importName] = {};
          }
          if (!countByMethod[importName][method]) {
            countByMethod[importName][method] = 1;
          } else {
            countByMethod[importName][method]++;
          }
        } else {
          if (!countByImport[importName]) {
            countByImport[importName] = 1;
          } else {
            countByImport[importName]++;
          }
        }
      }
    }
  }
});

console.log('Imports:', imports);
console.log('Imports:', countByImport);
console.log('Methods:', countByMethod);


fs.writeFileSync('result_ast.json', JSON.stringify(ast, null, 2));
