const fs = require('fs');

function replaceAllFs(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/import fs from ["']fs\/promises["'];\n/g, '');
  
  content = content.replace(/await fs\.mkdir\(/g, 'await (await import("fs/promises")).mkdir(');
  content = content.replace(/await fs\.readFile\(/g, 'await (await import("fs/promises")).readFile(');
  content = content.replace(/await fs\.writeFile\(/g, 'await (await import("fs/promises")).writeFile(');
  content = content.replace(/await fs\.appendFile\(/g, 'await (await import("fs/promises")).appendFile(');

  content = content.replace(/fs\.readdir/g, '(await import("fs/promises")).readdir');

  content = content.replace(/import JSZip from ["']jszip["'];\n/g, '');
  content = content.replace(/JSZip\.loadAsync\(/g, '(await import("jszip")).default.loadAsync(');
  
  fs.writeFileSync(filePath, content);
}

replaceAllFs('src/app/actions/adminActions.ts');
replaceAllFs('src/app/actions/agentStatus.ts');
replaceAllFs('src/lib/storage.ts');
replaceAllFs('src/app/actions/jobActions.ts');

