// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import winston from 'winston'; //Logging library

//import * as ndjson from 'ndjson';
import ndjson from 'ndjson';
import * as git from 'isomorphic-git'; // For cloning repos locally and getting git metadata
import fs from 'fs'; // Node.js file system module for cloning repos  
import os from 'os'
import path from 'path'
const http = require("isomorphic-git/http/node");

dotenv.config();

// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf: number = 5; 

//Logger initialization
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'info.log', level: 'info' }),
    ],
  });

export class Package {
    url: string = "";
    contributors:Map<string, number> = new Map();
    readmeLength: number = -1;
    rampUp: number = -1;
    hasLicense: boolean = false;
    busFactor: number = -1;
    netScore: number = -1;

    setContributors(contributors: Map<string, number>) {
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

    setBusFactor(busFactor: number) {
        this.busFactor = busFactor;
    }

    setURL(url: string) {
        this.url = url
    }

    printMetrics() {
        const output = {
            URL : this.url,                             
            NET_SCORE: this.netScore,                   // This metric has a field, but is not implemented
            RAMP_UP_SCORE: this.rampUp,                 // This metric has a field, but is not implemented 
            CORRECTNESS_SCORE: -1,                      // This metric doesn't seem have a field in this class yet
            BUS_FACTOR_SCORE: this.busFactor,           // Implemented!
            RESPONSIVE_MAINTAINER_SCORE: -1,            // This metric doesn't seem have a field in this class yet
            LICENSE_SCORE: Number(this.hasLicense)      // Implemented!
        }

        const stringify = ndjson.stringify();
        stringify.write(output);
        stringify.end();  // Close the NDJSON serialization

        stringify.on('data', (line: string) => {
          process.stdout.write(line);
        });
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

    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    rampUpVal = Math.round(rampUpVal * (10 ** rf)) / (10 ** rf);

    return rampUpVal
}

async function readReadmeFile(repoUrl: string) {
    const readmePath = `${repoUrl}/README.md`; // Adjust the filename if necessary
    try {
      const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');
      //console.log('README Content:');
      //console.log(readmeContent);
      return `${readmeContent}`;
    } catch (error) {
      //console.error('Error reading README:', error);
      return '';
    }
  }

function calculateBusFactor(readmeLength: number, contributors: Map<string, number>) {
    let busFactorVal = 0;

    // Avg word count in 1 paragraph is 150 words
    // Avg character per word is 5
    let longestReadmeLength = 15 * 150 * 5; 
    // 100 is perfect length
    // 0 is too short
    let readmeVal = 0;
    if(readmeLength > longestReadmeLength) {
        readmeVal = 100;
    } else {
        let readmeDifference = longestReadmeLength -  readmeLength;
        readmeVal = 100 - (readmeDifference / longestReadmeLength) * 100;
    }

    // Take distrubution of number of commits per contributor
    // If one contributor does a disproportionate number of the commits, it is a lower score
    // 2/3 of equation is based on distributed contributor commit #, 1/3 is number of contributors
    let totalCommits = 0;
    let contributorsNum = 0;
    let contributorsVal = 0;
    contributors.forEach((value: number, key: string) => {
        totalCommits += value;
        contributorsNum++;
    });
    contributors.forEach((value: number, key: string) => {
        contributorsVal += 100 - ((value/totalCommits) * 100);
    });
    contributorsVal /= contributorsNum;
    if(contributorsNum > 20) {
        contributorsNum = 20;
    }
    contributorsVal = (contributorsNum/20 * 100) / 3 + 2 * contributorsVal / 3;

    // Bus factor is average of readmeVal and contributorVal
    busFactorVal = (readmeVal + contributorsVal) / 2;

    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    busFactorVal = Math.round(busFactorVal * (10 ** rf)) / (10 ** rf);

    return busFactorVal
}

// Useful for looking at which data you can access:
// https://docs.github.com/en/rest/overview/endpoints-available-for-github-app-installation-access-tokens?apiVersion=2022-11-28
async function getPackageObject(owner: string, packageName: string, token: string, packageObj: Package) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    /*(await axios.get(`https://api.github.com/repos/${owner}/${packageName}/contributors`,{headers,})
        .then((response) => {
            const contributors = response.data.map((contributor: any) => contributor.login);
        })
        .catch ((err) => {
            console.error('Error:', err);
        });*/

    /*await axios.get(`https://api.github.com/repos/${owner}/${packageName}/readme`,{headers,})
        .then((response) => {
            const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageObj.setReadmeLength(readmeContent.length);
        })
        .catch ((err) => {
            console.error('Error:', err);
            packageObj.setReadmeLength(0);
        });*/

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

async function cloneRepository(repoUrl: string, packageObj: Package) {
    packageObj.setURL(repoUrl);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), localDir));
    logger.info(`made directory: ${dir}`);
    fs.readdirSync(dir);

    await git.clone({
        http:http,
        fs,
        dir,
        url: repoUrl,
        singleBranch: true,
        depth: 200    
    });

    fs.readdirSync(dir);
    let repoAuthors = new Map();
    await git.log({fs, dir}) 
    .then((response) => {
        // Get commit authors
        response.forEach(function (val) {
            let authorEmail = `${val.commit.author.email}`;
            if(!authorEmail.includes('github')) {
                if(repoAuthors.get(authorEmail) !== undefined) {
                    repoAuthors.set(authorEmail, repoAuthors.get(authorEmail) + 1);
                } else {
                    repoAuthors.set(authorEmail, 1);
                }
            }
        }); 
    })

    packageObj.setContributors(repoAuthors);
    logger.info(repoAuthors);

    // Get readme length
    await readReadmeFile(dir).then ((response) => {
        packageObj.setReadmeLength(response.length);
    });
    
    packageObj.setBusFactor(calculateBusFactor(packageObj.readmeLength, packageObj.contributors));
    return packageObj;
}
  
// Usage example
const githubToken = retrieveGithubKey();
//const exampleUrl = new Url("https://github.com/cloudinary/cloudinary_npm", "cloudinary_npm", "cloudinary");
const exampleUrl = new Url("https://github.com/mghera02/461Group2", "461Group2", "mghera02");
//const exampleUrl = new Url("https://github.com/vishnumaiea/ptScheduler", "ptScheduler", "vishnumaiea");

let packageObj = new Package();

getPackageObject(exampleUrl.getPackageOwner(), exampleUrl.packageName, githubToken, packageObj)
    .then((returnedPackageObject) => {
        packageObj = returnedPackageObject;
        //console.log(packageObj);
    })

const localDir = './fetch_url_cloned_repos';
cloneRepository(exampleUrl.url, packageObj).then ((response) => {
    packageObj = response;
    //console.log(packageObj);
    packageObj.printMetrics();
});

module.exports = {
    retrieveGithubKey,
    getPackageObject,
    cloneRepository
};
