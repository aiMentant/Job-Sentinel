export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  score: number;
  reason: string;
  status: 'new' | 'reviewed' | 'applied' | 'rejected' | 'interview' | 'offered' | 'interviewing';
  url: string;
  source: string;
  createdAt: string;
  // Enrichment fields
  isFavourite?: boolean;
  salaryRange?: string;           // e.g. "£70,000 – £90,000" or null if not listed
  postedAt?: string;              // ISO date string from listing, if available
  ghostScore?: number;            // 0–100, higher = more likely a ghost/recurring post
  applicationStatus?: ApplicationStatus;
  tailoredResumeText?: string;    // AI-rewritten resume for this specific job
  coverLetterText?: string;       // AI cover letter for this specific job
  recruiterHookLinkedin?: string; // AI-generated LinkedIn hook
  recruiterHookEmail?: string;    // AI-generated Email follow-up
  applicationNotes?: string;      // User notes / recruiter contact
  submittedAt?: string;           // When the application was submitted
  formFieldAnswers?: Record<string, string>; // Saved answers for unusual form fields
};

export type ApplicationStatus = {
  stage: 'draft' | 'ready' | 'submitted' | 'acknowledged' | 'interviewing' | 'offered' | 'rejected';
  supervisedRound?: boolean;      // Was this a supervised submission?
  receiptScreenshot?: string;     // Path to submission screenshot
  lastUpdated: string;
};

export type WorkExperience = {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  achievements: string[];
};

export type Education = {
  institution: string;
  degree: string;
  field: string;
  graduationYear: string;
};

export type SalaryExpectations = {
  currency: 'GBP' | 'USD' | 'EUR';
  minimumAcceptable: number;
  targetSalary: number;
  maximumAsk: number;
  negotiable: boolean;
};

// Reusable answers to common screening questions across applications
export type QuickAnswer = {
  id: string;
  question: string;         // The field label / question text
  answer: string;           // The stored answer
  usedCount: number;        // How many times this has been auto-applied
  lastUsed?: string;        // ISO date
};

export type UserProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  portfolioUrl: string;
  portfolioPassword?: string;
  linkedInUrl?: string;
  resumeText: string;           // SOURCE OF TRUTH — never overwritten by AI
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  summary: string;
  targetTitles?: string[];
  targetLocations?: string[];
  searchRadius?: number;
  // Application pipeline fields
  salaryExpectations?: SalaryExpectations;
  quickAnswers?: QuickAnswer[];   // Reusable answer bank for screening questions
  workAuthorisation?: string;     // e.g. "UK citizen", "Require sponsorship"
  noticePeriod?: string;          // e.g. "1 month", "Immediately available"
  applicationDailyLimit?: number; // Max applications per day (default: 15)
  supervisedModeCount?: number;   // How many supervised rounds before going autonomous
};


// Mock data for initial UI
export const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Senior Product Designer',
    company: 'Experian',
    location: 'Nottingham (Hybrid)',
    description: 'Looking for a seasoned designer to lead our Fintech division...',
    score: 92,
    reason: 'Matches your 15+ years of experience and previous work in enterprise systems.',
    status: 'new',
    url: 'https://linkedin.com/jobs/123',
    source: 'LinkedIn',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Staff UX Strategist',
    company: 'Boots',
    location: 'Nottingham (On-site)',
    description: 'Define the future of retail pharmacy UX...',
    score: 88,
    reason: 'Direct match for UX Strategy skills and local East Midlands presence.',
    status: 'new',
    url: 'https://indeed.com/jobs/456',
    source: 'Indeed',
    createdAt: new Date().toISOString(),
  }
];
