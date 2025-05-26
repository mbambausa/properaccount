// scripts/build-mojo.js
import { execSync } from 'child_process';
import fs from 'fs'; // Using synchronous fs for simplicity in this build script
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Verify this path matches your actual Mojo source directory structure
const MOJO_SRC_DIR = path.join(__dirname, '../src/mojo');
const MOJO_DIST_DIR = path.join(__dirname, '../public/mojo');

// Ensure the output directory exists
if (!fs.existsSync(MOJO_DIST_DIR)) {
  fs.mkdirSync(MOJO_DIST_DIR, { recursive: true });
  console.log(`Created output directory: ${MOJO_DIST_DIR}`);
}

// Check for Mojo compiler availability
try {
  execSync('mojo --version', { stdio: 'pipe' }); // Use 'pipe' to capture output if needed, or 'ignore'
  console.log('✅ Mojo compiler found.');
} catch (error) {
  console.error('❌ Mojo compiler not found. Please ensure Mojo is installed and in your PATH.');
  console.error('   Verify by running "mojo --version" in your terminal.');
  console.error('   Error details:', error.message);
  process.exit(1);
}

// Compile each Mojo module to WebAssembly
function compileMojoFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      compileMojoFiles(fullPath); // Recursively process subdirectories
    } else if (entry.isFile() && entry.name.endsWith('.mojo')) {
      const relativePathFromSrc = path.relative(MOJO_SRC_DIR, fullPath);
      const moduleName = path.basename(entry.name, '.mojo');
      const outputSubDir = path.dirname(relativePathFromSrc);
      const finalOutputDir = path.join(MOJO_DIST_DIR, outputSubDir);
      const outputPath = path.join(finalOutputDir, `${moduleName}.wasm`);

      // Ensure specific output directory for the module exists
      if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
      }

      console.log(`Compiling ${fullPath} to ${outputPath}`);

      try {
        // ========================================================================
        // CRITICAL PLACEHOLDER: Replace with your actual Mojo compilation command!
        // The command below is a generic example and will likely need adjustment
        // based on your Mojo SDK version, specific project needs (e.g., linking,
        // optimization flags, output types like .wasm vs .so for different targets).
        // Consult the Mojo documentation for the correct compilation flags.
        // Example for Wasm (may vary):
        // execSync(`mojo build ${fullPath} -o ${outputPath}`); // If `mojo build` supports direct Wasm output
        // Or, if it's a different command like `mojo package` or `mojo compile --target wasm32-unknown-unknown`:
        execSync(`mojo package "${fullPath}" -o "${outputPath}"`); // A common way to produce deployable artifacts, ensure it outputs .wasm
        //
        // For example, if you need to target wasm32 specifically:
        // execSync(`mojo compile --target wasm32-wasi "${fullPath}" -o "${outputPath}"`);
        //
        // VERIFY THE CORRECT COMMAND FOR YOUR USE CASE AND MOJO VERSION.
        // ========================================================================
        console.log(`✅ Successfully compiled ${moduleName} to ${outputPath}`);
      } catch (error) {
        console.error(`❌ Error compiling ${entry.name}:`);
        console.error('   Command output (if any):');
        if (error.stdout) console.error('   Stdout:', error.stdout.toString());
        if (error.stderr) console.error('   Stderr:', error.stderr.toString());
        if (!error.stdout && !error.stderr) console.error('   Error message:', error.message);
        process.exit(1);
      }
    }
  }
}

// Start compilation
console.log('Building Mojo WebAssembly modules...');
compileMojoFiles(MOJO_SRC_DIR);
console.log('✅ Mojo build complete!');