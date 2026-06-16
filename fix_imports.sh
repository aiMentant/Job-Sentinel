#!/bin/bash

# Remove fs/promises from adminActions.ts and use dynamic import
sed -i '' '/import fs from "fs\/promises";/d' src/app/actions/adminActions.ts
sed -i '' 's/await fs.mkdir/const fs = await import("fs\/promises"); await fs.mkdir/g' src/app/actions/adminActions.ts
sed -i '' 's/await fs.readFile/const fs = await import("fs\/promises"); await fs.readFile/g' src/app/actions/adminActions.ts
sed -i '' 's/await fs.appendFile/const fs = await import("fs\/promises"); await fs.appendFile/g' src/app/actions/adminActions.ts

# Remove fs/promises from agentStatus.ts and use dynamic import
sed -i '' '/import fs from "fs\/promises";/d' src/app/actions/agentStatus.ts
sed -i '' 's/await fs.readFile/const fs = await import("fs\/promises"); await fs.readFile/g' src/app/actions/agentStatus.ts
sed -i '' 's/await fs.mkdir/const fs = await import("fs\/promises"); await fs.mkdir/g' src/app/actions/agentStatus.ts
sed -i '' 's/await fs.writeFile/const fs = await import("fs\/promises"); await fs.writeFile/g' src/app/actions/agentStatus.ts

# Remove fs/promises from storage.ts and use dynamic import
sed -i '' '/import fs from '\''fs\/promises'\'';/d' src/lib/storage.ts
sed -i '' 's/await fs.readFile/const fs = await import("fs\/promises"); await fs.readFile/g' src/lib/storage.ts
sed -i '' 's/await fs.mkdir/const fs = await import("fs\/promises"); await fs.mkdir/g' src/lib/storage.ts
sed -i '' 's/await fs.writeFile/const fs = await import("fs\/promises"); await fs.writeFile/g' src/lib/storage.ts

# Remove JSZip from jobActions.ts
sed -i '' '/import JSZip from "jszip";/d' src/app/actions/jobActions.ts
sed -i '' 's/JSZip\.loadAsync/require("jszip").loadAsync/g' src/app/actions/jobActions.ts

