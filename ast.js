import * as a from 'npm:acorn';

const file = await Deno.readTextFile('k6.js')
const ast = a.Parser.parse(file, {ecmaVersion: 9, sourceType: 'module'});

function findByType(node, type, countByType) {
    if (node) {
        if (node.type) {
            if (node.type === 'ExpressionStatement') {
                if (node.expression.callee){
                    if (node.expression.callee.name === 'group') {
                        const lastArg = node.expression.arguments[node.expression.arguments.length - 1]
                        if (lastArg.type === 'FunctionExpression') {
                            for (const node2 of lastArg.body.body) {
                                findByType(node2, type, countByType)
                            }
                        }
                    }
                }
                if (node.expression.callee) {
                    if (node.expression.callee.type === 'MemberExpression') {
                        if (node.expression.callee.object.name === type) {
                            if (node.expression.callee.property.name) {
                                countByType[type+"."+node.expression.callee.property.name] = (countByType[type+"."+node.expression.callee.property.name] || 0) + 1
                            }
                            else {
                                countByType[type] = (countByType[type] || 0) + 1
                            }
                        }
                    }
                }
                if (node.expression.callee) {
                    if (node.expression.callee.name === type) {
                        countByType[type] = (countByType[type] || 0) + 1
                    }
                }
            } else if (node.type === 'IfStatement') {
                if (node.consequent) {
                    for (const node2 of node.consequent.body) {
                        findByType(node2, type, countByType)
                    }
                }

                if (node.alternate) {
                    for (const node2 of node.alternate.body) {
                        findByType(node2, type, countByType)
                    }
                }
            } else if (node.type === 'BlockStatement') {
                for (const node2 of node.body) {
                    findByType(node2, type, countByType)
                }
            } else if (node.type === 'VariableDeclaration') {
                for (const node2 of node.declarations) {
                    findByType(node2, type, countByType)
                }
            } else if (node.type === 'VariableDeclarator') {
                if (node.init) {
                   if (node.init.type === 'CallExpression') {
                       if (node.init.callee.object.name === type) {
                           countByType[type+"."+node.init.callee.property.name] = (countByType[type+"."+node.init.callee.property.name] || 0) + 1
                       }
                   }
                }
            }

            if (node.body) {
                for (const node2 of node.body.body) {
                    findByType(node2, type, countByType)  
                }
            }
        }
    }
}

const scenarios = []
for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration.type === 'VariableDeclaration') {
            if (node.declaration.declarations[0].id.name === 'options') {
                for (const prop of node.declaration.declarations[0].init.properties) {
                    if (prop.key.name === 'scenarios') {
                        for (const scenario of prop.value.properties) {
                                for (const prop2 of scenario.value.properties) {
                                    if (prop2.key.name === 'exec') {
                                        scenarios.push(prop2.value.value)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

// Find all all the import identifiers names as shown above
const identifiers = []
for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers) {
            identifiers.push(specifier.local.name)
        }
    }
}

const byScenario = {}
for (const node of ast.body) {
    let scenario = ''
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
    if (scenario !== '') {
        const countByType = {}
        for (const identifier of identifiers) {
            findByType(node.declaration, identifier, countByType)
        }

        // Built-in functions
        findByType(node.declaration, 'console', countByType)

        byScenario[scenario] = countByType
    }
}

console.log(byScenario)
Deno.writeTextFile('ast.json', JSON.stringify(ast, null, 2))