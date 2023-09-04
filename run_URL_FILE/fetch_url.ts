// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API

dotenv.config();

class Repo {
    contributors?: Array<string>;
    readmeLength?: Number;
  
    constructor(contributors?: Array<string>, readmeLength?: Number) {
        this.contributors = contributors;
        this.readmeLength = readmeLength;
    }

    setContributors(contributors?: Array<string>) {
        this.contributors = contributors;
    }

    setReadmeLength(readmeLength?: Number) {
        this.readmeLength = readmeLength;
    }
    
  }

function retrieveGithubKey() {
    const githubApiKey = process.env.GITHUB_TOKEN;
    if (!githubApiKey) {
        console.error("GitHub API key not found in environment variables.");
        process.exit(1);
    } else {
        console.log("found github API key");
        return githubApiKey;
    }
} 

async function getRepoObject(owner: string, repo: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const repoObj = new Repo();

    await axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors`,{headers,})
        .then((response) => {
            const contributors = response.data.map((contributor: any) => contributor.login);
            repoObj.setContributors(contributors);
        })
        .catch ((err) => {
            console.error('Error:', err);
            repoObj.setContributors([]);
        });

    await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`,{headers,})
        .then((response) => {
            const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
            repoObj.setReadmeLength(readmeContent.length);
        })
        .catch ((err) => {
            console.error('Error:', err);
            repoObj.setReadmeLength(0);
        });

    return repoObj;
  }
  
  // Usage example
  const githubToken = retrieveGithubKey();
  let repoObject;
  getRepoObject('axios', 'axios', githubToken)
    .then((returnedRepoObject) => {
        repoObject = returnedRepoObject;
        console.log(repoObject);
    })
