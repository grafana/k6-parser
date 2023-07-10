import * as a from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'fs';

const file = fs.readFileSync('./scripts/01.js', 'utf8');
const ast = a.Parser.parse(file, {ecmaVersion: 9, sourceType: 'module'});

const imports = []
walk.simple(ast, {
    ImportDeclaration(node) {
        var specifiers = [];
        for (const specifier of node.specifiers) {
            specifiers.push(specifier.local.name)
        }

        imports.push(
            {
                source: node.source.value,
                specifiers: specifiers
            }
        )
    }
})

const scenarios = []
walk.simple(ast, {
    Property(node) {
        if (node.key.name === 'scenarios') {
            for (const scenario of node.value.properties) {
                    for (const prop2 of scenario.value.properties) {
                        if (prop2.key.name === 'exec') {
                            scenarios.push(prop2.value.value)
                        }
                    }
                }
            }
        }
    }
)

const byScenario = {}
for (const node of ast.body) {
    let scenario = '_'
    if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration.type === 'FunctionDeclaration') {
            if (scenarios.includes(node.declaration.id.name)) {
                scenario = node.declaration.id.name
            }
        }
    } else if (node.type === 'ExportDefaultDeclaration') {
        if (node.declaration.type === 'FunctionDeclaration') {
            scenario = 'default'
        }
    }

    const countByImport = {}
    for (const i of imports) {
        findByImport(node, i, countByImport)
    }

    // Built-in functions
    findByImport(node, 'console', countByImport)

    if (scenario !== '_') {
        byScenario[scenario] = countByImport
    } else {
        for (const i of imports) {
            if (countByImport[i] !== undefined) {
                if (byScenario['_'] === undefined) {
                    byScenario['_'] = {}
                }
                byScenario['_'][i] = countByImport[i]
            }
        }
    }
}

function findByImport(ast, importName, countByImport) {
    walk.simple(ast, {
        Identifier(node) {
            if (node.name === importName) {
                // If father is a MemberExpression, it's a method call
                if (countByImport[importName] === undefined) {
                    countByImport[importName] = 1
                } else {
                    countByImport[importName]++
                }
            }
        },
    })
}

console.log(imports)
console.log(scenarios)
console.log(byScenario)

fs.writeFileSync('result_ast.json', JSON.stringify(ast, null, 2));