# API Credentials Acquisition & Netlify Configuration Guide

Follow these step-by-step instructions to get your API credentials for JSearch, Adzuna, and USAJobs, and add them securely to Netlify.

---

## 1. JSearch API (Primary Scraper Aggregator)
Provides real-time results from LinkedIn, Indeed, Glassdoor, and ZipRecruiter.

1. Go to the [JSearch Page on RapidAPI](https://rapidapi.com/letscrape-6577-6577/api/jsearch).
2. If you don't have a RapidAPI account, sign up for a free account.
3. Click on the **Pricing** tab.
4. Select the **Hobby ($10.00/mo)** plan. This includes **1,000 requests/month**, which is more than enough for two active users running daily job searches.
5. Click **Subscribe** and complete checkout.
6. Once subscribed, go back to the **Endpoints** tab.
7. In the middle pane under the **Header Parameters** section, look for **`x-rapidapi-key`**.
8. Copy the long alphanumeric key value. This is your `RAPIDAPI_KEY`.

---

## 2. Adzuna API (Free Auxiliary Search)
Provides supplementary UK and US job search results.

1. Go to the [Adzuna Developer Portal](https://developer.adzuna.com/).
2. Click **Get Started** or **Register** to create a free developer account.
3. Once registered, log into your developer dashboard.
4. Go to **API Keys** or **Apps**.
5. Copy your:
   * **Application ID** (`ADZUNA_APP_ID`)
   * **Application Key** (`ADZUNA_APP_KEY`)

---

## 3. USAJobs API (Free US Federal & Operations Search)
Provides high-quality US government and public trust logistics/operations roles.

1. Go to the [USAJobs Developer Portal](https://developer.usajobs.gov/).
2. Click **Request API Key** or register a developer profile.
3. Enter your contact details and developer email (USAJobs requires this email address to authorize search queries).
4. Once approved, copy your **Authorization Key** (`USAJOBS_API_KEY`).
5. Your registered developer email will be used as `USAJOBS_USER_EMAIL`.

---

## 4. Configuring Netlify Environment Variables
To make these keys active on your production site:

1. Log into your [Netlify Dashboard](https://app.netlify.com/).
2. Navigate to your **Job Sentinel** site.
3. Go to **Site configuration** > **Environment variables**.
4. Click **Add a variable** > **Add single variable**.
5. Add the following environment variables (using the exact names below):

| Key Name | Value | Description |
|---|---|---|
| `RAPIDAPI_KEY` | *(your JSearch key)* | Authenticates JSearch scans |
| `ADZUNA_APP_ID` | *(your Adzuna App ID)* | Authenticates Adzuna scans |
| `ADZUNA_APP_KEY` | *(your Adzuna App Key)* | Authenticates Adzuna scans |
| `USAJOBS_API_KEY` | *(your USAJobs Auth Key)* | Authenticates USAJobs scans |
| `USAJOBS_USER_EMAIL` | *(your registered developer email)* | Header required by USAJobs |

6. Once saved, Netlify will encrypt these credentials at rest.
7. To apply the new environment variables, trigger a deploy: go to the **Deploys** tab on Netlify, click **Trigger deploy**, and select **Clear cache and deploy site**.

Your Job Sentinel system is already configured to read these keys dynamically on startup. Once they are deployed on Netlify, your search will instantly retrieve results.
