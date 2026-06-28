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

  // Signal 1: Stale posting
  const daysOld = getDaysOld(job.postedAt, job.createdAt);
  if (daysOld > 45 && daysOld < 999) {
    score += 50;
  } else if (daysOld > 21 && daysOld < 999) {
    score += 30;
  }

  // Signal 2: Vague/short description
  const desc = job.description || '';
  if (!desc || desc === "Details fetched during search." || desc.length < 100) {
    score += 15;
  }

  // Signal 3: No salary range
  if (!job.salaryRange && !job.salary_range) {
    score += 10;
  }

  // Signal 4: Generic company name
  const comp = (job.company || '').toLowerCase();
  if (comp.includes("enterprise partner") || comp.includes("company") || comp.includes("employer")) {
    score += 5;
  }

  // Signal 5: Harvesting keywords in description or reason
  const textToScan = `${desc} ${job.reason || ''}`.toLowerCase();
  const harvestingKeywords = [
    "talent pool",
    "future openings",
    "pipeline",
    "talent community",
    "always accepting",
    "evergreen",
    "general application",
    "resume bank",
    "future consideration",
    "speculative"
  ];

  if (harvestingKeywords.some(keyword => textToScan.includes(keyword))) {
    score += 30;
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
