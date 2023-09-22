
// runInstall.test.ts

const { execSync } = require('child_process');

describe('Logging and Testing', () => {
  it('should log installation messages', () => {
    const command = './run install';
    try {
      const output = execSync(command).toString();
      expect(output).toContain('dependencies installed...');
    } catch (error) {
      // If the script fails or throws an error, fail the test
      throw error;
    }
  });
});