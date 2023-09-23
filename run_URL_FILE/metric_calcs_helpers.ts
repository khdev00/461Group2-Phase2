import fs from 'fs'; // Node.js file system module for cloning repos  
import path from 'path';
import winston, { Logform } from 'winston'; //Logging library
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import { logger, Package } from './fetch_url'

export async function readReadmeFile(cloneDir: string) {
    try {
        // Check if the README file exists in the cloned repository
        const readmePath = path.join(cloneDir, 'README.md');

        if (fs.existsSync(readmePath)) {
            // Read the README file content
            const readmeContent = fs.readFileSync(readmePath, 'utf-8');
            //console.log(`README Content:\n${readmeContent}`);
            return readmeContent;
        } else {
            //console.log('README file not found in the repository.');
            return '';
        }
    } catch (error) {
        //console.error('Error reading README file:', error);
        return '';
    }
}

export async function getUserStars(owner: string, packageName: string, token: string) {
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

export async function getOpenIssuesCount(owner: string, packageName: string, token: string) {
    const headers = {
        Authorization: `Bearer ${token}`,
    };
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${packageName}/issues?state=open`, { headers });
        const openIssuesCount = response.data.length || 0; 
        return openIssuesCount;
    } catch (error) {
        logger.error(`Error fetching open issues count: ${error}`);
        logger.debug(`Error fetching open issues count: ${error}`);
        return 0; 
    }
}

export async function getCommitFrequency(owner: string, packageName: string, token: string) {
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

export async function getIssueResolutionTime(owner: string, packageName: string, token: string) {
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

export async function getContributors(packageObj: Package, headers: any, owner: string, packageName: string): Promise<Package> {
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
        return packageObj;
    })
    .catch((err) => {
        logger.error(`Error on axios.get: ${err}`);
        logger.info(`Error on axios.get: ${err}`);
        packageObj.setContributors(new Map()); 
        return packageObj;
    });
    return packageObj;
}