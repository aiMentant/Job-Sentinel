const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove top-level import
  content = content.replace(/import fs from ["']fs\/promises["'];\n/g, '');
  content = content.replace(/import JSZip from ["']jszip["'];\n/g, '');
  
  // Replace fs method calls with dynamic imports
  content = content.replace(/await fs\.mkdir\(/g, '(await import("fs/promises")).mkdir(');
  content = content.replace(/await fs\.readFile\(/g, '(await import("fs/promises")).readFile(');
  content = content.replace(/await fs\.writeFile\(/g, '(await import("fs/promises")).writeFile(');
  content = content.replace(/await fs\.appendFile\(/g, '(await import("fs/promises")).appendFile(');

  // Replace JSZip method calls
  content = content.replace(/JSZip\.loadAsync\(/g, '(await import("jszip")).default.loadAsync(');
  
  fs.writeFileSync(filePath, content);
}

fixFile('src/app/actions/adminActions.ts');
fixFile('src/app/actions/agentStatus.ts');
fixFile('src/lib/storage.ts');
fixFile('src/app/actions/jobActions.ts');

