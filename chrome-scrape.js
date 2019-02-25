/*
 *  run from cli like `node --harmony chrome-scrape`
 *
 *  The technical flow begins by the invocation of init()
 *
 *  Extract Udacity profiles, augment w data about are they employed, regress alternative credential value
 *  Install the package then run it, or just run it in https://runkit.com/
 *  Generates name combinations and attempts to look up Udacity users this way
 *  Name sources:
 *    Census: http://stackoverflow.com/questions/1803628/raw-list-of-person-names
 *    SSA.gov: https://www.ssa.gov/OACT/babynames/limits.html
 *        By state
 *    This bro: http://mbejda.github.io/
 *        black-female-names.csv: https://gist.github.com/mbejda/9dc89056005a689a6456#file-black-female-names-csv
 *        black-male-names.csv:
 *
 *  Initial analysis just cares about names, not demographic data.
 *
 *  Extended analysis:
 *    Keep estimated gender, ethnicity, and state data, as available
 *    Augment with 2000s and 2010s: https://www2.census.gov/topics/genealogy/
 *
 *  If the scrapee tries to ban ur ip just spoof em http://stackoverflow.com/questions/20294190/send-http-request-from-different-ips-in-node-js
 *
 *  If I want a seeded (reproducible) random list for subsampling, sort alpha then https://www.npmjs.com/package/random-seed
 *
 *  ref: http://stackoverflow.com/questions/28739098/how-can-i-scrape-pages-with-dynamic-content-using-node-js
 *
 *  TODO: known users vs random users
 *  TODO: puppeteer vs chromeless? https://github.com/graphcool/chromeless
 *
 *  Quickly check scraper in your browser by injecting jQuery:
 *    http://stackoverflow.com/questions/1199676/can-i-create-script-tag-by-jquery
 *    script.src = 'https://code.jquery.com/jquery-3.2.1.js';
 *
 *  Give the program a few 'runs' to obtain more observations; sometimes values come as undefined or falsy I think just bc lag or something.
 *  ref: https://github.com/GoogleChrome/puppeteer/blob/master/examples/search.js
 */

// TODO: check pdf resume for additional validation of current employment via string '- present' || '- current' || '- 2017' || '-2017', etc

const async = require('async');
const cheerio = require('cheerio');
const fs = require('fs');
const OS = require('os');
const puppeteer = require('puppeteer');   // Chrome API, https://github.com/GoogleChrome/puppeteer

const sCol1TitleLine = 'First Names';
const fsoNameSource = './process-names';
const sUdacityBaseUrl = 'https://profiles.udacity.com/u/';

const arrsKnownValidNames = ['john', 'sara', 'sarah'];    // TODO: read from file. These names are seeds for usernames.
let iUid = 1;

const streamOutFile = fs.createWriteStream(__dirname + '/udacity-employment-data.csv');

//init();

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://google.com');
  await page.screenshot({path: 'google-pic.png'});

  browser.close();
})();

/*  Test cases:
 *  /john3 is public with LinkedIn
 *  /johnsmith2 404
 *  /john is private
 *  /john11 is public with no linkedin
 *
 *  eg https://profiles.udacity.com/u/john3
 */

//ref: http://stackoverflow.com/questions/9836151/what-is-this-css-selector-class-span
// now with Chrome! https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md
// this method just scrapes a single user.
//  CLI: .\chrome.exe --headless --disable-gpu --remote-debugging-port-9222
async function fScrapeUdacityUser(sUsername) {
    console.log(sUdacityBaseUrl + sUsername);

  /*
  const oResponse = await getDynamicContentUdacity(page);             //dynamic content. ref: http://phantomjs.org/quick-start.html
  const $ = oResponse.content;

  let oUserObject = {
    'id': iUid,
    'educationCount': $('div[class*="educations--section"] div[class*="_education--education"]').length,
    'linkedInUrl': $('a[title="LINKEDIN"]').attr('href'),
    'knownFail': oResponse.knownFail,
    'name': $('h1').html(),
    'presentlyEmployed': $('div[class*="works--section"] div[class*="_work--work"] span[class*="_work--present"]').length > 0,
    'profileLastUpdated': $('div[class*="profile--updated"]').text().split(': ')[1],
    'resumeUrl': $('a[title="Resume"]').attr('href'),
    'triesRemaining': oResponse.triesRemaining,
    'userExists': $('[class*=profile-container]').length > 0,
    'userName': sUsername
  };
  */
  let oUserObject = {};

  iUid++
  return oUserObject;
}

let arroAllUserObjects = [];
// needed to bridge async.map with fScrapeUdacityUser
//  return new Promise(function(resolve, reject) {
//      resolve(fScrapeUdacityUser(sUsername, fCallback));
function fScrapeUdacityUserSync(sUsername, fCallback) {

  return fUdacityPromiseChain(sUsername, fCallback, 0); //um, why do I pass callback?
  /*
  return new Promise(function(resolve, reject) {
    resolve(fUdacityPromiseChain(sUsername, fCallback, 0)); //um, why do I pass callback?
  });
  */
  //let pLinkedInScraped = Promise.resolve(); //stub

  //hack
//  pUdacityScraped.then(function(){
//    return fCallback(null, arroAllUserObjects);
//  });

  //Promise.all([pUdacityScraped, pLinkedInScraped]).then(fCallback(null, arroAllUserObjects));     // TODO: error handling. null means no error.
  //Promise.all([pUdacityScraped]).then(fCallback(null, arroAllUserObjects));     // TODO: error handling. null means no error.
}

/*  
 *  description:
 *  Given a username, we don't actually just scrape that one user.
 *  instead, we scrape that user and then increment numerically to find more users.
 *  this follows a built-in Udacity business rule. If a user creates a profile with
 *  a duplicate name, they just increment numerically.
 */
async function fUdacityPromiseChain(sUsername, fCallback, iDuplicateUserNumber) {
  //return new Promise(function(resolve, reject){
    return fScrapeUdacityUser(sUsername).then((oThisUser) => {
      //console.log(oThisUser);

      if (oThisUser.userExists) {       // if user exists, push and continue iterating
        let sNewUserName = iDuplicateUserNumber ? sUsername.slice(0, sUsername.indexOf(iDuplicateUserNumber)) : sUsername;  //increment the username

        arroAllUserObjects.push(oThisUser);
        iDuplicateUserNumber++;

        sNewUserName += iDuplicateUserNumber;

        fUdacityPromiseChain(sNewUserName, fCallback, iDuplicateUserNumber);
      } else {
        return Promise.resolve();   // TODO: should we return Promise.reject(); ?
        //resolve();
        //fCallback(null, arroAllUserObjects);
      }
    })
    .catch(function(e){
      console.log('caught me an err bruh', e);
    });
  //});
}

//  ref: http://stackoverflow.com/questions/31963804/how-to-scroll-in-phantomjs-to-trigger-lazy-loads?noredirect=1&lq=1
//  once each second, try to see if the body has rendered yet.
//  TODO: this method is bugging which is why the app doesn't work atm.
//  looks like the issue is that it won't dynamically load the React page data...?
function getDynamicContentUdacity(page) {
  let iTriesRemaining = 5,
      pContent = Promise,
      oResponse = {
        'triesRemaining': iTriesRemaining,
        'knownFail': false
      };
      const content = page.evaluate(function () { return document.body.innerHTML; });    // should this be inside the setInterval loop?

    let interval = setInterval((_page, sContent) => {
      //const content = await _page.property('content');

      if (sContent) {
        const $ = cheerio.load(sContent);
        //console.log(sContent.indexOf('user--name--'));
        //console.log(typeof sContent);  // jQuery object
        //console.log(Object.keys(sContent));
        console.log(sContent.root);

        if ($('h1').html()) {                                     // we have a name, gtg
            console.log('got header');
            oResponse.content = $;
            pContent.resolve(oResponse);
        } else if ($('div[class*="toast--message"]').text() === 'Profile does not have recruiter access enabled') {
            oResponse.knownFail = true;                           // it's a known fail. Return
            pContent.resolve(oResponse);
        } else if (iTriesRemaining === 0) {                       // give up
            pContent.resolve(oResponse);
            clearInterval(interval);
        }

        console.log('trying again', iTriesRemaining);
        iTriesRemaining--;
      }
    }, 2500, page, content);

  return pContent;
}

// http://caolan.github.io/async/docs.html#map
// TODO: err handling
function init() {
  async.map(arrsKnownValidNames, fScrapeUdacityUserSync, function(err, arroUserObjects) {
    if (err) console.log('async.map callback ERROR',  err);
    let sTextToWrite = fsObjectsToCSV(arroUserObjects[0]);                        // there's an extra array layer somewhere... maybe bc i want udacity then linkedin the w/e?
    streamOutFile.write(sTextToWrite, null, console.log('Done.')); 
    process.exit(0);      // i don't think we should exit here. I think this callback is just for one promise chain, not Promise.all()
  //  async.map(arrNames, fScrapeUdacityUserSync, function(err, arroUserObjects) {
  //    console.log('arrNames is done.');
  //    process.exit(0);
  //  });
  });
}

// TODO: use ella-utils
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// TODO: make writing logic generic as it is dup in process-names.fScrapedDataToCSV()
// TODO: use ella-utils
function fsObjectsToCSV(arroUserObjects, arrsKeys, sTitleLine) {
  arrsKeys = arrsKeys || Object.keys(arroUserObjects[0]);                         // if not passed, get all of them in whatever order
  sTitleLine = sTitleLine || arrsKeys.reduce((acc, val) => {
    return acc + ',' + val;
  });                                                                             // if not passed, use the litteral key as the column title

  for (oUser of arroUserObjects) {
    sTitleLine += OS.EOL + fsObjectToCSVLine(oUser, arrsKeys);
  }

  return sTitleLine;
}

// TODO: use ella-utils
function fsObjectToCSVLine(oUser, arrsKeys) {
  let sLine = '';

  for (i = 0; i < arrsKeys.length; i++) {
    sLine += (oUser[arrsKeys[i]] || '') + ',';
  }

  return sLine.slice(0, -1);
}
