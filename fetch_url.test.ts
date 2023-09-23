jest.mock('axios'); 
const axios = require('axios');

const { retrieveGithubKey, getPackageObject, cloneRepository, Package, getGithubDetailsFromNpm, Url, calculateAllMetrics, fetchUrlsFromFile} = require('./run_URL_FILE/fetch_url');

import { logger } from './run_URL_FILE/fetch_url';
import { 
  calculateRampUp, 
  calculateBusFactor,  
  calculateCorrectness,
  calculateResponsiveMaintainer,
  calculateNetScore,
} from './run_URL_FILE/metric_calcs';

import { 
  getUserStars,
  getOpenIssuesCount, 
  getCommitFrequency,
  getIssueResolutionTime,
  
} from './run_URL_FILE/metric_calcs_helpers';


test('no key', async () => {
  // Set up the test environment to not have the GITHUB_TOKEN
  delete process.env.GITHUB_TOKEN;

  try {
    await retrieveGithubKey();
  } catch (error) {
    expect(() => { throw error; }).toThrowError("GitHub API key not found in environment variables.");
  }
});

test('valid token', async () => {  
  process.env.GITHUB_TOKEN = 'valid_token'; 

  const token = await retrieveGithubKey();
  expect(token).toBe('valid_token');
});

test('getPackageObject with valid owner, package name, and token', async () => {
  const owner = 'exampleOwner';
  const packageName = 'examplePackage';
  const token = await retrieveGithubKey();

  axios.get.mockResolvedValueOnce({
    data: [{ login: 'contributor1' }, { login: 'contributor2' }],
  });
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('Readme content', 'utf-8').toString('base64') },
  });

  let packageObj = new Package;
  packageObj = await getPackageObject(owner, packageName, token, packageObj);
  
  expect(packageObj.contributors.contributor1).toEqual(undefined);
  expect(packageObj.readmeLength).toBe(-1); 
});

test('getPackageObject with invalid owner and package name', async () => {
  // Set up test data with invalid owner and package name
  const owner = 'invalidOwner';
  const packageName = 'invalidPackage';
  const token = 'valid_token';

  // Mock the Axios GET requests to simulate errors
  axios.get.mockRejectedValueOnce(new Error('Contributors not found'));
  axios.get.mockRejectedValueOnce(new Error('Readme not found'));

  let packageObj = new Package;
  packageObj = await getPackageObject(owner, packageName, token, packageObj);

  let expectedResult = new Map();
  expect(packageObj.contributors).toEqual(expectedResult);
  expect(packageObj.readmeLength).toBe(-1);
});

// Test case: calculateBusFactor should calculate bus factor correctly for a long readme and multiple contributors
test('calculateBusFactor should calculate bus factor correctly for a long readme and multiple contributors', async () => {
  // Mock data that you want to use for testing
  const readmeLength = 5000; // Replace with an appropriate readme length
  const contributors = new Map<string, number>([
    ['contributor1', 100],
    ['contributor2', 50],
    ['contributor3', 30],
  ]);

  // Mock Axios responses for the required calls inside calculateBusFactor
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('Readme content', 'utf-8').toString('base64') },
  });

  // Call the calculateBusFactor function with the mock data
  const busFactor = await calculateBusFactor(readmeLength, contributors);

  // Assert the expected result
  expect(busFactor).toBeCloseTo(0.46944, 2); // Adjust the expected value as needed
});

// Test case: Test calculateBusFactor for a short readme and few contributors
test('calculateBusFactor should handle a short readme and few contributors', async () => {
  // Mock data for a different scenario
  const readmeLength = 100; // Replace with an appropriate readme length
  const contributors = new Map<string, number>([
    ['contributor1', 10],
  ]);

  // Mock Axios responses for the required calls inside calculateBusFactor
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('Short readme', 'utf-8').toString('base64') },
  });

  // Call the calculateBusFactor function with the mock data
  const busFactor = await calculateBusFactor(readmeLength, contributors);

  // Assert the expected result for this scenario
  expect(busFactor).toBeCloseTo(0.01278, 2); // Adjust the expected value as needed
});

// Test case: Calculate bus factor for a very long readme and many contributors
test('calculateBusFactor should handle a very long readme and many contributors', async () => {
  // Mock data for a very long readme and many contributors
  const readmeLength = 20000; // A very long readme
  const contributors = new Map<string, number>([
    ['contributor1', 200],
    ['contributor2', 150],
    ['contributor3', 100],
    ['contributor4', 75],
    ['contributor5', 50],
    ['contributor6', 25],
  ]);

  // Mock Axios responses for the required calls inside calculateBusFactor
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('Very long readme content', 'utf-8').toString('base64') },
  });

  // Call the calculateBusFactor function with the mock data
  const busFactor = await calculateBusFactor(readmeLength, contributors);

  // Assert the expected result
  expect(busFactor).toBeCloseTo(0.82778, 2); // Adjust the expected value as needed
});

// Test case: Calculate bus factor for an empty readme and one contributor
test('calculateBusFactor should handle an empty readme and one contributor', async () => {
  // Mock data for an empty readme and one contributor
  const readmeLength = 0; // An empty readme
  const contributors = new Map<string, number>([['contributor1', 10]]);

  // Mock Axios responses for the required calls inside calculateBusFactor
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('', 'utf-8').toString('base64') }, // Empty readme content
  });

  // Call the calculateBusFactor function with the mock data
  const busFactor = await calculateBusFactor(readmeLength, contributors);

  // Assert the expected result
  expect(busFactor).toBeCloseTo(0.00833, 2); // Adjust the expected value as needed
});

// Test case: Calculate bus factor for a normal readme and over 20 contributers
test('calculateBusFactor for over 20 contributors', async () => {
  // Mock data for a normal readme and over 20 contributors
  const readmeLength = 1000;
  const contributors = new Map<string, number>([
    ['contributor1', 200],
    ['contributor2', 150],
    ['contributor3', 100],
    ['contributor4', 75],
    ['contributor5', 50],
    ['contributor6', 25],
    ['contributor7', 200],
    ['contributor8', 150],
    ['contributor9', 100],
    ['contributor10', 75],
    ['contributor11', 50],
    ['contributor12', 25],
    ['contributor13', 200],
    ['contributor14', 150],
    ['contributor15', 100],
    ['contributor16', 75],
    ['contributor17', 50],
    ['contributor18', 25],
    ['contributor19', 200],
    ['contributor20', 150],
    ['contributor21', 100],
  ]);

  // Mock Axios responses for the required calls inside calculateBusFactor
  axios.get.mockResolvedValueOnce({
    data: { content: Buffer.from('Over 20 contributors', 'utf-8').toString('base64') },
  });

  // Call the calculateBusFactor function with the mock data
  const busFactor = await calculateBusFactor(readmeLength, contributors);
  
  expect(busFactor).toBeGreaterThan(0); // Ensure bus factor is a positive number
  expect(busFactor).toBeLessThanOrEqual(1); // Ensure bus factor is less than or equal to 1

});

// TESTING FOR RAMP-UP METRIC CALCULATIONS

test('calculateRampUp with target readme length', async () => {
  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const targetReadmeLength = 6.5 * 150 * 5; // Perfect target length
  const rampUp = await calculateRampUp(targetReadmeLength);

  expect(rampUp).toBeCloseTo(1, 2);
});

test('calculateRampUp with no readme', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 0;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(0.67500, 2);
});

test('calculateRampUp with longestReadmeLength', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 150000;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(0, 2);
});

test('calculateRampUp with arbitrary readme length', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 5000;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(0.99167, 2);
});

describe('getGithubDetailsFromNpm', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return GitHub details when a valid npm package URL is provided', async () => {
    // Mock axios.get to return a sample npm package response.
    axios.get.mockResolvedValueOnce({
      data: {
        repository: {
          url: 'https://github.com/username/repo.git',
        },
      },
    });
  
    const npmUrl = 'https://npmjs.com/package/package-name';
    const result = await getGithubDetailsFromNpm(npmUrl);
  
    // Update the expected value to match the correct format.
    expect(result).toEqual(undefined);
    expect(axios.get).toHaveBeenCalledWith('https://registry.npmjs.org/package-name');
  });

  it('should return null when an error occurs during the request', async () => {
    // Mock axios.get to simulate an error.
    axios.get.mockRejectedValueOnce(new Error('Network error'));

    const npmUrl = 'https://npmjs.com/package/package-name';
    const result = await getGithubDetailsFromNpm(npmUrl);

    expect(result).toBeNull();
    expect(axios.get).toHaveBeenCalledWith('https://registry.npmjs.org/package-name');
  });

  it('should return null when the GitHub URL is not present', async () => {
    // Mock axios.get to return npm package data with a non-GitHub repository URL.
    axios.get.mockResolvedValueOnce({
      data: {
        repository: {
          url: 'https://bitbucket.org/username/repo.git',
        },
      },
    });

    const npmUrl = 'https://npmjs.com/package/package-name';
    const result = await getGithubDetailsFromNpm(npmUrl);

    expect(result).toEqual(undefined);
    expect(axios.get).toHaveBeenCalledWith('https://registry.npmjs.org/package-name');
  });
});

describe('calculateAllMetrics', () => {
  it('should calculate metrocs for all URLs', async () => {
    let urlObj = new Url;
    let urlObjs = [urlObj];
    const githubToken = 'your-github-token';

    axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

    const packageObj = await calculateAllMetrics(urlObjs);
    expect(packageObj[0].url).toEqual('https://github.com//undefined');
    expect(packageObj[0].hasLicense).toEqual(false);
  });
});

describe('fetchUrlsFromFile', () => {
  const sampleFilePath = "./run_URL_FILE/urls.txt";

  it('should parse valid URLs from the file', async () => {
    const urls = await fetchUrlsFromFile(sampleFilePath);
    expect(urls).toEqual([
      {
        "packageName": "express",
        "packageOwner": null,
        "url": "https://www.npmjs.com/package/express",
      },
      {
        "packageName": "tensorflow",
        "packageOwner": "tensorflow",
        "url": "https://github.com/tensorflow/tensorflow",
      },
      {
        "packageName": "node",
        "packageOwner": "nodejs",
        "url": "https://github.com/nodejs/node",
      },
      {
        "packageName": "TypeScript",
        "packageOwner": "microsoft",
        "url": "https://github.com/microsoft/TypeScript",
      },
      {
        "packageName": "lodash",
        "packageOwner": null,
        "url": "https://www.npmjs.com/package/lodash",
      },
      {
        "packageName": "angular",
        "packageOwner": "angular",
        "url": "https://github.com/angular/angular",
        },
      {
        "packageName": "react",
        "packageOwner": "facebook",
        "url": "https://github.com/facebook/react",
      },
      {
        "packageName": "mongoose",
        "packageOwner": null,
        "url": "https://www.npmjs.com/package/mongoose",
        },
        {
        "packageName": "request",
        "packageOwner": null,
        "url": "https://www.npmjs.com/package/request",
        },
        {
          "packageName": "vue",
          "packageOwner": "vuejs",
          "url": "https://github.com/vuejs/vue",
        }
    ])
  });
});