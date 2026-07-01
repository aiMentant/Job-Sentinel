# Job Sentinel — Phase 2, 3, 4, 5, 6, 7 & 8 Walkthrough

## Phase 2 Changes Implemented

### 1. ADA Contrast Fix — Boolean Search Strings
**File:** `src/app/search/page.tsx`

The boolean search string code blocks previously used `text-gray-300` against a dark/transparent background — nearly invisible in light mode.

**Fix:** Replaced with `text-slate-800 dark:text-slate-200` and a proper `bg-slate-100 dark:bg-black/30` container. Text is now fully readable in both light and dark mode. Also added `select-all` class so users can click-to-select the entire string quickly.

---

### 2. Profile Access Control (Privacy)
**File:** `src/app/actions/jobActions.ts`

Regular users (Robert, Dominic, etc.) could previously see all profiles including admin/seed profiles (Lea W, Nick, etc.).

**Fix:**
- `listAllProfilesWithData()` now reads `auth_email`, `auth_role`, and `active_profile_id` from server-side cookies.
- **Admins** (`role === 'admin'` or `email === 'lwenban@gmail.com'`) see all profiles.
- **Regular users** only see their own profile (matched by `active_profile_id`) and any profiles they personally created (matched by `creatorEmail`).
- `saveUserProfile()` now automatically stamps `creatorEmail` from the auth cookie when saving any profile — so newly created profiles are immediately attributed to the creating user.

---

### 3. LinkedIn Scraper Removal + File Type Restriction
**Files:** `src/app/profile/page.tsx`, `src/app/actions/jobActions.ts`, `next.config.ts`

LinkedIn profile scraping via Playwright fails reliably in serverless production environments due to auth/bot detection walls.

**Fix:**
- Removed `handleLinkedInScrape` handler, `linkedInUrl` and `isScraping` state, and all associated UI (the LinkedIn Import panel).
- Removed `runLinkedInProfileScrape` and `safeLinkedInProfileScrape` from the profile page import.
- The profile form's LinkedIn URL field (used for outward linking) is preserved — only the scraper is removed.
- `parseUploadedFile()` in `jobActions.ts`: Replaced the entire `pdf-parse` code block with a clear user-facing error directing to DOCX or TXT.
- Upload UI now shows `accept=".txt,.docx"` and a hint: *"PDF not supported — use DOCX or TXT"*.
- Removed `pdf-parse` from `serverExternalPackages` in `next.config.ts`.

---

### 4. AI Anti-Detection & Human Cadence Tuning
**File:** `src/app/actions/careerTools.ts`

AI-generated career content was susceptible to LLM detection tools due to overused buzzwords and uniform sentence structures.

**Fix:** Added a shared `ANTI_DETECTION_RULES` constant injected into four prompts:
- `personalizeCoverLetter`
- `generateRecruiterMessage`
- `optimizeApplicationPackage`
- `refineTailoredMaterial`

The rules enforce:
- **Banned words:** Moreover, Furthermore, Delve, Synergy, Tapestry, Passion for, Thrilled to, Delighted to, Testament to, Embark, Leverage (as verb), Spearheaded (unless verbatim from user data), etc.
- **Burstiness:** Mix of short punchy sentences with longer flowing ones — no uniform cadence.
- **Active voice:** Prefer "managed / built / cut / grew" over "was responsible for".
- **Natural contractions** in letters/messages (not resume bullets).

---

## Phase 3 Changes Implemented

### 1. Dynamic Presets & Local Persistence
**File:** `src/app/search/page.tsx`

We replaced the hardcoded "Default UX Strategy" config preset. 

**Fix:**
- **Dynamic Default Preset**: On page load, the page automatically creates a locked preset called **"My Profile Default"** matching the logged-in user's active profile (`targetTitles`, `targetLocations`, `radius`, `sites`).
- **`localStorage` Sync**: User-created presets (saved via `+ Save Current`) are now saved to browser `localStorage` keyed by `profileId`. They persist forever on page reload.
- **Deletion Support**: Custom presets show a small `×` delete button next to their label to clear them from local storage. The default profile preset is locked and cannot be deleted.

---

### 2. Presets Tooltip & 50-Character Limit
**File:** `src/app/search/page.tsx`

**Fix:**
- Added a `HelpCircle` info button next to the "Saved Presets" title. Clicking it toggles a clean inline explanation card describing how filters are saved and loaded.
- Enforced a 50-character limit when creating custom presets. An error alert fires if the user enters a longer label, ensuring clean layout.

---

### 3. LinkedIn Copy-Paste Guide Alert
**File:** `src/app/profile/page.tsx`

**Fix:**
- Placed a clean callout box explaining the LinkedIn workaround guide directly below the file upload area.
- Steps explained: Press `Cmd/Ctrl + A` on their LinkedIn profile, copy it, paste the raw text into the input field, and click **AI Parse** to extract everything using Gemini.

---

### 4. Ghost & Harvesting Job Detection Banner
**File:** `src/app/search/page.tsx`

**Fix:**
- Added a premium glassmorphic orange warning banner at the top of search tab results describing the client-side heuristic scoring algorithm.

---

### 5. LinkedIn Source Badge Label Standardization
**Files:** `src/app/page.tsx`, `src/app/search/page.tsx`, `src/app/tracker/page.tsx`

**Fix:**
- Replaced all 5 instances of the short badge label `"in"` with `"LinkedIn"` to prevent confusion with Indeed.

---

## Phase 4 Changes Implemented

### 1. Ghost/Harvest Badge Labels & Multi-Line Tooltips
**Files:** `src/lib/jobUtils.ts`, `src/app/search/page.tsx`

**Fix:**
- Updated dynamic badge labels in `jobUtils.ts` from `"Ghost XX%"` or `"Suspect XX%"` to include the full `"Ghost/Harvest"` context explicitly (e.g. `Ghost/Harvest 90%`, `Likely Ghost/Harvest 75%`, `Suspect Ghost/Harvest 60%`).
- Updated the hover descriptions in `getGhostBadge()` to render the full bulleted list of the client-side heuristic checks (Posting Age, Description Length, Missing Salary, Generic Company Names, Harvesting Keywords) and the associated Risk Level.
- Added `whitespace-pre-line` to the search card hover tooltip container so lists render cleanly on separate lines.

---

### 2. Hide High-Risk Ghost Opportunities Filter
**File:** `src/app/search/page.tsx`

**Fix:**
- Added a checkbox filter **`Hide Ghost/Harvest (80%+)`** on the Search page filters bar.
- Updated search filtering logic: when the checkbox is checked, any job card with a calculated score of **80 or higher** is immediately excluded from the visible opportunities.

---

## Phase 5 Changes Implemented

### 1. Sequential Bulk AI Matches Analysis
**File:** `src/app/search/page.tsx`

**Fix:**
- Added an **"AI Analyze Matches"** button inside the floating batch actions bar at the bottom of the Search page.
- Sequential Queue: Clicking the button loops through checked `selectedIds`, displays progress feedback for each one (e.g., *"AI is analyzing (2/5)..."*), and retrieves match ratings sequentially. Sequenced execution prevents Gemini API concurrency conflicts.

---

### 2. Explanation Banner Removal (UI Cleanup)
**File:** `src/app/search/page.tsx`

**Fix:**
- Removed the large orange feature callout warning card from the top of the search tab. This prevents layout clutter and saves valuable vertical space, relying on the clean card tooltips for explanations.

---

## Phase 6 Changes Implemented

### 1. Heuristic Scoring Weights & Badge Threshold Adjustments
**File:** `src/lib/jobUtils.ts`

**Fix:**
- **Increased Keyword Weight**: Increased harvesting keyword weight (e.g. "talent pool", "pipeline") from `20` to `30` points inside `computeGhostScore()`.
- **Lowered Badge Thresholds**: Adjusted minimum scores in `getGhostBadge()` to display badges at lower thresholds:
  - `score >= 80`: Extreme Risk (`Ghost/Harvest`)
  - `score >= 60`: Likely Risk (`Likely Ghost/Harvest`)
  - `score >= 30`: Suspect Risk (`Suspect Ghost/Harvest`)
*This ensures fresh crawled jobs containing pooling/recruitment keywords are flagged on day one.*

---

## Post-Phase Style & UX Fixes

### 1. High-Contrast Keyword Highlight Accessibility
**Files:** `src/app/globals.css`, `src/app/search/page.tsx`

**Fix:**
- **Issue**: The text color inside highlighted keywords (like "Programme Director") in search result titles was yielding yellow-on-yellow/white-on-yellow styling, failing ADA readability audits.
- **Fix**: Added explicit `.keyword-highlight` CSS rules in `globals.css` specifying `#0f172a` (near-black) text on `#fef08a` (soft yellow) background for light mode, and high-contrast yellow-green text on deep yellow background for dark mode. Applied this class to all `<mark>` elements in `search/page.tsx`.

---

### 2. Unhidden Prominent "AI Analyze All" Action Button
**File:** `src/app/search/page.tsx`

**Fix:**
- **Issue**: Relying on selecting checkboxes to trigger bulk AI analysis was unintuitive and required extra clicks to process all visible search results.
- **Fix**: Added a prominent, unhidden **"AI Analyze All ([Count])"** button directly to the upper right actions bar of the search feed. Clicking this button immediately triggers sequential AI vetting of all currently visible search results without needing to check boxes first.

---

## Phase 7 Changes Implemented

### 1. Two Separate Focused Guide Modals (Setup & Search)
**File:** `src/components/HelpModal.tsx`
- Split the guides into two completely separate full-screen modals rather than using a single tabbed dialog. Modals adapt title and steps dynamically based on a `type: 'setup' | 'search'` configuration prop:
  - **🛠 Account Setup Guide**: A 2-step guide walking through profile settings, DOCX/TXT resume uploads, and detailed copy-paste instructions for the LinkedIn `li_at` cookie.
  - **🔍 Search Engine Guide**: A 2-step guide walking through every main page of the app (Dashboard, Job Search, Tracker, Interview Hub, Profile, and Submission Log) in a short, bulleted, human-friendly layout with extremely low cognitive load.

---

### 2. Auto-Trigger & Persistence Checking
**File:** `src/components/Sidebar.tsx`
- Checks on dashboard load if the active profile is missing critical search settings (empty target titles, empty target locations, or missing LinkedIn cookie).
- Automatically pops up the onboarding stepper on mount for unconfigured profiles.
- Incorporates a `localStorage` key override (`job_sentinel_setup_shown_${activeProfileId}`) when dismissed so the user is not repeatedly prompted on future page clicks.

---

### 3. Full-screen Terminal Initializing Console Loader
**File:** `src/components/ProfileContext.tsx`
- Added `isLoading` state boundaries during context initialization (fetching user data and cookie sessions from Supabase).
- Renders a full-screen, responsive console initializing screen (`"Initializing Console..."` with rotating spinner and active indicators) on site entry/switch. Bypasses the loading screen if the current page is `/login` so the login interface remains accessible.

---

### 4. Simplified Login Page Wording
**File:** `src/app/login/page.tsx`
- Simplified technical/nerdy submit button terminology to make the portal user-friendly for friends/family:
  - Changed default label `"Initialize Console"` to `"Log In"`.
  - Changed loading state `"Authenticating..."` to `"Logging In..."`.

---

### 5. Premium Full-Screen Modal Layouts with React Portals
**Files:** `src/components/HelpModal.tsx`, `src/app/search/page.tsx`
- Refactored all modals (Setup Guide, Search Guide, Quick Review, Missing Params, and Dismiss Confirm) to use client-side React Portals (`createPortal(..., document.body)`). This breaks them out of parent layout and sidebar backdrop-filter stacking contexts, ensuring they reliably span 100% of the screen width and height.
- Styled the modals with a premium `20px` margin/padding on all sides (`p-5 bg-black/80 backdrop-blur-sm`).

---

### 6. Relocated & Renamed Search Button
**File:** `src/app/search/page.tsx`
- Relocated the primary **Search Jobs** action button from below the fold to above the fold. It now sits directly below the **Match Strictness** selection and above **Suggest Smart Targets**.
- Renamed the button label from `"Start Standard Agent"` / `"Trigger Precision Scan"` to a unified `"Search Jobs"` for clarity.

---

## Phase 8: Free Three-API Aggregator Stack
**File:** `src/app/actions/jobActions.ts`
- Replaced the browser-based Playwright scrapers (which fail on Netlify/Vercel serverless environments) with a robust three-API job aggregator stack:
  1. **JSearch (via RapidAPI)**: Pulls real-time feeds from LinkedIn, Indeed, Glassdoor, and ZipRecruiter (up to 200 free requests/month).
  2. **Adzuna API**: Genuinely free API covering UK and US regional roles (incorporates automatic `gb`/`us` geolocation suffix detection and miles-to-km radius conversion).
  3. **USAJobs API**: Free API retrieving federal, public trust, and operations roles (requires `User-Agent` email identification).
- **Fallback Integration**: All three APIs execute in parallel. If API keys are missing or return no results, the system automatically falls back to local Playwright browser scraping, and then to the public Remotive fallback.
- **Improved Guardrails**: Prevents over-filtering by performing order-independent word matches for compound titles (e.g., `"Logistics Operations Manager"`) and checking multi-word locations.

---

## Verification

```
✓ npm run build — TypeScript clean, all 13 routes compiled successfully
```

## Manual Verification Checklist
- [ ] Sign in as Robert/Dominic → confirm they only see their own profile in the switcher.
- [ ] Confirm "My Profile Default" loaded dynamically on Search and custom presets can be saved/deleted.
- [ ] Check LinkedIn tags display "LinkedIn" instead of "in" across all views.
- [ ] Verify hover on Ghost/Harvest badge displays the detailed bulleted list of criteria on separate lines.
- [ ] Check "Hide Ghost/Harvest (80%+)" checkbox and verify high-scoring jobs are hidden.
- [ ] Check multiple jobs, click **AI Analyze Matches** in the batch bar, and confirm they analyze sequentially.
- [ ] Verify that highlighted search keywords (e.g. in title "Academy Programme Director") are fully readable with dark text on a yellow background.
- [ ] Click **AI Analyze All ([Count])** at the top right of the search feed, and confirm all visible jobs are processed in sequence.
- [ ] Confirm the "Initializing Console..." loading screen is displayed before page mount.
- [ ] Log in with an empty profile and verify the full-screen Setup Guide opens automatically.
- [ ] Click the **Account Setup Guide** button in the sidebar, verify the setup modal opens full-screen with 2px padding, displaying a 2-step setup workflow.
- [ ] Click the **Search Engine Guide** button in the sidebar, verify the search modal opens full-screen with 2px padding, displaying a 2-step search engine workflow.
- [ ] Open a job card's Quick Review modal, confirm the columns expand to take up full screen height, and close cleanly.
