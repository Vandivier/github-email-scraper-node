// ref: https://github.com/Vandivier/data-science-practice/blob/master/js/udacity-study/legacy-puppeteer/reboot.js
// TODO: extract this into a library. Most of it is boilerplate.

const beautify = require('js-beautify').js_beautify;
const EOL = require('os').EOL;
const fs = require('fs');
const reorder = require('csv-reorder');
const puppeteer = require('puppeteer');
const util = require('util');
const utils = require('ella-utils');

const oTitleLine = {
    'sId': 'Entry ID',
    'sName': 'Name',
    'sEmail': 'Email Address',
    'sUserName': 'Username',
    'iEducationCount': 'Count of Education Entries',
    'sLinkedInUrl': 'LinkedIn Url',
    'sResumeUrl': 'Resume Url',
    'bUserExists': 'User Exists',
    'bProfileIsPrivate': 'Profile is Private',
    'bTooManyRequestsError': 'Scrape Blocked for Too Many Requests',
    'bOtherError': 'Other Error',
    'bPresentlyEmployed': 'Presently Employed',
    'sProfileLastUpdate': 'Profile Last Updated Date',
    'iTriesRemaining': 'Tries Remaining',
    'sUrl': 'Url Source'
};

const arrTableColumnKeys = Object.keys(oTitleLine);
const sRootUrl = 'https://profiles.udacity.com/u/';

// TODO: conventionalize var name to column title line value
// proposed rule: encounter each capital letter; splice before first letter and insert spaces in other cases
// fDehungarianize(sVariableName) => Variable Name
//const sResultDir = __dirname + '/results';

const sCacheFilePath = './cache.json';
const sOrderedOutputFilePath = './ordered-output.csv';
const sInputFilePath = __dirname + '/subsample-test.csv'; // TODO: use rsReadStream
const sOutputFilePath = __dirname + '/output.csv';

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);

let oCache = JSON.parse(fs.readFileSync(sCacheFilePath, 'utf8'));

//const rsReadStream = fs.createReadStream('./EarhartMergedNoBoxNoLines.txt');
const wsWriteStream = fs.createWriteStream(sOutputFilePath);

let browser;
let iCurrentInputRecord = 0;
let iTotalInputRecords = 0;
let sResultToWrite;
let wsGotSome;
let wsErrorLog;

main();

async function main() {
    let sInputCsv;
    let arrsInputRows;

    fsRecordToCsvLine(oTitleLine);
    await utils.fpWait(5000); // only needed to give debugger time to attach
    sInputCsv = await fpReadFile(sInputFilePath, 'utf8');
    arrsInputRows = sInputCsv.split(EOL).filter(sLine => sLine); // drop title line and empty trailing lines

    /** for testing only, shorten rows **/
    //arrsInputRows = arrsInputRows.slice(0, 5);
    arrsInputRows.shift();
    iTotalInputRecords = arrsInputRows.length;

    if (typeof oCache !== 'object'
        || !iTotalInputRecords)
    { // don't waste time or requests if there's a problem
        console.log('error obtaining oFirstNameCache');
        fpEndProgram();
    }

    console.log('early count, iTotalInputRecords = ' + iTotalInputRecords);
    browser = await puppeteer.launch();

    // array pattern, doesn't work for streams
    await utils.forEachReverseAsyncPhased(arrsInputRows, async function(_sInputRecord, i) {
        const arrsCells = _sInputRecord.split(',');
        const oRecordFromSource = { // oRecords can be from source or generated; these are all from source
            sFirstName: arrsCells[0],
            sLastName: arrsCells[1],
            iModifiedIncrement: 0
        };

        return fpHandleData(oRecordFromSource);
    });

    fpEndProgram();
}

// to limit reference errors, only these things should ever be passed in through oMinimalRecord:
// first name, last name, modified increment
// increment username to generate a new guessed username and try again until verified failure; udacity username business rule
// TODO: not just first name, but try firstlast and maybe last too
async function fpHandleData(oMinimalRecord) {
    const oRecord = JSON.parse(JSON.stringify(oMinimalRecord)); // dereference for safety, shouldn't be needed tho
    let _oScrapeResult;

    oRecord.sId = oRecord.sFirstName
        + (oRecord.iModifiedIncrement || ''); // '0' shouldn't appear

    oRecord.sUrl = sRootUrl
        + oRecord.sId;

    _oScrapeResult = await fpScrapeInputRecord(oRecord);
    if (_oScrapeResult.bUserExists) { // deceptively simple, dangerously recursive
        await fpHandleData({
            sFirstName: _oScrapeResult.sFirstName,
            sLastName: _oScrapeResult.sLastName,
            iModifiedIncrement: (_oScrapeResult.iModifiedIncrement + 1)
        });
    }

    iCurrentInputRecord++;
    console.log('scraped input record #: ' +
        iCurrentInputRecord +
        '/' + iTotalInputRecords +
        EOL);

    return Promise.resolve();
}

function fsRecordToCsvLine(oRecord) {
    utils.fsRecordToCsvLine(oRecord, arrTableColumnKeys, wsWriteStream);
}

async function fpEndProgram() {
    await browser.close();
    await fpWriteCache();
    process.exit();
}

async function fpWriteCache() {
    let sBeautifiedData = JSON.stringify(oCache);
    sBeautifiedData = beautify(sBeautifiedData, { indent_size: 4 });

    await fpWriteFile(sCacheFilePath, sBeautifiedData, 'utf8', err => {
        reorder({
            input: sOutputFilePath, // too bad input can't be sBeautifiedData
            output: sOrderedOutputFilePath,
            sort: 'Entry ID'
        })
        .then(metadata => {
            console.log('Program completed.');
        })
        .catch(error => {
            console.log('Program completed with error.', error);
        });
    });

    return Promise.resolve();
}

/*** end boilerplate pretty much ***/

// not generalizable or temporally reliable in case of a site refactor
async function fpScrapeInputRecord(oRecord) {
    const _page = await browser.newPage();
    let oCachedResult = oCache.people[oRecord.sId];
    let oMergedRecord;
    let oScrapeResult;

    debugger

    if (oCachedResult
        && (oCachedResult.bProfileIsPrivate
            || !oCachedResult.bTooManyRequestsError)
        && oCachedResult.bUserExists !== undefined)
    {
        oScrapeResult = JSON.parse(JSON.stringify(oCachedResult));
    } else if (oRecord.bUserExists !== false) { // yes, an exact check is needed.
        await _page.goto(oRecord.sUrl, {
            'timeout': 0
        });

        await _page.content()
        _page.on('console', _fCleanLog); // ref: https://stackoverflow.com/a/47460782/3931488

        oScrapeResult = await _page.evaluate((_iCurrentInputRecord) => {
            const script = document.createElement('script') // inject jQuery
            script.src = 'https://code.jquery.com/jquery-3.3.1.js'; // inject jQuery
            document.getElementsByTagName('head')[0].appendChild(script); // inject jQuery
            console.log('scraping: ' + window.location.href);

            // toast message will disappear if you wait too long
            return _fpWait(1000)
                .then(function () {
                    let arr$Affiliations = $('#affiliation-body a[name=subaffil]');
                    let sarrAffiliations = '';
                    let _oResult = {
                        'sName':  $('h1[class*="user--name"]').html(),
                        'sEmail': $('.emaillabel').parent().find('td span').text(),
                        'sUserName': '', //sUsername
                        'iEducationCount': $('div[class*="educations--section"] div[class*="_education--education"]').length,
                        'sLinkedInUrl': $('a[title="LINKEDIN"]').attr('href'),
                        'sResumeUrl': $('a[title="Resume"]').attr('href'),
                        'bUserExists': $('[class*=profile-container]').length > 0,
                        'bProfileIsPrivate': $('[class*="toast--message"]').html() === 'Profile is private',
                        'bTooManyRequestsError': _fsSafeTrim($('[class*="toast--message"]').html()) === 'Too many requests',
                        'bOtherError': false,
                        'bPresentlyEmployed': $('div[class*="works--section"] div[class*="_work--work"] span[class*="_work--present"]').length > 0,
                        'sProfileLastUpdate': $('div[class*="profile--updated"]').text().split(': ')[1],
                        'iTriesRemaining': '' //oResponse.triesRemaining
                    };

                    arr$Affiliations && arr$Affiliations.each(function (arr, el) {
                        let sTrimmed = _fsSafeTrim(el.innerText.replace(/\s/g, ' '));
                        _oResult.sarrAffiliations += ('~' + sTrimmed);
                    });

                    return Promise.resolve(_oResult);
                })
                .catch(function (err) {
                    console.log('fpScrapeInputRecord err: ', err);
                    return err;
                });

            // larger time allows for slow site response
            // some times of day when it's responding fast u can get away
            // with smaller ms; suggested default of 12.5s
            function _fpWait (ms) {
                ms = ms || 10000;
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            function _fsSafeTrim (s) {
                return s && s.replace(/[,"]/g, '').trim();
            }
        })
        .catch(function (error) {
            if (error.message.includes('Execution context was destroyed')) {
                // context was destroyed by http redirect to 404 bc user doesn't exist.
                // well, that's the usual scenario. One can imagine a host of other causes too.
                return {
                    'bUserExists': false
                }
            }

            console.log('unknown _page.evaluate err: ', error);

            return {
                'bOtherError': true
            };
        });

        await _page.close();
    }

    oMergedRecord = Object.assign(oRecord, oScrapeResult);
    oCache.people[oRecord.sId] = JSON.parse(JSON.stringify(oMergedRecord));
    fsRecordToCsvLine(oMergedRecord);
    return Promise.resolve(JSON.parse(JSON.stringify(oRecord))); // return prior to merging to minimize invalid data passed on

    function _fCleanLog(ConsoleMessage) {
        if (ConsoleMessage.type() === 'log') {
            console.log(ConsoleMessage.text() + EOL);
        }
        if (ConsoleMessage.type() === 'error'
            || ConsoleMessage.text().includes('fpScrapeInputRecord err'))
        {
            console.log(ConsoleMessage);
        }
    }
}
