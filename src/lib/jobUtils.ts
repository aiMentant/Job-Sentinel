import { Job } from './db';

/**
 * Returns CSS classes for source tags based on platform name
 */
export const getSourceBadgeClass = (source: string = '') => {
  const s = source.toLowerCase();
  if (s.includes("linkedin")) return "bg-blue-600/10 text-blue-400 border border-blue-500/20";
  if (s.includes("indeed")) return "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20";
  if (s.includes("glassdoor")) return "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20";
  if (s.includes("ziprecruiter")) return "bg-amber-600/10 text-amber-500 border border-amber-500/20";
  if (s.includes("usajobs")) return "bg-red-600/10 text-red-400 border border-red-500/20";
  if (s.includes("snagajob")) return "bg-orange-600/10 text-orange-400 border border-orange-500/20";
  return "bg-purple-600/10 text-purple-400 border border-purple-500/20";
};

/**
 * Calculates posting age in days
 */
export const getDaysOld = (postedAt?: string, createdAt?: string): number => {
  const dateStr = postedAt || createdAt;
  if (!dateStr) return 999;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 999;
  const msDiff = Date.now() - date.getTime();
  return Math.floor(msDiff / (1000 * 60 * 60 * 24));
};

/**
 * Computes a heuristic ghost score (0-100) based on signals
 */
export const computeGhostScore = (job: Partial<Job>): number => {
  let score = 0;
  const daysOld = getDaysOld(job.postedAt, job.createdAt);
  const source = (job.source || '').toLowerCase();
  
  // 1. Source-Specific Age Adjustments
  if (source.includes('usajobs')) {
    // Federal positions on USAJobs have slow, deliberate timelines. Only flag if > 90/60 days.
    if (daysOld > 90 && daysOld < 999) score += 40;
    else if (daysOld > 60 && daysOld < 999) score += 20;
  } else {
    // Standard corporate listings
    if (daysOld > 60 && daysOld < 999) score += 55;        // Highly likely stale or filled
    else if (daysOld > 30 && daysOld < 999) score += 35;   // Entering suspect territory
    else if (daysOld > 14 && daysOld < 999) score += 15;   // Initial decay phase
  }

  // 2. Advanced Harvesting Keyword Analysis
  const desc = (job.description || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  const reason = (job.reason || '').toLowerCase();
  const textToScan = `${title} ${desc} ${reason}`;

  // High-confidence harvesting indicators (Immediate suspicion)
  const primaryHarvestingKeywords = [
    "talent pool", "future openings", "talent community", 
    "general application", "resume bank", "future consideration",
    "evergreen", "join our network", "speculative application"
  ];
  
  // Moderate indicators (Suspicious when combined with age)
  const secondaryHarvestingKeywords = [
    "always looking", "anticipatory hiring", "database building",
    "register your interest", "ongoing recruitment", "future hiring"
  ];

  if (primaryHarvestingKeywords.some(keyword => textToScan.includes(keyword))) {
    score += 40;
  } else if (secondaryHarvestingKeywords.some(keyword => textToScan.includes(keyword))) {
    score += 20;
  }

  // 3. Structural Vague Posting Heuristics
  const cleanDesc = desc.replace(/[\s\r\n\t]+/g, ' ').trim();
  if (cleanDesc.length > 0 && cleanDesc.length < 300) {
    score += 25; // Drastically short
  } else if (cleanDesc.length > 0 && cleanDesc.length < 800) {
    score += 10; // Unusually brief
  }

  // 4. Missing Comp/Location Transparency Signals
  const hasSalary = !!(job.salaryRange || job.salary_range);
  if (!hasSalary) {
    score += 10;
  }

  // Generic or hidden employers (often recruiting agency harvesting)
  const company = (job.company || '').toLowerCase();
  const genericEmployers = ["enterprise partner", "confidential employer", "staffing agency", "recruiting partner", "stealth startup", "client partner"];
  if (genericEmployers.some(g => company.includes(g))) {
    score += 15;
  }

  return Math.min(score, 100);
};

/**
 * Returns badge label and formatting info for a ghost score
 */
export const getGhostBadge = (score: number) => {
  const commonCriteria = "Ghost & Harvesting Heuristic Checks:\n• Posting Age (older posts flagged)\n• Description Length (vague/short posts flagged)\n• Missing Salary Details (unspecified salary flagged)\n• Generic Company Names (placeholder companies flagged)\n• Harvesting Keywords ('talent pool', 'pipeline', etc.)";

  if (score >= 80) {
    return {
      label: `Ghost/Harvest ${score}%`,
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      description: `${commonCriteria}\n\nRisk Level: Extreme (High likelihood of a passive candidate harvesting pool).`
    };
  }
  if (score >= 60) {
    return {
      label: `Likely Ghost/Harvest ${score}%`,
      className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      description: `${commonCriteria}\n\nRisk Level: Likely Ghost (Suspicious posting, potential pipeline vacancy).`
    };
  }
  if (score >= 30) {
    return {
      label: `Suspect Ghost/Harvest ${score}%`,
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20",
      description: `${commonCriteria}\n\nRisk Level: Suspect (Several indicators present, e.g. stale date/missing salary).`
    };
  }
  return null;
};

export function calculateJaccardSimilarity(str1: string, str2: string): number {
  const getTokens = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const t1 = getTokens(str1);
  const t2 = getTokens(str2);
  if (t1.length === 0 || t2.length === 0) return 0;
  const s1 = new Set(t1);
  const s2 = new Set(t2);
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
}

export function getJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function heuristicMatchScore(jobTitle: string, targetTitles: string[], alternativeTitles: string[] = []): number {
  let maxScore = 0;
  
  // Score against primary titles (full weight)
  for (const target of targetTitles) {
    if (jobTitle.toLowerCase().trim() === target.toLowerCase().trim()) {
      return 100;
    }
    if (jobTitle.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(jobTitle.toLowerCase())) {
      maxScore = Math.max(maxScore, 90);
    }
    const sim = calculateJaccardSimilarity(jobTitle, target);
    const score = Math.round(sim * 100);
    maxScore = Math.max(maxScore, score);
  }
  
  // Score against alternative titles (capped at 85)
  for (const alt of alternativeTitles) {
    if (jobTitle.toLowerCase().trim() === alt.toLowerCase().trim()) {
      maxScore = Math.max(maxScore, 85);
      continue;
    }
    if (jobTitle.toLowerCase().includes(alt.toLowerCase()) || alt.toLowerCase().includes(jobTitle.toLowerCase())) {
      maxScore = Math.max(maxScore, 80);
    }
    const sim = calculateJaccardSimilarity(jobTitle, alt);
    const score = Math.round(sim * 85); // Penalty factor for alternative titles
    maxScore = Math.max(maxScore, score);
  }
  
  return maxScore;
}

export type AlignedRow = {
  original: string | null;
  tailored: string | null;
  status: 'modified' | 'added' | 'removed' | 'unchanged';
};

export function alignResumeBullets(originalText: string, tailoredText: string, approvedLines: string[] = []): AlignedRow[] {
  const cleanLine = (l: string) => l.replace(/\*\*/g, '').trim().replace(/^[•\-\*\s\d\.\)]+/, '').trim();
  const cleanApproved = approvedLines.map(line => line.trim().replace(/^[•\-\*\s]+/, '').toLowerCase());
  
  const origLines = (originalText || "").split('\n').map((l, i) => ({ raw: l, clean: cleanLine(l), index: i }));
  const tailLines = (tailoredText || "").split('\n').map((l, i) => ({ raw: l, clean: cleanLine(l), index: i }));

  const rows: AlignedRow[] = [];
  const matchedOrigIndices = new Set<number>();

  for (const t of tailLines) {
    if (!t.clean) {
      continue;
    }

    const isApproved = cleanApproved.includes(t.clean.toLowerCase());

    let bestMatchIdx = -1;
    let bestSim = 0;

    for (let i = 0; i < origLines.length; i++) {
      const o = origLines[i];
      if (!o.clean) continue;
      
      const sim = calculateJaccardSimilarity(t.clean, o.clean);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx !== -1 && bestSim >= 0.22) {
      matchedOrigIndices.add(bestMatchIdx);
      const originalRaw = origLines[bestMatchIdx].raw;
      const status = isApproved 
        ? 'unchanged' 
        : (t.clean.toLowerCase() === origLines[bestMatchIdx].clean.toLowerCase() ? 'unchanged' : 'modified');
      rows.push({
        original: originalRaw,
        tailored: t.raw,
        status: status
      });
    } else {
      rows.push({
        original: null,
        tailored: t.raw,
        status: isApproved ? 'unchanged' : 'added'
      });
    }
  }

  // Any original lines that weren't matched are marked as removed
  for (let i = 0; i < origLines.length; i++) {
    const o = origLines[i];
    if (o.clean && !matchedOrigIndices.has(i)) {
      rows.push({
        original: o.raw,
        tailored: null,
        status: 'removed'
      });
    }
  }

  return rows;
}

export function isTitleMatch(
  jobTitle: string,
  targetTitles: string[],
  alternativeTitles: string[] = [],
  strictness: 'exact' | 'strong' | 'flexible' = 'exact'
): boolean {
  // Safety guardrails for undefined/null/empty/non-string inputs
  const safeJobTitle = typeof jobTitle === 'string' ? jobTitle : '';
  const safeTargetTitles = Array.isArray(targetTitles)
    ? targetTitles.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
    : [];
  const safeAlternativeTitles = Array.isArray(alternativeTitles)
    ? alternativeTitles.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
    : [];

  const genericWords = ["senior", "junior", "lead", "staff", "principal", "associate", "intern", "creative", "digital", "motion", "co-op", "contractor"];
  const stopWords = new Set(["of", "and", "in", "the", "for", "with", "a", "an", "at", "to", "or", "by", "&", "-", "/"]);

  const cleanString = (str: string) => {
    if (typeof str !== 'string') return "";
    return str.toLowerCase()
      .replace(/\bvice\s+president\b/g, "vp")
      .replace(/\bchief\s+operating\s+officer\b/g, "coo")
      .replace(/\bchief\s+executive\s+officer\b/g, "ceo")
      .replace(/\bchief\s+financial\s+officer\b/g, "cfo")
      .replace(/\bchief\s+technology\s+officer\b/g, "cto")
      .replace(/\bmanager\b/g, "mgr")
      .replace(/\boperations\b/g, "ops")
      .replace(/[^\w\s+#]/g, " "); // Preserving '+' and '#' for C++ and C#
  };

  const tokenizeAndClean = (str: string) => {
    return cleanString(str)
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 0 && !stopWords.has(w));
  };

  const expandAndCleanTitles = (titlesList: string[]) => {
    const expanded: string[] = [];
    for (const t of titlesList) {
      if (typeof t !== 'string') continue;
      const clean = t.replace(/\([^)]*\)/g, " ").trim();
      const parts = clean.split(/\s*[\/]\s*/);
      for (const part of parts) {
        if (part.trim().length > 0) {
          expanded.push(part.trim());
        }
      }
    }
    return expanded;
  };

  const wordMatches = (tWord: string, jWord: string) => {
    if (tWord === jWord) return true;
    // Prevent java vs javascript mismatch
    if ((tWord === "java" && jWord === "javascript") || (tWord === "javascript" && jWord === "java")) {
      return false;
    }
    if (tWord.length >= 4 && jWord.startsWith(tWord)) return true;
    if (jWord.length >= 4 && tWord.startsWith(jWord)) return true;
    return false;
  };

  const hasNoInputs = (!targetTitles || targetTitles.length === 0) && (!alternativeTitles || alternativeTitles.length === 0);
  if (hasNoInputs) return true;

  const allAcceptedTitles = expandAndCleanTitles([...safeTargetTitles, ...safeAlternativeTitles]);
  if (allAcceptedTitles.length === 0) return false;

  return allAcceptedTitles.some(target => {
    const targetWords = tokenizeAndClean(target);
    const jobWords = tokenizeAndClean(safeJobTitle);

    if (targetWords.length === 0) return false; // Prevent empty/stopword-only target from matching everything

    const hasAllTargetWords = targetWords.every(tWord => 
      jobWords.some(jWord => wordMatches(tWord, jWord))
    );

    if (strictness === 'exact') {
      if (!hasAllTargetWords) return false;
      
      const roleTypes = ["manager", "mgr", "director", "coordinator", "coord", "analyst", "specialist", "agent", "supervisor", "lead", "vp", "head", "officer", "assistant", "asst", "intern", "associate", "engineer", "consultant"];
      const targetRoles = targetWords.filter(w => roleTypes.includes(w));
      const jobRoles = jobWords.filter(w => roleTypes.includes(w));
      
      for (const jRole of jobRoles) {
        const isMatched = targetRoles.some(tRole => wordMatches(tRole, jRole));
        if (!isMatched) return false;
      }
      return true;

    } else if (strictness === 'strong') {
      return hasAllTargetWords;
    } else {
      const nonGenericTargetWords = targetWords.filter(w => !genericWords.includes(w));
      const wordsToCheck = nonGenericTargetWords.length > 0 ? nonGenericTargetWords : targetWords;
      return wordsToCheck.some(tWord => 
        jobWords.some(jWord => wordMatches(tWord, jWord))
      );
    }
  });
}

/**
 * Consolidates a list of target locations to prevent sequential queries
 * for small cities in the same state or redundant national queries.
 * Returns a deduplicated and consolidated list of locations (max 3).
 */
export function consolidateLocations(locations: string[], profileLocation?: string): string[] {
  if (!locations || locations.length === 0) {
    return profileLocation ? [profileLocation] : ["United States"];
  }

  // If we have 3 or fewer locations, keep them exactly as typed to maintain search precision!
  if (locations.length <= 3) {
    return Array.from(new Set(locations.map(l => l.trim()).filter(Boolean)));
  }

  // 1. Detect if a national/country-level location is present.
  const hasUS = locations.some(loc => {
    const l = loc.toLowerCase().trim();
    return l === "us" || l === "usa" || l === "united states" || l === "united states of america" || l === "nationwide";
  });
  const hasUK = locations.some(loc => {
    const l = loc.toLowerCase().trim();
    return l === "uk" || l === "gb" || l === "united kingdom" || l === "england" || l === "great britain";
  });

  // If a national search is requested alongside specific local cities, consolidate to the national level to avoid redundant queries
  if (hasUS) return ["United States"];
  if (hasUK) return ["United Kingdom"];

  // 2. Identify the default state/country context from profileLocation (e.g. "Edgewater, FL" -> "FL")
  let defaultStateOrCountry = "";
  if (profileLocation) {
    const parts = profileLocation.split(",");
    defaultStateOrCountry = parts[parts.length - 1]?.trim() || "";
  }

  const consolidated = new Set<string>();
  const statesAdded = new Set<string>();

  const stateNames: Record<string, string> = {
    "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas", "ca": "California",
    "co": "Colorado", "ct": "Connecticut", "de": "Delaware", "fl": "Florida", "ga": "Georgia",
    "hi": "Hawaii", "id": "Idaho", "il": "Illinois", "in": "Indiana", "ia": "Iowa",
    "ks": "Kansas", "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland",
    "ma": "Massachusetts", "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi", "mo": "Missouri",
    "mt": "Montana", "ne": "Nebraska", "nv": "Nevada", "nh": "New Hampshire", "nj": "New Jersey",
    "nm": "New Mexico", "ny": "New York", "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio",
    "ok": "Oklahoma", "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina",
    "sd": "South Dakota", "tn": "Tennessee", "tx": "Texas", "ut": "Utah", "vt": "Vermont",
    "va": "Virginia", "wa": "Washington", "wv": "West Virginia", "wi": "Wisconsin", "wy": "Wyoming"
  };

  const getStateCode = (locStr: string) => {
    const matches = locStr.match(/\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|florida|california|texas|new york|georgia|illinois|pennsylvania|ohio|michigan|north carolina|new jersey|virginia|washington|arizona|massachusetts|indiana|tennessee|maryland|colorado|minnesota|wisconsin|missouri|kentucky|oregon|oklahoma|connecticut|iowa|mississippi|arkansas|utah|kansas|nevada|new mexico|nebraska|west virginia|idaho|hawaii|maine|new hampshire|rhode island|montana|delaware|south dakota|north dakota|alaska|vermont|wyoming|london|uk|gb)\b/i);
    if (!matches) return null;
    const val = matches[1].toLowerCase();
    const stateMap: Record<string, string> = {
      "florida": "fl", "california": "ca", "texas": "tx", "new york": "ny", "georgia": "ga",
      "illinois": "il", "pennsylvania": "pa", "ohio": "oh", "michigan": "mi", "north carolina": "nc",
      "new jersey": "nj", "virginia": "va", "washington": "wa", "arizona": "az", "massachusetts": "ma",
      "indiana": "in", "tennessee": "tn", "maryland": "md", "colorado": "co", "minnesota": "mn",
      "wisconsin": "wi", "missouri": "mo", "kentucky": "ky", "oregon": "or", "oklahoma": "ok",
      "connecticut": "ct", "iowa": "ia", "mississippi": "ms", "arkansas": "ar", "utah": "ut",
      "kansas": "ks", "nevada": "nv", "new mexico": "nm", "nebraska": "ne", "west virginia": "wv",
      "idaho": "id", "hawaii": "hi", "maine": "me", "new hampshire": "nh", "rhode island": "ri",
      "montana": "mt", "delaware": "de", "south dakota": "sd", "north dakota": "nd", "alaska": "ak",
      "vermont": "vt", "wyoming": "wy"
    };
    return stateMap[val] || val;
  };

  for (const loc of locations) {
    const trimmed = loc.trim();
    if (!trimmed) continue;

    let state = getStateCode(trimmed);
    
    // If no state is explicitly mentioned in this location string, try to infer it from profile
    if (!state && defaultStateOrCountry) {
      state = getStateCode(defaultStateOrCountry);
    }

    if (state && stateNames[state]) {
      const stateName = stateNames[state];
      if (!statesAdded.has(stateName)) {
        consolidated.add(stateName);
        statesAdded.add(stateName);
      }
    } else if (state && (state === "uk" || state === "gb" || state === "london")) {
      if (!statesAdded.has("United Kingdom")) {
        consolidated.add("United Kingdom");
        statesAdded.add("United Kingdom");
      }
    } else {
      // Capitalize the first letter of each word for clean formatting
      const formattedLoc = trimmed.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      consolidated.add(formattedLoc);
    }
  }

  const result = Array.from(consolidated);
  // Cap consolidated locations to 3 to prevent excessive sequential API queries and function timeouts
  return result.slice(0, 3);
}

/**
 * Estimates commute minutes based on distance and region context.
 * For MVP Option A: Uses static speed assumptions based on US vs UK and urban vs rural context.
 */
export function estimateCommuteMinutes(distanceMiles: number, isUK: boolean, isUrban: boolean = false): number {
  if (distanceMiles <= 0) return 0;
  
  let speedMph = 40; // Default US Suburban (e.g. Florida)
  if (isUK) {
    speedMph = isUrban ? 18 : 35; // UK Urban (London) vs UK Rural/Suburban
  } else {
    speedMph = isUrban ? 20 : 40; // US Urban vs US Suburban
  }
  
  return Math.round((distanceMiles / speedMph) * 60);
}

/**
 * Estimates search radius in miles from commute minutes and region context.
 */
export function estimateRadiusFromCommute(commuteMinutes: number, isUK: boolean, isUrban: boolean = false): number {
  if (commuteMinutes <= 0) return 0;
  
  let speedMph = 40; // Default US Suburban
  if (isUK) {
    speedMph = isUrban ? 18 : 35;
  } else {
    speedMph = isUrban ? 20 : 40;
  }
  
  return Math.round((commuteMinutes / 60) * speedMph);
}
