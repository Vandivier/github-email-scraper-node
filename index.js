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
    const arrpoOutputRows = [...document.body.querySelectorAll('.user-list-item [href*="@"]')].map($email => {
      const $user = $email.parentElement && $email.parentElement.parentElement && $email.parentElement.parentElement.parentElement;

      if (!$email || !$user) {
        return {};
      }

      return {
        sEmail: $email.textContent,
        sGithubUrl: $user.querySelector('a').href,
        sGithubUsername: $user.querySelector('a').text,
        sLocationMatched: oInputRecord.sLocationMatched,
        sName: $user.querySelector('div.d-block') && $user.querySelector('div.d-block').textContent,
        sScrapedUrl: oInputRecord.sScrapedUrl,
      };
    });

    return {
      arrpoOutputRows,
      oNextInputRecord: Object.assign({}, oInputRecord, {
        sScrapedUrl: document.querySelector('.next_page').href,
      }),
    };
  }
};

// ref: https://github.com/emadehsan/thal
// TODO: login and logout routines are similar so some logic could be extracted to a function
fpbLogin = async page => {
  let bLogoutResolved = false;
  let bLoginResolved = false;
  const USERNAME_SELECTOR = '#login_field';
  const PASSWORD_SELECTOR = '#password';
  const BUTTON_SELECTOR = 'input[type=submit][name=commit]';
  const BUTTON_LOGOUT_SELECTOR = 'input[value="Sign out"]';

  /*
  await page.goto('https://github.com/logout'); // in case browser persisted an old session
  await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess

  const bSignoutButtonExists = await page.evaluate(() => document.querySelector('input[value="Sign out"]') !== null);

  if (bSignoutButtonExists) {
    // ref: https://github.com/GoogleChrome/puppeteer/issues/1412#issuecomment-402725036
    const pLogoutNavigation = page.waitForNavigation().then(() => {
      !bLogoutResolved && console.log('confirmed logged out of old session');
    });

    const pLogoutTimeout = new Promise(resolve => {
      setTimeout(() => {
        !bLogoutResolved && console.log('log out confirmation is taking a while, proceeding to login without logout confirmation');
        resolve();
      }, 5000);
    });

    await page.click(BUTTON_LOGOUT_SELECTOR);
    console.log('sign out button found and clicked');
    await Promise.race([pLogoutNavigation, pLogoutTimeout]);
    bLogoutResolved = true;
    await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess
  } else {
    console.log('could not find sign out button. proceeding to log in.');
  }
  */

  await page.goto('https://github.com/login');
  let sSignedInText = await page.evaluate(
    () => document.querySelector('#user-links') && document.querySelector('#user-links').textContent.trim()
  );
  let bLoginConfirmed = sSignedInText && sSignedInText.includes('Signed in as ' + CREDS.username);

  if (bLoginConfirmed) {
    console.log('already logged in');
  } else {
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(CREDS.username);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(CREDS.password);

    const pLoginNavigation = page.waitForNavigation().then(() => {
      !bLoginResolved && console.log('confirmed logged in');
    });

    const pLoginTimeout = new Promise(resolve => {
      setTimeout(() => {
        !bLoginResolved && console.log('log in confirmation is taking a while, eagerly checking login status...');
        resolve();
      }, 5000);
    });

    await page.click(BUTTON_SELECTOR);
    console.log('log in form found, filled, and submitted');
    await Promise.race([pLoginNavigation, pLoginTimeout]);
    bLoginResolved = true;
    await page.waitFor(2 * 1000); // give it some extra time bc idk to be safe i guess

    sSignedInText = await page.evaluate(
      () => document.querySelector('#user-links') && document.querySelector('#user-links').textContent.trim()
    );
    bLoginConfirmed = sSignedInText && sSignedInText.includes('Signed in as ' + CREDS.username);

    if (bLoginConfirmed) {
      console.log('login succeeded. proceeding to scrape.');
      return Promise.resolve(true);
    } else {
      console.log('login failed. terminating process');
      return Promise.resolve(false);
    }
  }
};

async function main() {
  if (process.env.DEBUG) {
    debugger;
  }
  scrapeUtils.exec({ fpEvaluate, fpbLogin, fsGetUrlToScrapeByInputRecord, oSourceMap, oTitleLine, sUniqueKey });
}

main();
