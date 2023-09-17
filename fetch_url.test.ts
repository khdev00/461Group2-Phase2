const { retrieveGithubKey, getPackageObject, cloneRepository, calculateBusFactor, calculateRampUp } = require('./run_URL_FILE/fetch_url');
jest.mock('axios'); 
const axios = require('axios');

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

  const packageObject = await getPackageObject(owner, packageName, token);

  expect(packageObject.contributors).toEqual(['contributor1', 'contributor2']);
  expect(packageObject.readmeLength).toBe(14); 
});

test('getPackageObject with invalid owner and package name', async () => {
  // Set up test data with invalid owner and package name
  const owner = 'invalidOwner';
  const packageName = 'invalidPackage';
  const token = 'valid_token';

  // Mock the Axios GET requests to simulate errors
  axios.get.mockRejectedValueOnce(new Error('Contributors not found'));
  axios.get.mockRejectedValueOnce(new Error('Readme not found'));

  const packageObject = await getPackageObject(owner, packageName, token);

  expect(packageObject.contributors).toEqual([]);
  expect(packageObject.readmeLength).toBe(0);
});

test('clones a repository successfully', async () => {
  const repoUrl = 'https://github.com/mghera02/461Group2.git';

  // Mock the clone function of git to simulate a successful clone
  const mockedClone = jest.spyOn(require('isomorphic-git'), 'clone');
  mockedClone.mockResolvedValueOnce(undefined);

  await cloneRepository(repoUrl);

  // Assert that git.clone was called with the correct parameters
  expect(mockedClone).toHaveBeenCalledWith({
    http: expect.anything(),
    fs: expect.anything(),
    dir: expect.any(String),
    url: repoUrl,
    singleBranch: true,
    depth: 10,
  });
});

test('handles clone failure gracefully', async () => {
  const repoUrl = 'https://github.com/invalid/repo';

  // Mock the clone function of git to simulate a clone failure
  const mockedClone = jest.spyOn(require('isomorphic-git'), 'clone');
  mockedClone.mockRejectedValueOnce(new Error('Failed to clone'));

  await expect(cloneRepository(repoUrl)).rejects.toThrowError('Failed to clone');
});

// Test case 1: Describe what this test is checking
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

// Test case 2: Describe another scenario to test
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

// Test case 1: Calculate bus factor for a very long readme and many contributors
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

// Test case 2: Calculate bus factor for an empty readme and one contributor
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

// TESTING FOR RAMP-UP METRIC CALCULATIONS

test('calculateRampUp with target readme length', async () => {
  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const targetReadmeLength = 2.5 * 150 * 5; // Perfect target length
  const rampUp = await calculateRampUp(targetReadmeLength);

  expect(rampUp).toBeCloseTo(1, 2);
});

test('calculateRampUp with no readme', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 0;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(0.87500, 2);
});

test('calculateRampUp with longestReadmeLength', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 150000;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(-8.87500, 2);
});

test('calculateRampUp with arbitrary readme length', async () => {

  // Mock the Axios response for the README content
  axios.get.mockResolvedValue({ data: Buffer.from('Readme content', 'utf-8').toString('base64') });

  const readmeLength = 5000;
  const rampUp = await calculateRampUp(readmeLength);

  expect(rampUp).toBeCloseTo(0.79167, 2);
});