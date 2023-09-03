// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_API_KEY=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv';
dotenv.config();
const githubApiKey = process.env.GITHUB_API_KEY;

if (!githubApiKey) {
    console.error("GitHub API key not found in environment variables.");
    process.exit(1);
} else {
    console.log("found github API key")
}