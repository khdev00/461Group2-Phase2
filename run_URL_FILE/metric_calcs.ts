import winston, { Logform } from 'winston'; //Logging library
import axios from 'axios'; // Library to conveniantly send HTTP requests to interact with REST API
import { logger, Package } from './fetch_url'

import { 
    getUserStars,
    getOpenIssuesCount, 
    getCommitFrequency,
    getIssueResolutionTime,
    
} from './metric_calcs_helpers';

// This is what controlls the rounding for the metrics,
// In class we were told to round to 5dp without padding with zeros
// If that number changes, change this value. 
const rf: number = 5;

export function calculateRampUp(readmeLength: number) {
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

export function calculateBusFactor(readmeLength: number, contributors: Map<string, number>) {
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

export async function calculateCorrectness(owner: string, packageName: string, token: string) {
    try {
        const stars = await getUserStars(owner, packageName, token);
        const openIssues = await getOpenIssuesCount(owner, packageName, token);

        const starsWeight = 0.4;
        const issuesWeight = 0.6;
        const correctnessScore = (stars * starsWeight / 100) + (0.6 - (0.6 * openIssues * issuesWeight / 100));

        const correctness = Math.round(correctnessScore / 1000 * (10 ** rf)) / (10 ** rf);
        logger.debug(`Calculated correctness value of: ${correctness}`);

        return correctness
      
    } catch (error) {
        logger.error(`Error calculating correctness metric: ${error}`);
        logger.info(`Error calculating correctness metric: ${error}`);
        return -1; 
    }
}

export async function calculateResponsiveMaintainer(owner: string, packageName: string, token: string) {
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

export function calculateNetScore(packageObj: Package) {
    let netScore = 0.4 * packageObj.responsiveMaintainer + 0.3 * packageObj.rampUp + 0.15 * packageObj.correctness + 0.1 * packageObj.busFactor + 0.05 * Number(packageObj.hasLicense);
    let roundedNetScore = Math.round(netScore * (10 ** rf)) / (10 ** rf);

    logger.info(`Calculated net-score: ${roundedNetScore}, for package with URL: ${packageObj.url}`)

    return roundedNetScore;
}
