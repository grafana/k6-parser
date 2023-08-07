import { rollup } from 'rollup';
import fs from 'fs';
import tar from 'tar';
import * as a from 'acorn';
import * as walk from 'acorn-walk';

async function buildPhase() {
    if (!fs.existsSync('archive')) {
        fs.mkdirSync('archive');
    }

    await tar.extract({
        file: 'archive.tar',
        cwd: 'archive',
        sync: true,
    });

    const metadata = JSON.parse(fs.readFileSync('archive/metadata.json', 'utf8'));
    const filename = metadata.filename;
    const inputPath = filename.replace('file://', '');

    const inputOptions = {
        input: './archive/file/' + inputPath,
        onwarn: function (warning) {
            if (warning.code === 'UNRESOLVED_IMPORT') {
                return;
            } else {
                console.warn(warning.message);
            }
        }
    };

    const outputOptionsList = [
        {
            file: 'bundle.esm.js',
            format: 'esm',
        },
    ];

    try {
        const bundle = await rollup(inputOptions);

        for (const outputOptions of outputOptionsList) {
            // generate output specific code in-memory
            // you can call this function multiple times on the same bundle object
            // replace bundle.generate with bundle.write to directly write to disk
            const { output } = await bundle.generate(outputOptions);

            for (const chunkOrAsset of output) {
                if (chunkOrAsset.type === 'asset') {
                    fs.writeFileSync(outputOptions.file, chunkOrAsset.source);
                } else {
                    const modifiedCode = chunkOrAsset.code.replace(/export\s\{[^\}]+\};/, '');
                    fs.writeFileSync(outputOptions.file, modifiedCode);
                }
            }
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function analyzePhase() {
    const file = fs.readFileSync('./bundle.esm.js', 'utf8');
    const ast = a.Parser.parse(file, { ecmaVersion: 9, sourceType: 'module' });

    const imports = [];
    const usageByImport = {};
    const usageByMethod = {};

    walk.ancestor(ast, {
        ImportDeclaration(node, _) {
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

                        if (!usageByMethod[importName]) {
                            usageByMethod[importName] = {};
                        }
                        if (!usageByMethod[importName][method]) {
                            usageByMethod[importName][method] = 1;
                        } else {
                            usageByMethod[importName][method]++;
                        }
                    } else {
                        if (!usageByImport[importName]) {
                            usageByImport[importName] = 1;
                        } else {
                            usageByImport[importName]++;
                        }
                    }
                }
            }
        }
    });

    const result = imports.map(item => {
        const specifiers = item.specifiers.map(specifierName => {
          const usage = usageByImport[specifierName];
          if (usageByMethod[specifierName]) {
            return {
              name: specifierName,
              usage: usageByMethod[specifierName]
            };
          } else {
            return {
              name: specifierName,
              usage: usage
            };
          }
        });
      
        return {
          source: item.source,
          specifiers: specifiers
        };
    });
      
    fs.writeFileSync('result.json', JSON.stringify({ imports: result }, null, 2));
    fs.writeFileSync('result_ast.json', JSON.stringify(ast, null, 2));
}

async function main() {
    try {
        await buildPhase();
        console.log('✨ Build phase completed');
        await analyzePhase();
        console.log('✨ Analyze phase completed');
        console.log('📜 Result saved to result.json');
    } catch (error) {
        console.error('❌ An error occurred:', error);
        process.exit(1);
    }
}

main();
