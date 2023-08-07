import { rollup } from 'rollup';
import fs from 'fs';
import tar from 'tar';

if (!fs.existsSync('archive')) {
    fs.mkdirSync('archive');
}

tar.extract({
    file: 'archive.tar',
    cwd: 'archive',
    sync: true,
});

// Read archive/metadata that is a JSON file, and get the "filename" property
const metadata = JSON.parse(fs.readFileSync('archive/metadata.json', 'utf8'));
const filename = metadata.filename;
const inputPath = filename.replace('file://', '');

const inputOptions = {
    input: './archive/file/' + inputPath,
};

const outputOptionsList = [
    {
        file: 'bundle.esm.js',
        format: 'esm',
    },
];

build();

async function build() {
  let bundle;
  let buildFailed = false;
  try {
    // create a bundle
    bundle = await rollup(inputOptions);

    // an array of file names this bundle depends on
    console.log(bundle.watchFiles);

    await generateOutputs(bundle);
  } catch (error) {
    buildFailed = true;
    // do some error reporting
    console.error(error);
  }
  if (bundle) {
    // closes the bundle
    await bundle.close();
  }
  process.exit(buildFailed ? 1 : 0);
}

async function generateOutputs(bundle) {
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
}