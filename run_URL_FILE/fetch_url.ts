// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API

import * as git from 'isomorphic-git'; // For cloning repos locally and getting git metadata
import fs from 'fs'; // Node.js file system module for cloning repos  
import os from 'os'
import path from 'path'
const http = require("isomorphic-git/http/node");

dotenv.config();

class Package {
    contributors: Array<string> = [];
    readmeLength: number = -1;
    rampUp: number = -1;
    hasLicense: boolean = false;

    setContributors(contributors: Array<string>) {
        this.contributors = contributors;
    }

    setReadmeLength(readmeLength: number) {
        this.readmeLength = readmeLength;
    }
    
    setRampUp(rampUp: number) {
        this.rampUp = rampUp;
    }

    setHasLicense(hasLicense: boolean) {
        this.hasLicense = hasLicense;
    }
  }

  class Url {
    url: string;
    packageName: string;
    packageOwner?: string;
  
    constructor(url: string, packageName: string, packageOwner?: string) {
        this.url = url;
        this.packageName = packageName;
        this.packageOwner = packageOwner;
    }

    getPackageOwner() {
        if(this.packageOwner) {
            return this.packageOwner;
        }
        return "";
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

function calculateRampUp(readmeLength: number) {
    let rampUpVal = 0;

    // Avg readme length is 2.5 paragraphs
    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let targetReadmeLength = 2.5 * 150 * 5; 
    let longestReadmeLength = 20 * 150 * 5; 

    // 100 is perfect length
    // 0 is very long or very short
    let readmeDifference = Math.abs(targetReadmeLength -  readmeLength);
    let readmeVal = 100 - (readmeDifference / longestReadmeLength) * 100;

    rampUpVal = readmeVal;

    return rampUpVal
}

// Useful for looking at which data you can access:
// https://docs.github.com/en/rest/overview/endpoints-available-for-github-app-installation-access-tokens?apiVersion=2022-11-28
async function getPackageObject(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const packageObj = new Package();

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/contributors`,{headers,})
        .then((response) => {
            const contributors = response.data.map((contributor: any) => contributor.login);
            packageObj.setContributors(contributors);
        })
        .catch ((err) => {
            console.error('Error:', err);
            packageObj.setContributors([]);
        });

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/readme`,{headers,})
        .then((response) => {
            const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageObj.setReadmeLength(readmeContent.length);
        })
        .catch ((err) => {
            console.error('Error:', err);
            packageObj.setReadmeLength(0);
        });

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/license`,{headers,})
        .then((response) => {
            packageObj.setHasLicense(true);
        })
        .catch ((err) => {
            //console.error('Error:', err);
            packageObj.setHasLicense(false);
        });

    return packageObj;
}

async function cloneRepository(repoUrl: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), localDir));
    console.log('made directory:', dir);
    fs.readdirSync(dir);

    await git.clone({
        http:http,
        fs,
        dir,
        url: repoUrl,
        singleBranch: true,
        depth: 10
    });

    fs.readdirSync(dir);
    await git.log({fs, dir}) 
    .then((response) => {
        console.log(response);
    })
}
  
// Usage example
const githubToken = retrieveGithubKey();
//const exampleUrl = new Url("https://github.com/cloudinary/cloudinary_npm", "cloudinary_npm", "cloudinary");
const exampleUrl = new Url("https://github.com/mghera02/461Group2", "461Group2", "mghera02");
//const exampleUrl = new Url("https://github.com/vishnumaiea/ptScheduler", "ptScheduler", "vishnumaiea");

getPackageObject(exampleUrl.getPackageOwner(), exampleUrl.packageName, githubToken)
    .then((returnedPackageObject) => {
        let packageObject = returnedPackageObject;
        console.log(packageObject);
    })

const localDir = './fetch_url_cloned_repos';
//cloneRepository(exampleUrl.url);
