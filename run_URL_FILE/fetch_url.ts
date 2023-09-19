// How to run this file
// Once you have npm ts-node installed, use ts-node ./run_URL_FILE/fetch_url.ts
// You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
// Make sure your .env is in .gitignore

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import winston, { Logform } from 'winston'; //Logging library
import { getLogger } from './logger';

//import * as ndjson from 'ndjson';
import ndjson from 'ndjson';
import * as git from 'isomorphic-git'; // For cloning repos locally and getting git metadata
import fs from 'fs'; // Node.js file system module for cloning repos  
import os from 'os'
import path from 'path'
import { print } from 'graphql';
const http = require("isomorphic-git/http/node");

import { execSync } from 'child_process';

dotenv.config();

// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf: number = 5;

//Logger initialization
const logger = getLogger();

export class Package {
    url: string = "";
    contributors:Map<string, number> = new Map();
    readmeLength: number = -1;
    rampUp: number = -1;
    hasLicense: boolean = false;
    busFactor: number = -1;
    correctness: number = -1;
    responsiveMaintainer: number = -1;
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

    setCorrectness(correctness: number) {
        this.correctness = correctness;
    }

    setResponsiveMaintainer(responsiveMaintainer: number) {
        this.responsiveMaintainer = responsiveMaintainer;
    }

    setNetScore(netScore: number) {
        this.netScore = netScore;
    }

    printMetrics() {
        const output = {
            URL : this.url,                             
            NET_SCORE: this.netScore,                                    // Implemented!
            RAMP_UP_SCORE: this.rampUp,                                  // Implemented! 
            CORRECTNESS_SCORE: this.correctness,                         // Implemented!
            BUS_FACTOR_SCORE: this.busFactor,                            // Implemented!
            RESPONSIVE_MAINTAINER_SCORE: this.responsiveMaintainer,      // Implemented!
            LICENSE_SCORE: Number(this.hasLicense)                       // Implemented!
        }
        logger.debug(`README Length: ${this.readmeLength}`);
        logger.debug('Contributors:');
        this.contributors.forEach((contributions, contributor) => {
            logger.debug(`  ${contributor}: ${contributions}`);
        });

        const stringify = ndjson.stringify();
        stringify.write(output);
        stringify.end();  // Close the NDJSON serialization

        stringify.on('data', (line: string) => {
          process.stdout.write(line);
        });

        logger.debug(`URL: ${this.url}`);
        logger.debug(`NET_SCORE: ${this.netScore}`);
        logger.debug(`RAMP_UP_SCORE: ${this.rampUp}`);
        logger.debug(`CORRECTNESS_SCORE: ${this.correctness}`);
        logger.debug(`BUS_FACTOR_SCORE: ${this.busFactor}`);
        logger.debug(`RESPONSIVE_MAINTAINER_SCORE: ${this.responsiveMaintainer}`);
        logger.debug(`LICENSE_SCORE: ${Number(this.hasLicense)}`);

        logger.info(`Metrics score outputted to stdout, URL: ${this.url}`)
    }
  }

  class Url {
    url: string;
    packageName: string;
    packageOwner?: string | null;
  
    constructor(url: string, packageName: string, packageOwner?: string | null) {
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

    getPackageName() {
        return this.packageName;
    }
  }

function retrieveGithubKey() {
    const githubApiKey = process.env.GITHUB_TOKEN;
    if (!githubApiKey) {
        const error = new Error("GitHub API key not found in environment variables.");
        logger.error(error);
        throw error;
    } else {
        logger.info("Found github API key");
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
    let readmeVal = 100 - Math.min(1, readmeDifference / longestReadmeLength) * 100;
    rampUpVal = readmeVal;
    rampUpVal /= 100;

    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    rampUpVal = Math.round(rampUpVal * (10 ** rf)) / (10 ** rf);

    logger.debug(`Calculated rampup value of: ${rampUpVal}`);

    return rampUpVal;
}

async function readReadmeFile(repoUrl: string) {
    const readmePath = `${repoUrl}/README.md`; // Adjust the filename if necessary
    try {
      const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');
      logger.debug(`Read from ReadMe file, repo URL: ${repoUrl}`)
      return `${readmeContent}`;
    } catch (error) {
      //console.error('Error reading README:', error);
      logger.debug(`Failed to read ReadMe file, repo URL: ${repoUrl}`);
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
    busFactorVal = ((readmeVal + contributorsVal) / 2)/100;
    // Rounds to rf decimal places without padding with 0s (rf defined globally)
    busFactorVal = Math.round(busFactorVal * (10 ** rf)) / (10 ** rf);

    logger.debug(`Calculated bus factor of: ${busFactorVal}`);

    return busFactorVal
}

async function getUserStars(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}`, { headers });
        const stars = response.data.stargazers_count || 0; 
        logger.debug(`Obtained user stars: ${stars} stars`)
        return stars;
    } catch (error) {
        logger.info(`Error fetching star count: ${error}`);
        logger.error(`Error fetching star count: ${error}`);
        return 0; 
    }
}

async function getOpenIssuesCount(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=open`, { headers });
        const openIssuesCount = response.data.length || 0; 
        return openIssuesCount;
    } catch (error) {
        logger.error(`Error fetching open issues count: ${error}`);
        logger.info(`Error fetching open issues count: ${error}`);
        return 0; 
    }
}

async function calculateCorrectness(owner: string, packageName: string, token: string) {
    try {
        const stars = await getUserStars(owner, packageName, token);
        const openIssues = await getOpenIssuesCount(owner, packageName, token);

        const starsWeight = 0.4;
        const issuesWeight = 0.6;
        const correctnessScore = (stars * starsWeight / 100) + (0.6 - (0.6 * openIssues * issuesWeight / 100));

        const correctness = Math.round(correctnessScore * (10 ** rf)) / (10 ** rf);
        logger.debug(`Calculated correctness value of: ${correctness}`);

        return correctness
      
    } catch (error) {
        logger.error(`Error calculating correctness metric: ${error}`);
        logger.info(`Error calculating correctness metric: ${error}`);
        return -1; 
    }
}

async function getCommitFrequency(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/commits`, { headers });

        const commitData = response.data;
        if (commitData.length < 2) {
            //not enough commits for frequency calculation
            return 0;
        }

        //sort commitData by commit timestamp in ascending order
        commitData.sort((a: any, b: any) => {
            const timestampA = new Date(a.commit.author.date).getTime();
            const timestampB = new Date(b.commit.author.date).getTime();
            return timestampA - timestampB;
        });

        //calculate the average time between commits in milliseconds
        let totalTimeInterval = 0;
        for (let i = 1; i < commitData.length; i++) {
            const commitDate = new Date(commitData[i].commit.author.date);
            const prevCommitDate = new Date(commitData[i - 1].commit.author.date);
            const timeInterval = commitDate.getTime() - prevCommitDate.getTime();
            totalTimeInterval += timeInterval;
        }

        const averageTimeInterval = totalTimeInterval / (commitData.length - 1);
        const frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);

        logger.debug(`Calculated commit frequency of: ${frequency}`)

        return frequency;
    } catch (error) {
        logger.info(`Error fetching commit frequency: ${error}`);
        logger.error(`Error fetching commit frequency: ${error}`);
        return 0; 
    }
}

async function getIssueResolutionTime(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=closed`, { headers });

        const issueData = response.data;
        if (issueData.length === 0) {
            return 0;
        }

        //calculate the average time between issue creation and resolution in milliseconds
        let totalTimeInterval = 0;
        let resolvedIssueCount = 0;
        for (const issue of issueData) {
            if (issue.state === 'closed' && issue.created_at && issue.closed_at) {
                const createDate = new Date(issue.created_at);
                const resolveDate = new Date(issue.closed_at);
                const timeInterval = resolveDate.getTime() - createDate.getTime();
                totalTimeInterval += timeInterval;
                resolvedIssueCount++;
            }
        }
        logger.info(`issues: ${resolvedIssueCount}`);
        if (resolvedIssueCount === 0) {
            return 0;
        }

        const averageTimeInterval = totalTimeInterval / resolvedIssueCount;
        const frequency = ((1000 * 60 * 60 * 24 * 365) - averageTimeInterval) / (1000 * 60 * 60 * 24 * 365);

        logger.debug(`Calculated user resolution time of: ${frequency}`)

        return frequency;
    } catch (error) {
        logger.error(`Error fetching issue resolution time: ${error}`);
        logger.info(`Error fetching issue resolution time: ${error}`);
        return 0;
    }
}

async function calculateResponsiveMaintainer(owner: string, packageName: string, token: string) {
    try {
        const commitFrequency = await getCommitFrequency(owner, packageName, token);
        const issueResolutionTime = await getIssueResolutionTime(owner, packageName, token);
        //logger.info(`commit freq: ${commitFrequency}`);
        //logger.info(`issue resol: ${issueResolutionTime}`);

        const commitFrequencyWeight = 0.3;
        const issueResolutionWeight = 0.7;
        const responsiveMaintainerScore = commitFrequency * commitFrequencyWeight + issueResolutionTime * issueResolutionWeight;

        const score = Math.round(responsiveMaintainerScore * (10 ** rf)) / (10 ** rf);

        logger.debug(`Calculated responsive maintainer score of: ${score}`)

        return score;
    } catch (error) {
        logger.error(`Error calculating responsive maintainer score: ${error}`);
        logger.info(`Error calculating responsive maintainer score: ${error}`);
        return -1; 
    }
}

function calculateNetScore(packageObj: Package) {
    let netScore = 0.4 * packageObj.responsiveMaintainer + 0.3 * packageObj.rampUp + 0.15 * packageObj.correctness + 0.1 * packageObj.busFactor + 0.05 * Number(packageObj.hasLicense);
    let roundedNetScore = Math.round(netScore * (10 ** rf)) / (10 ** rf);

    logger.info(`Calculated net-score: ${roundedNetScore}, for package with URL: ${packageObj.url}`)

    return roundedNetScore;
}

// Useful for looking at which data you can access:
// https://docs.github.com/en/rest/overview/endpoints-available-for-github-app-installation-access-tokens?apiVersion=2022-11-28
async function getPackageObject(owner: string, packageName: string, token: string, packageObj: Package) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    
    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/contributors`, { headers })
    .then((response) => {
        const contributorsData = response.data;
        const contributorsMap = new Map<string, number>();

        contributorsData.forEach((contributor: any) => {
            const username = contributor.login;
            const contributions = contributor.contributions; 
            contributorsMap.set(username, contributions);
        });

        packageObj.setContributors(contributorsMap);
    })
    .catch((err) => {
        logger.error(`Error on axios.get: ${err}`);
        logger.info(`Error on axios.get: ${err}`);
        packageObj.setContributors(new Map()); 
    });

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/readme`,{headers,})
        .then((response) => {
            const readmeContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
            packageObj.setReadmeLength(readmeContent.length);
        })
        .catch ((err) => {
            logger.error(`Error: ${err}`);
            packageObj.setReadmeLength(-1);
        });

    await axios.get(`https://api.github.com/repos/${owner}/${packageName}/license`,{headers,})
        .then((response) => {
            if (response.status == 200) {
                packageObj.setHasLicense(true);
            }
        })
        .catch ((err) => {
            logger.error(`Failed to get license status: ${err}`);
            packageObj.setHasLicense(false);
        });

    if (packageObj.contributors) {
        logger.info(`Contributors retrieved for ${owner}/${packageName}`);
    } else {
        logger.error(`Failed to retrieve contributors for ${owner}/${packageName}`);
        logger.info(`Failed to retrieve contributors for ${owner}/${packageName}`);
    }

    if (packageObj.readmeLength != -1) {
        logger.info(`Readme length retrieved for ${owner}/${packageName}`);
    } else {
        logger.error(`Failed to retrieve readme length for ${owner}/${packageName}`);
        logger.info(`Failed to retrieve readme length for ${owner}/${packageName}`);
    }

    await calculateCorrectness(owner, packageName, token).then((correctness) => {
        packageObj.setCorrectness(correctness);
    });

    const responsiveMaintainer = await calculateResponsiveMaintainer(owner, packageName, token);
    packageObj.setResponsiveMaintainer(responsiveMaintainer);

    return packageObj;
}

async function removeDirectory(dirPath: string) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
  
      for (const file of files) {
        const filePath = `${dirPath}/${file}`;
  
        if (fs.lstatSync(filePath).isDirectory()) {
          await removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
  
      fs.rmdirSync(dirPath);
    }
}

async function cloneRepository(repoUrl: string, packageObj: Package) {
    packageObj.setURL(repoUrl);
    const localDir = './fetch_url_cloned_repos';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), localDir));
    logger.info(`made directory: ${dir}`);
    fs.readdirSync(dir);

    try {    
        // await git.clone({
        // http:http,
        // fs,
        // dir,
        // url: repoUrl,
        // singleBranch: true,
        // depth: 200    
        // });
    }
    catch (error) {
        logger.error(`Could not clone repository: error code ${error}`)
        logger.info(`Could not clone repository: error code ${error}`)
        return packageObj;
    }

    fs.readdirSync(dir);

    let repoAuthors = new Map();
    await git.log({fs, dir}) 
    .then((commits) => {
        /*logger.info(`Git log retrieved for ${repoUrl}`);
    commits.forEach((commit, index) => {
        logger.info(`Commit ${index + 1}:`);
        logger.info(`OID: ${commit.oid}`);
        logger.info(`Message: ${commit.commit.message}`);
        logger.info(`Parent: ${commit.commit.parent.join(', ')}`);
        logger.info(`Tree: ${commit.commit.tree}`);
        logger.info(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
        logger.info(`Committer: ${commit.commit.committer.name} <${commit.commit.committer.email}>`);
        logger.info(`GPG Signature: ${commit.commit.gpgsig}`);*/
    })
    .catch((error) => {
        logger.error(`Failed to retrieve git log for ${repoUrl}: ${error.message}`);
        logger.info(`Failed to retrieve git log for ${repoUrl}: ${error.message}`);
    });
    
    packageObj.setBusFactor(calculateBusFactor(packageObj.readmeLength, packageObj.contributors));
    packageObj.setRampUp(calculateRampUp(packageObj.readmeLength));
    packageObj.setNetScore(calculateNetScore(packageObj));

    //await removeDirectory(dir);
    return packageObj;
}

async function calculateAllMetrics(urlObjs: Url[]) {

    const packageObjs: Package[] = [];

    for await(let url of urlObjs) {
        let packageObj = new Package;
        await getPackageObject(url.getPackageOwner(), url.packageName, githubToken, packageObj)
            .then((returnedPackageObject) => {
                packageObj = returnedPackageObject;
            })

        let repoUrl = `https://github.com/${url.getPackageOwner()}/${url.packageName}`;
        await cloneRepository(repoUrl, packageObj).then ((returnedPackageObject) => {
            packageObj = returnedPackageObject;
        });

    await cloneRepository(url.url, packageObj).then ((response) => {
        packageObj = response;
    });

        //console.log(packageObj);
        packageObjs.push(packageObj);
    }

    return packageObjs;
}

// Asynchronous function to fetch URLs from a given file path.
async function fetchUrlsFromFile(filePath: string) {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
  
      const lines = data.split('\n');
  
      const urls: Url[] = [];
  
      for (let line of lines) {
        line = line.trim();
  
        if (line.startsWith('http') && (line.includes('npmjs.com') || line.includes('github.com'))) {
          let packageName = '';
          let packageOwner: string | null = '';   
          
          if (line.includes('npmjs.com')) {
            const parts = line.split('/');
            packageName = parts[parts.length - 1];
            packageOwner = null;

            // Try to get GitHub details from npm package URL.
            const githubDetails = await getGithubDetailsFromNpm(line);
            if(githubDetails) {
              packageOwner = githubDetails.owner;
              packageName = githubDetails.name;
            }
          } 
          else if (line.includes('github.com')) {
            const parts = line.split('/');
            packageName = parts[parts.length - 1];
            packageOwner = parts[parts.length - 2];
          }
  
          const urlObj = new Url(line, packageName, packageOwner);
          urls.push(urlObj);
        } 
        else {

          logger.info(`Invalid URL format: ${line}`);
        }
      }
      return urls;
    } 
    catch (error) {
      console.error('Error reading file:', error);
      return [];
    }
}

async function getGithubDetailsFromNpm(npmUrl: string) {
  try {
    // Fetch package data from npm registry API.
    const packageName = npmUrl.split('/').pop();
    const res = await axios.get(`https://registry.npmjs.org/${packageName}`);
    
    // Try to find GitHub repository URL from npm package data.
    const repositoryUrl = res.data.repository && res.data.repository.url;
    
    if (repositoryUrl && repositoryUrl.includes('github.com')) {
      // Extract and return repository owner and name from GitHub URL.
      const parts = repositoryUrl.split('/');
      const name = parts[parts.length - 1].replace('.git', '');
      const owner = parts[parts.length - 2];
      return { name, owner };
    }
  } 
  catch (error) {
    console.error('Error fetching npm package data:', error);
    return null;
  }
}

function printAllMetrics(packages: Package[]) {
    for (const packageObj of packages) {
        packageObj.printMetrics();
    }
}
  
  
// Usage example
const  githubToken = retrieveGithubKey();
// const exampleUrl = new Url("https://github.com/cloudinary/cloudinary_npm", "cloudinary_npm", "cloudinary");
// const exampleUrl = new Url("https://github.com/mghera02/461Group2", "461Group2", "mghera02");
// const exampleUrl = new Url("https://github.com/vishnumaiea/ptScheduler", "ptScheduler", "vishnumaiea");


let urlsFile = "./run_URL_FILE/urls.txt";
let urlObjs : Url[] = [];

fetchUrlsFromFile(urlsFile).then((urls) => {
    //console.log(urls);
    urlObjs = urls
    calculateAllMetrics(urlObjs).then ((packageObjs) => {
        packageObjs.forEach((packageObj) => {
            packageObj.printMetrics();
        });
        //console.log(packageObjs);
    });
});

module.exports = {
    retrieveGithubKey,
    getPackageObject,
    cloneRepository,
    calculateBusFactor,
    calculateRampUp
};