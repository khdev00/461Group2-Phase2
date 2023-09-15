const { retrieveGithubKey, getPackageObject, cloneRepository } = require('./run_URL_FILE/fetch_url');
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

test('handles clone failure gracefully', async () => {
  const repoUrl = 'https://github.com/invalid/repo';

  // Mock the clone function of git to simulate a clone failure
  const mockedClone = jest.spyOn(require('isomorphic-git'), 'clone');
  mockedClone.mockRejectedValueOnce(new Error('Failed to clone'));

  await expect(cloneRepository(repoUrl)).rejects.toThrowError('Failed to clone');
});

/*test('getPackageObject with valid owner, package name, and token', async () => {
  const owner = 'exampleOwner';
  const packageName = 'examplePackage';
  const token = retrieveGithubKey();

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
});*/
