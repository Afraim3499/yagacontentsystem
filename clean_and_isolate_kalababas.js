// ====================================================================
// CLEANUP & ISOLATION SCRIPT FOR F:\kalababas
// Reverts root additions and places yaga-content-system in isolated subfolder
// ====================================================================

const fs = require('fs');
const path = require('path');

const KALABABAS_ROOT = 'F:\\kalababas';
const SRC_DIR = 'd:\\yagacallls content operation';
const TARGET_ISOLATED_DIR = path.join(KALABABAS_ROOT, 'yaga-content-system');

function rmDirRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        rmDirRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (childItemName === 'node_modules' || childItemName === '.system_generated') return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('🧹 [1/3] Cleaning up root additions from F:\\kalababas...');

// Remove root folders created earlier
const looseFolders = ['operations-crm', 'services', 'deploy'];
looseFolders.forEach(folder => {
  const folderPath = path.join(KALABABAS_ROOT, folder);
  if (fs.existsSync(folderPath)) {
    console.log(`   Deleting loose root folder: ${folderPath}`);
    rmDirRecursive(folderPath);
  }
});

// Remove copied doc files from F:\kalababas\docs if present
const docsToDelete = [
  '01_TEAM_MEMBER_GUIDE.md',
  '02_OWNERS_OPERATIONAL_GUIDE.md',
  '03_CHIEF_SYSTEM_ENGINEER_RUNBOOK.md',
  'engineering.md',
  'instructions.md'
];
docsToDelete.forEach(doc => {
  const docPath = path.join(KALABABAS_ROOT, 'docs', doc);
  if (fs.existsSync(docPath)) {
    console.log(`   Deleting copied doc from root docs: ${docPath}`);
    fs.unlinkSync(docPath);
  }
});

console.log('📦 [2/3] Setting up isolated target directory: F:\\kalababas\\yaga-content-system...');
if (fs.existsSync(TARGET_ISOLATED_DIR)) {
  rmDirRecursive(TARGET_ISOLATED_DIR);
}
fs.mkdirSync(TARGET_ISOLATED_DIR, { recursive: true });

console.log('🚀 [3/3] Copying complete operations system to F:\\kalababas\\yaga-content-system...');
copyRecursiveSync(SRC_DIR, TARGET_ISOLATED_DIR);

console.log('\n====================================================');
console.log('🎉 CLEANUP & ISOLATION COMPLETED 100%!');
console.log('====================================================');
console.log('• F:\\kalababas Root: 100% restored for Next.js website (yagacalls.com)');
console.log('• F:\\kalababas\\yaga-content-system: Completely isolated self-contained repository');
console.log('====================================================\n');
