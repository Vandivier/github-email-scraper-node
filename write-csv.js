const reorder = require('csv-reorder');
const utils = require('ella-utils');

const arrsCsvs = [];
const arroCaches = [];

const sOrderedOutputFilePath = './ordered-output.csv';
const sOutputFilePath = './output.csv';

const fpReadFile = util.promisify(fs.readFile);
const fpWriteFile = util.promisify(fs.writeFile);

const oWriteStreams = {};

const oOptions = {
  mergeFiles: false,
  mergeDuplicates: false,
  uniquifyDuplicates: false,
  sUniqueKey: '',
};

function fsRecordToCsvLine(oRecord, sFileName) {}

/*
function fpOrderCsv() {
  const oReorderResponse = await reorder({
    input: sOutputFilePath, // too bad input can't be sBeautifiedData
    output: sOrderedOutputFilePath,
    sort: oServiceThis.oTitleLine[oServiceThis.sUniqueKey],
  })
    .then(metadata => {
      console.log('fpWriteCache completed succesfully.');
    })
    .catch(error => {
      console.log('Error during fpWriteCache.', error);
    });

  return oReorderResponse;
}
*/

async function main() {
  fParseOptions();

  try {
    arroCaches = arrsCsvs.map(async sFile => await fpReadFile(sFile + '.json', 'utf8'));
  } catch (e) {
    console.error('Error reading one of the files you specified. Are you sure you ran that command correctly?', e);
    process.exit();
  }

  debugger;

  if (oOptions.mergeFiles) fMergeCaches();

  // write caches to csvs
  // TODO: regex to skip some records
  const arrp = arroCaches.map(async (oCache, i) => {
    const oTitleLine = oCache[sUniqueKey]; // explicit title line is optional
    const sOutputFileName = arroCaches.length > 1 ? arrsCsvs[i] + '.csv' : 'output.csv';
    const arrTableColumnKeys = oTitleLine[sUniqueKey]
      ? Object.values(oTitleLine).sort()
      : Object.keys(Object.values(oCache)[0])
          .map(fNormalizeVariableName)
          .sort();

    if (!oWriteStreams[sOutputFileName]) oWriteStreams[sOutputFileName] = fs.createWriteStream(sOutputFileName);

    Object.values(oCache)
      .sort((oA, oB) => (oA[sUniqueKey] > oB[sUniqueKey] ? 1 : -1))
      .map(o => utils.fsRecordToCsvLine(o, arrTableColumnKeys, oWriteStreams[sOutputFileName]));

    return Promise.resolve();
  });

  await Promise.all(arrp);
}

// yargs === overengineering
function fParseOptions() {
  function _fCleanValue(s) {
    return s && s.trim().replace(/[^\w]/g, '');
  }

  process.argv.slice(2).forEach(s => {
    if (s.toLowerCase().includes('uniquekey')) {
      oOptions.sUniqueKey = _fCleanValue(s.split('=')[1]);
    } else if (s.includes('--')) {
      oOptions[_fCleanValue(s)] = true;
    } else {
      arrsCsvs.push(s);
    }
  });

  if (Object.entries(oOptions).find((sKey, sVal) => sVal)) {
    // if any merge option exists, set merge to true as a safety measure
    oOptions.mergeFiles = true;
  }

  if (oOptions.mergeFiles && !oOptions.sUniqueKey) {
    console.error(
      'cache merge option(s) observed, but no unique key to merge on the basis of was provided. Pass --UniqueKey=MyUniqueKeyName.'
    );
    process.exit();
  }

  if (!arrsCsvs.length) arrsCsvs.push('cache');

  debugger;
}

function fMergeCaches() {
  const oMergedCache = arroCaches.reduce((oMergedCacheAcc, oCurrentCache, i) => {
    return Object.keys(oCurrentCache).reduce((oCurrentCacheAcc, sOriginalRecordKey, ii) => {
      const oCurrentRecord = oCurrentCache[sOriginalRecordKey];
      const sNewRecordKey = oOptions.uniquifyDuplicates ? sOriginalRecordKey + '-' + i + '-' + ii : sOriginalRecordKey;
      const oExistingRecord = oCurrentCacheAcc[sNewRecordKey];

      if (oExistingRecord) {
        if (oOptions.mergeDuplicates) {
          // existing column values survive; only overwrite unpopulated columns
          oCurrentCacheAcc[sRecordKey] = Object.assign({}, oNew, oExisting);
        }
        // else do nothing; the existing record survives and current record is dropped
      } else {
        oCurrentCacheAcc[sRecordKey] = Object.assign({}, oCurrentRecord);
      }

      return oCurrentCacheAcc;
    }, oMergedCacheAcc);
  }, {});

  arroCaches.splice(arroCaches.length); // clear without reassigning
  arroCaches.push(oMergedCache);
}

// by default, turns hungarian or title cased into Title Spaced Case
// with --keys-camel, turns camel case into Title Spaced Case
function fNormalizeVariableName(s) {
  const arriCapitals = getAllIndexes([...s], s => /[A-Z]/.test(s));
  let iPrevious = oOptions.keyscamel ? 0 : null;

  arriCapitals.push(s.length);

  return arriCapitals
    .reduce((arrsAcc, i) => {
      if (iPrevious) {
        arrsAcc.push(s.slice(iPrevious, i));
      }

      iPrevious = i;

      return arrsAcc;
    }, [])
    .join(' ');
}

// ref: https://stackoverflow.com/questions/20798477/how-to-find-index-of-all-occurrences-of-element-in-array
function getAllIndexes(arr, f) {
  const indexes = [];

  for (let i = 0; i < arr.length; i++) {
    if (f(arr[i])) {
      indexes.push(i);
    }
  }

  return indexes;
}

main();
