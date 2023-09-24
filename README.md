# 461Group2
Repo for the 461 ACME NPM Phase 1 project

Project Members:
1. Matthew Ghera
2. Gabrielle Mazion
3. Neha Sharma
4. Atharva Patil
5. Christopher Louly


Run Install
How the code works
The code for installing the dependencies necessary to run the program is found in the “run” bash script, and the “deps.txt” file in the project directory.
The “run” bash script uses npm to install all necessary dependencies (only when “install” is passed as the first argument).
The “deps.txt” file contains a newline separated list of all dependencies used by our project. This list gets parsed inside of the “run” script. Additional dependencies can be added in this file.

The functions that are involved in this process in the “run” bash script are as follow:
install_dependencies() which does exactly as the name implies. It runs through all lines given in the deps.txt file in the main directory, processes each line, and uses npm to install the dependency on that given line.
trim_name() takes a string (intended to be a line from the “deps.txt” file) and trims all leading or trailing whitespace as well as any newline characters.
handle_install_error() is called when npm instal ___ fails. It uses npm show to check whether the package failed to install, or it simply doesn’t exist. This is helpful for things like catching spelling errors, as a misspelled package name will most likely not exist.


How to run it
To run this feature, simply run the command “./run install” in your terminal, all dependencies will be installed. 

Run URL
How the code works
The code for calculating the metrics/retrieving the data from the provided url(s) is found in ./run_URL_FILE/fetch_url.ts, ./run_URL_FILE/metric_calc_helper.ts, and ./run_URL_FILE/metric_calc.ts. 

./run_URL_FILE/fetch_url.ts
Contains all the infrastructure for fetching and calculating metrics. 
The code to parse the urls from the input file 
The code that contains all the classes
The code that calls the github api and clones the repos
The code that outputs the urls
./run_URL_FILE/metric_calc_helper.ts
Contains all the helper functions for calculating the metrics
Examples: getReadmeFile and getUserStars
./run_URL_FILE/metric_calc.ts
Contains all the code for calculating the metrics utilizing the helper functions

First the URLs are parsed from the file and are stored in a Url object in fetchUrlsFromFile. The metrics are then calculated 2 different ways, as per the requirements, in the calculateAllMetrics. This function calls both getPackageObject, which calculates a few of the metrics using the Github API, and it also calls cloneRepository, which calculates the rest of the metrics by cloning the repo (rest api to download tar of repo); see Metrics section for which function calculates each metric. 

To call a lot of the APIs, you need a github key. Personal github keys should be located in the .env file, and retrieveGithubKey retrieves the key from the env file.


Metrics
Ramp Up:
How Calculated: Clone Repo (clone repo/rest)
Calculation
Readme length
Both too long and too short of a readme length are scored poorly as there is a target readme length. To calculate what a target length is, we used a few different sources so that we could compare the readme’s length in terms of characters. According to this collection of good readme’s, most good readmes have between 5-8 paragraphs of text, so we took the average of 6.5. According to grammarly a paragraph is around 100-200 words, so we took the average of 150. According to a few different sources, including this one, the average number of characters in a word is 5. Using this, the target readme length is calculated as 6.5 * 150 * 5 = 4875 characters. The score is then calculated based on how far away the actual readme length is from this number, where the smaller the difference, the higher the score.
Reasoning
We calculated the score like this because ramp up heavily depends on the documentation provided. If there is a pages and pages of documentation to go through (a long readme), then that will lead to a long ramp up time as a user will have to go through all of it and have to understand it. If a readme is too short, there may not be enough information to understand how the repo works leading to a lot of time trying to figure it out by yourself.
Bus Factor:
How calculated: Clone Repo (clone using tar file and github/rest api)
Calculation
Readme length
A long readme is not scored poorly, only a short readme is scored low. To measure the score for the length of the readme, it is measured against the longest possible readme (longest readme is defined as a readme that is 15 paragraphs where each paragraph is estimated to be 150 words with 5 character-long words). If the readme is longer than the “longest readme”, it is maxed out at a score of 1.0.
Contributors
It accounts for both the number of contributors and the distribution of the number of commits is across all the contributors. ⅓ of this portion of the metric calculation is based on how many contributors there are and ⅔ is based on if there is an even distribution of commits across all contributors. To calculate the score for even distribution of commits it finds the difference between the actual distribution and what would be an even distribution. The number of contributors component is calculated based on a percentage of the optimal number of contributors (20). If the number of contributors is above 20, it is maxed out at 1.0.
The readme length and contributors components are averaged to calculate the bus factor metric.
Reasoning
The bus factor will be limited by the documentation. One way to quantify this is by the readme length. If there is a lot of documentation and the developers become MIA, the idea is that more documentation would make up for that. Additionally, if there are more contributors, that decreases the chance of all developers suddenly going MIA. This is especially important if there is an equal number of commits written by multiple contributors.
Correctness
How Calculated: Github/Rest API
Calculation
User ratings/stars
Higher number of stars on a repo is scored well, while a lower number is scored poorly. Given a score between 0 and 0.4.
Open Issues Count
Higher number of open issues is scored poorly, while a lower number is scored well. Given a score between 0 and 0.6.
Responsive Maintenance
How Calculated: Github/rest API
Calculation
Commits Frequency
Calculates average time between commits. Scored highly if the frequency is high, and poorly if the frequency is low. 
Average Issue Resolution Time
Calculates average time between issue creation and resolution. Scored highly if the time is less, and poorly if the time is more. 
License
How Calculated: Github/rest API
Calculation
This metric is very simple. If this repo has a license according to github, it is a 1.0, and if it doesn’t, it is a 0. It’s important to note the license has to be valid in the github repo and cannot just be in the readme. So if the github api has a 0 in the license field but there is a license in the readme, then there is still no license. We did this so that the license is validated.
Net Score
Calculation
0.4 * response maintenance + 0.3 * rampUp + 0.15 * correctness + 0.1 * busFactor + 0.05 * license


Run Test
The code for executing ./run test can be found in the run file. First npx jest --coverage --silent 2>&1 | tee jest.log.txt is run. This runs all our .test.ts files (fetch_url.test.ts and runInstall.test.ts). The --silent 2>&1 | tee jest.log.txt is there to keep the coverage output from being in stdout and instead fed into the jest.log.txt file which stores the output of the coverage so that it can be viewed. The output of this command in saved into the variable test_output so it can be later parsed for the code coverage, tests passed, and total tests so that these values can be printed to stdout at the end of ./run test.

fetch_url.test.ts
This is the test file that tests the functionality of the main code (logger.ts, fetch_url.ts, metric_calcs.ts, and metric_calcs_helpers.ts). 
retreiveGitHubKey: The functionality of this is tested by having both tests for when there is and isn't a valid GitHub token. 
getPackageObj: The functionality of this is tested by having tests for the following scenarios…
getPackageObj with a valid owner, package name, and token
getPackageObj with an invalid owner and package name
calcBusFactor: The functionality of this is tested by having tests for the following scenarios…
Long readme and less than 20 contributors
Short readme and only one contributor
Very long readme (more than the longest readme defined) and less than 20 contributors.
An empty readme and only one contributor
A normal readme length and over 20 contributors
calculateRampUp: The functionality of this is tested by having tests for the following scenarios…
Repo with the our set target readme length (6.5 * 150 * 5)
No readme
Repo with the longest readme that we set (150000)
Repo with an arbitrary readme length
getGitHubDetailsFromNpm: The functionality of this is tested by having tests for the following scenarios…
It checks that GitHub details are returned when it is given a valid npm package URL. 
It checks that null is returned when an error occurs during the GitHub details request.
It checks that null is returned when the GitHub URL is not present.
calculateAllMetrics: The functionality of this is tested by having a test that checks that the function behaves when provided with a specific URL object and mocked responses from the axios.get function. It verifies that the function correctly calculates metrics and sets properties of the packageObj objects as expected.
fetchUrlsFromFile:  The functionality of this is tested by having it read from a file of urls and checking that the urls read at the end of its execution is what was expected. 

runInstall.test.ts
This test file just checks to make sure that the functionality of ./run install works by checking that the dependencies have been installed. 

 

Anticipating Natural Extensions
We designed the codebase with the idea in mind that additional features would be added to this tool in the future.
Anticipating that each score for an individual metric may need to be called separately, we made it so that each score calculation is in its own isolated function.
To help with future additions, we organized our codebase so that calculations have their own file, helpers to retrieve individual components to an equation have their own file, and all the infrastructure has its own file. This makes it so that if a feature is to be added, future developers won’t need to find a place to put new code in a 500+ line long file.
To also help with adding new metrics, we made it so that you can reuse individual components of a calculation by making separate helper functions. For example, if you wanted to add a new metric that would use the readme length as a factor, you can call that function instead of having to rewrite that code.



