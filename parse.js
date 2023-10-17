import { rollup } from 'rollup';
import fs from 'fs';
import tar from 'tar';
import * as a from 'acorn';
import * as walk from 'acorn-walk';

// Only used for server-mode
import express from 'express';
import fileUpload from 'express-fileupload';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(fileUpload());

async function bundlePhase(randomID, archiveName) {
    const archiveDir = `./${randomID}`;
    const bundlePath = `${archiveDir}/bundle.esm.js`;

    if (!fs.existsSync(randomID)) {
        fs.mkdirSync(randomID);
    } else {
        await fs.rmSync(randomID, { recursive: true })
        fs.mkdirSync(randomID);
    }

    await tar.extract({
        file: archiveName,
        cwd: randomID,
        sync: true,
    });

    const metadata = JSON.parse(fs.readFileSync(`${archiveDir}/metadata.json`, 'utf8'));
    const filename = metadata.filename;
    const inputPath = filename.replace('file://', '');

    const inputOptions = {
        input: `${archiveDir}/file/` + inputPath,
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
            file: bundlePath,
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

    return { bundlePath: bundlePath };
}

async function analyzePhase(randomID, bundlePath) {
    const resultFileName = `./${randomID}/result.json`;
    const resultAstFileName = `./${randomID}/result_ast.json`;

    if (fs.existsSync(resultFileName)) {
        fs.rmSync(resultFileName);
    }

    if (fs.existsSync(resultAstFileName)) {
        fs.rmSync(resultAstFileName);
    }

    const file = fs.readFileSync(bundlePath, 'utf8');
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
      
    fs.writeFileSync(resultFileName, JSON.stringify({ imports: result }, null, 2));
    fs.writeFileSync(resultAstFileName, JSON.stringify(ast, null, 2));

    return { imports: result, ast: ast };
}

function generateRandomID() {
    return `parse_${Math.random().toString(36).substring(7)}`;
}

async function main() {
    if (process.argv.includes('--server')) {
        var archiveUploadsDir = './archive_uploads';
        if (!fs.existsSync(archiveUploadsDir)) {
            fs.mkdirSync(archiveUploadsDir);
        }

        app.get('/health', (res) => {
            res.json({ status: 'ok' });
        });

        app.post('/parse', async (req, res) => {
            try {
                // CLIENT: curl -X POST -F "archive=@archive.tar" http://localhost:3000/parse
                const randomID = generateRandomID();
                console.log(`📦 Archive uploaded, ID: ${randomID}`);
                if (!req.files || !req.files.archive) {
                    return res.status(400).json({ error: 'No archive file uploaded' });
                }
                const uploadedArchive = req.files.archive;
                const archiveName = `${archiveUploadsDir}/${randomID}.tar`;
                await uploadedArchive.mv(archiveName);

                var bundleRes = await bundlePhase(randomID, archiveName);
                console.log('✨ Bundle phase completed for ID: ' + randomID);
                var analyzeRes = await analyzePhase(randomID, bundleRes.bundlePath);
                console.log('✨ Analyze phase completed for ID: ' + randomID);

                const result = {
                    imports: analyzeRes.imports,
                };

                res.json(result);
            } catch (error) {
                console.error(`❌ An error occurred for ID: ${randomID}`, error);
                res.status(500).json({ error: 'An error occurred' });
            }
        });

        app.listen(port,() => {
            console.log('🚀 Server started on port ' + port);
        });
    } else {
        const randomID = generateRandomID();
        try {
            var archiveName = "archive.tar";
            if (process.argv.length === 2) {
                console.log('📦 No archive specified, using default archive.tar');
            } else if (process.argv.length === 3) {
                archiveName = process.argv[2];
                console.log('📦 Using archive ' + archiveName);
            } else {
                console.error('❌ Too many arguments');
                process.exit(1);
            }

            var bundleRes = await bundlePhase(randomID, archiveName);
            console.log('✨ Bundle phase completed');
            await analyzePhase(randomID, bundleRes.bundlePath);
            console.log('✨ Analyze phase completed');
            console.log(`📜 Result saved to ${randomID}/result.json`);
        } catch (error) {
            console.error('❌ An error occurred:', error);
            process.exit(1);
        }
    }
}

main();
