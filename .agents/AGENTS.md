# Project Rules & Workspace Customizations

## ⚠️ Session Startup Reminder: API Credentials Pending

When beginning the next agent session, check if the user has finished adding the external job discovery API keys:
1. **JSearch (via RapidAPI)**: (Hobby tier key, $10/mo)
2. **Adzuna**: (Free credentials)
3. **USAJobs**: (Free credentials)

These keys must be added as environment variables in the **Netlify Dashboard** (or in `.env.local` for local command line testing):
- `RAPIDAPI_KEY`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `USAJOBS_API_KEY`
- `USAJOBS_USER_EMAIL`

### Current Status:
- The Playwright browser-based scraper is currently offline because the `BROWSERLESS_API_KEY` quota is exceeded (returning a 401 error).
- JSearch, Adzuna, and USAJobs APIs are fully integrated into the `runJobSearch` server action in `src/app/actions/jobActions.ts`. If environment variables are missing, they skip dynamically and fall back to a key-less query on **The Muse API** (which expands to Florida state-level roles and matches them locally for Dominic).
