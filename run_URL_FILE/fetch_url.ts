// How to run this file
// 1. Run ./run install
// 2. You will need a .env file in the root directory with GITHUB_TOKEN=*your key*
//    Make sure your .env is in .gitignore
// 3. Run ./run *path to your url file*

import dotenv from 'dotenv'; // For retrieving env variables
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import winston, { Logform } from 'winston'; //Logging library
import { getLogger } from './logger';

//import * as ndjson from 'ndjson';
import ndjson from 'ndjson';
import fs from 'fs'; // Node.js file system module for cloning repos  
import os from 'os'
import path from 'path'
import { print } from 'graphql';
const http = require("isomorphic-git/http/node");

// For cloning repo
const BlueBirdPromise = require('bluebird')
const tar = require('tar');
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fsExtra from 'fs-extra';
const execAsync = promisify(exec);

const packageObjs: Package[] = [];

import { 
    calculateRampUp, 
    calculateBusFactor,  
    calculateCorrectness,
    calculateResponsiveMaintainer,
    calculateNetScore,
} from './metric_calcs';

import { 
    readReadmeFile,
    getContributors
} from './metric_calcs_helpers';

dotenv.config();

// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf: number = 5;

//Logger initialization
export const logger = getLogger();

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
            NET_SCORE: this.netScore,                                    
            RAMP_UP_SCORE: this.rampUp,                                 
            CORRECTNESS_SCORE: this.correctness,                        
            BUS_FACTOR_SCORE: this.busFactor,                          
            RESPONSIVE_MAINTAINER_SCORE: this.responsiveMaintainer,      
            LICENSE_SCORE: Number(this.hasLicense)                   
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

  export class Url {
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

// Useful for looking at which data you can access:
// https://docs.github.com/en/rest/overview/endpoints-available-for-github-app-installation-access-tokens?apiVersion=2022-11-28
async function getPackageObject(owner: string, packageName: string, token: string, packageObj: Package) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    packageObj = await getContributors(packageObj, headers, owner, packageName);

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

    await calculateCorrectness(owner, packageName, token).then((correctness) => {
        packageObj.setCorrectness(correctness);
    });

    const responsiveMaintainer = await calculateResponsiveMaintainer(owner, packageName, token);
    packageObj.setResponsiveMaintainer(responsiveMaintainer);

    return packageObj;
}

async function extractTarball(tarballPath: string, targetDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.createReadStream(tarballPath)
            .pipe(tar.extract({ cwd: targetDir, strip: 1 }))
            .on('error', reject)
            .on('end', resolve);
    });
}

async function cloneRepository(repoUrl: string, packageObj: Package) {
    packageObj.setURL(repoUrl);
    
    try {
        // Create a directory to clone the repository into
        const cloneDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(cloneDir)) {
            fs.mkdirSync(cloneDir);
        }
    
        // Fetch the GitHub repository's tarball URL
        const tarballUrl = `${repoUrl}/archive/master.tar.gz`;
    
        // Download the tarball to a temporary file
        const tarballPath = path.join(__dirname, 'temp.tar.gz');
        const response = await axios.get(tarballUrl, { responseType: 'stream' });
        response.data.pipe(fs.createWriteStream(tarballPath));
    
        await new Promise((resolve, reject) => {
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
    
        // Extract the tarball using the tar library
        await extractTarball(tarballPath, cloneDir);

        // Read and display the README file
        // Get readme length
        await readReadmeFile(cloneDir).then ((response) => {
            packageObj.setReadmeLength(String(response).length);
        });
    
        // Clean up the temporary tarball file
        fs.unlinkSync(tarballPath);

        await fsExtra.remove(cloneDir);
    
    } catch (error) {
        //console.error('Error cloning repository:', error);
    }
    
    packageObj.setBusFactor(calculateBusFactor(packageObj.readmeLength, packageObj.contributors));
    packageObj.setRampUp(calculateRampUp(packageObj.readmeLength));
    packageObj.setNetScore(calculateNetScore(packageObj));

    return packageObj;
}

async function calculateAllMetrics(urlObjs: Url[]) {
    for await(let url of urlObjs) {
        let packageObj = new Package;
        await getPackageObject(url.getPackageOwner(), url.packageName, githubToken, packageObj)
            .then((returnedPackageObject) => {
                packageObj = returnedPackageObject;
            })
        packageObjs.push(packageObj);
    }

    let idx = 0;
    return BlueBirdPromise.map(urlObjs, (url:Url) => {
        let repoUrl = `https://github.com/${url.getPackageOwner()}/${url.packageName}`;
        let packageObj = packageObjs[idx++];
        return new Promise(resolve => {
          cloneRepository(repoUrl, packageObj)
          .then((response) => {
            resolve(response);
           });
        });
      }, {concurrency: 1});
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
      logger.error('Error reading file:', error);
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
    logger.error('Error fetching npm package data:', error);
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

// let urlsFile = "./run_URL_FILE/urls.txt";
let urlsFile = process.argv[2];
let urlObjs : Url[] = [];

fetchUrlsFromFile(urlsFile).then((urls) => {
    urlObjs = urls
    calculateAllMetrics(urlObjs).then (() => {
        printAllMetrics(packageObjs);
    });
});

module.exports = {
    retrieveGithubKey,
    getPackageObject,
    cloneRepository,
    logger,
    Package,
    Url,
    getGithubDetailsFromNpm,
    calculateAllMetrics
};