const oServiceThis = {};

const arrTableColumnKeys = Object.keys(oTitleLine);

const sCacheFilePath = './cache.json';
const sOrderedOutputFilePath = './ordered-output.csv';
const sInputFilePath = './input.csv'; // TODO: use rsReadStream
const sOutputFilePath = './output.csv';

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);

let oCache = JSON.parse(fs.readFileSync(sCacheFilePath, 'utf8'));

//const rsReadStream = fs.createReadStream('./location-strings.txt');
const wsWriteStream = fs.createWriteStream(sOutputFilePath);

let browser;
let iCurrentInputRecord = 0;
let iTotalInputRecords = 0;

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

    await utils.forEachReverseAsyncPhased(arrsInputRows, async function(_sInputRecord, i) {
    
        // TODO: automatically detect title line and expand object using oTitleLine
        const arrsCells = _sInputRecord.split(',');
        const oRecordFromSource = { // oRecords can be from source or generated; these are all from source
            sFirstName: arrsCells[0],
            sLastName: arrsCells[1],
            iModifiedIncrement: 0
        };
        
        return fpHandleData(oRecordFromSource, i);
    });

    fpEndProgram();
}

async function fpHandleData(oInputRecord, i) {
    const oRecord = JSON.parse(JSON.stringify(oMinimalRecord)); // dereference for safety, shouldn't be needed tho

    oRecord.sScrapedUrl = fsGetUrlToScrapeByInputRecord(oRecord);
    await fpScrapeInputRecord(oRecord);

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

module.exports = oServiceThis;