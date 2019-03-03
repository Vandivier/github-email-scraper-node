// ref: https://github.com/Vandivier/data-science-practice/blob/master/js/udacity-study/legacy-puppeteer/reboot.js
// TODO: extract this into a library. Most of it is boilerplate.
const EOL = require('os').EOL;

const scrapeUtils = require('./scrape-utils');

// ref: https://github.com/emadehsan/thal
const CREDS = require('./creds');

const oSourceMap = {
  // TODO: don't explicitly pass oSourceMap and just read from input.csv
  sLocationMatched: 0,
};

const oTitleLine = {
  sEmail: 'Email Address',
  sGithubUrl: 'Entry ID',
  sGithubUsername: 'Entry ID',
  sLocationMatched: 'Location',
  sName: 'Name',
  sScrapedUrl: 'Scraped Url',
};

sUniqueKey = 'sEmail';

function fsGetUrlToScrapeByInputRecord(oInputRecord) {
  return (
    oInputRecord.sLocationMatched &&
    'https://github.com/search?utf8=%E2%9C%93&q=location%3A%22' + oInputRecord.sLocationMatched + '%22&type=Users&ref=advsearch&l=&l='
  );
}

fpEvaluate = async oInputRecord => {
  let oResult = {};

  console.log('scraping: ' + window.location.href);
  await new Promise(resolve => setTimeout(resolve, 500)); // let dynamic content load

  try {
    oResult = fInnerScrapeRecord(oInputRecord);
  } catch (err) {
    console.log('fpInnerScrapeRecord err: ', err);
    oResult = { err };
  }

  return oResult;

  function fInnerScrapeRecord(oInputRecord) {
    /*
    const arrpoOutputRow = [...document.body.querySelectorAll('.user-list-item [href*="@"]')].map($email => {
      const $user = $email.parentElement; // .parentElement.parentElement;

      return {
        sEmail: $email.textContent,
        sGithubUrl: $user.querySelector('a').href,
        sGithubUsername: $user.querySelector('a').text,
        sLocationMatched: oInputRecord.sLocationMatched,
        sName: $user.querySelector('div.d-block').textContent,
        sScrapedUrl: oInputRecord.sScrapedUrl,
      };
    });
    */

    //return arrpoOutputRow;
    return [...document.body.querySelectorAll('.user-list-item [href*="@"]')];
  }
};

// ref: https://github.com/emadehsan/thal
fpLogin = async page => {
  const USERNAME_SELECTOR = '#login_field';
  const PASSWORD_SELECTOR = '#password';
  const BUTTON_SELECTOR = 'input[type=submit][name=commit]';
  const BUTTON_LOGOUT_SELECTOR = 'input[value="Sign out"]';

  await page.goto('https://github.com/logout'); // in case browser persisted an old session
  await page.click(BUTTON_LOGOUT_SELECTOR);
  await page.waitForNavigation();
  await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess
  console.log('logged out of old session');

  await page.goto('https://github.com/login');
  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(CREDS.username);
  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(CREDS.password);
  await page.click(BUTTON_SELECTOR);
  await page.waitForNavigation();
  await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess

  const sSignedInText = await page.evaluate(() => document.querySelector('#user-links').textContent.trim());
  const bLoginSucceeded = sSignedInText.includes('Signed in as ' + CREDS.username);

  console.log('login succeeded?: ' + bLoginSucceeded);
};

async function main() {
  if (process.env.DEBUG) {
    debugger;
  }
  scrapeUtils.exec({ fpEvaluate, fpLogin, fsGetUrlToScrapeByInputRecord, oSourceMap, oTitleLine, sUniqueKey });
}

main();
