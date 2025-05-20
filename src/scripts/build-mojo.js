// scripts/build-mojo.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MOJO_SRC_DIR = path.join(__dirname, '../src/lib/mojo');
const MOJO_DIST_DIR = path.join(__dirname, '../public/mojo');

// Ensure the output directory exists
if (!fs.existsSync(MOJO_DIST_DIR)) {
  fs.mkdirSync(MOJO_DIST_DIR, { recursive: true });
}

// Compile each Mojo module to WebAssembly
function compileMojoFiles(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      compileMojoFiles(filePath); // Recursively process subdirectories
    } else if (file.endsWith('.mojo')) {
      const relativePath = path.relative(MOJO_SRC_DIR, filePath);
      const moduleName = path.basename(file, '.mojo');
      const outputDir = path.join(MOJO_DIST_DIR, path.dirname(relativePath));
      const outputPath = path.join(outputDir, `${moduleName}.wasm`);
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      console.log(`Compiling ${filePath} to ${outputPath}`);
      
      try {
        // This is a placeholder for the actual Mojo compiler command
        // You'll need to replace this with the actual command for your Mojo compiler
        execSync(`mojo compile --target wasm32 ${filePath} -o ${outputPath}`);
        console.log(`Successfully compiled ${moduleName}`);
      } catch (error) {
        console.error(`Error compiling ${moduleName}:`, error.message);
        process.exit(1);
      }
    }
  }
}

// Start compilation
console.log('Building Mojo WebAssembly modules...');
compileMojoFiles(MOJO_SRC_DIR);
console.log('Mojo build complete!');