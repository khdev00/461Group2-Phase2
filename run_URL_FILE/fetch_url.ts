// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import winston from 'winston'; //Logging library

import * as git from 'isomorphic-git'; // For cloning repos locally and getting git metadata
import fs from 'fs'; // Node.js file system module for cloning repos  
import os from 'os'
import path from 'path'
const http = require("isomorphic-git/http/node");

dotenv.config();

//Logger initialization
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'info.log', level: 'info' }),
    ],
  });

class Package {
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
        const error = new Error("GitHub API key not found in environment variables.");
        logger.error(error);
        throw error;
    } else {
        logger.info("found github API key");
        return githubApiKey;
    }
}

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
            logger.error(`Error: ${err}`);
            packageObj.setContributors([]);
        });

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/readme`,{headers,})
        .then((response) => {
            const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageObj.setReadmeLength(readmeContent.length);
        })
        .catch ((err) => {
            logger.error(`Error: ${err}`);
            packageObj.setReadmeLength(0);
        });

    if (packageObj.contributors) {
        logger.info(`Contributors retrieved for ${owner}/${packageName}`);
    } else {
        logger.error(`Failed to retrieve contributors for ${owner}/${packageName}`);
    }

    if (packageObj.readmeLength) {
        logger.info(`Readme length retrieved for ${owner}/${packageName}`);
    } else {
        logger.error(`Failed to retrieve readme length for ${owner}/${packageName}`);
    }

    if (packageObj.contributors && packageObj.readmeLength) {
        logger.info(`Package {
            contributors: [
                ${packageObj.contributors ? packageObj.contributors.map((contributor) => `${contributor}`).join(',\n                ') : ''}
            ],
            readmeLength: ${packageObj.readmeLength}
        }`);
    }
    return packageObj;
}

async function cloneRepository(repoUrl: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), localDir));
    logger.info(`made directory: ${dir}`);
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
    .then((commits) => {
    logger.info(`Git log retrieved for ${repoUrl}`);
    commits.forEach((commit, index) => {
        logger.info(`Commit ${index + 1}:`);
        logger.info(`OID: ${commit.oid}`);
        logger.info(`Message: ${commit.commit.message}`);
        logger.info(`Parent: ${commit.commit.parent.join(', ')}`);
        logger.info(`Tree: ${commit.commit.tree}`);
        logger.info(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
        logger.info(`Committer: ${commit.commit.committer.name} <${commit.commit.committer.email}>`);
        logger.info(`GPG Signature: ${commit.commit.gpgsig}`);
    });
    })
    .catch((error) => {
        logger.error(`Failed to retrieve git log for ${repoUrl}: ${error.message}`);
    });

}
  
// Usage example
const githubToken = retrieveGithubKey();
const exampleUrl = new Url("https://github.com/cloudinary/cloudinary_npm", "cloudinary_npm", "cloudinary");

getPackageObject(exampleUrl.getPackageOwner(), exampleUrl.packageName, githubToken)
    .catch((error) => {
        logger.error(`Error while retrieving package object: ${error.message}`);
    });

const localDir = './fetch_url_cloned_repos';
cloneRepository(exampleUrl.url);

module.exports = {
    retrieveGithubKey,
    getPackageObject,
    cloneRepository
};