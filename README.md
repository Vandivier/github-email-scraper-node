# github-email-scraper-node

specify region search strings, get Github user email addresses. In Node.

When you `npm start`, this project will begin executing parallel Github location searches.

By default, 10 searches are run in parallel. This can be modified in the code if you want.

If you `node scrape mylocation` then the scraper will search mylocation then stop.

If you `node scrape mylocation 10` then the scraper will scrape a maximum of 10 pages.

NOTE: actually alot of this readme is a lie rn lol. currently the scraper does not run multiple scrapes in parallel.

The more specific commands are useful if you are nervous about something crashing, and then you might have to start all over.

Results are written into `cached.json`. This file helps us in a few ways:

1. By periodically committing this file we can protect against data loss in a crash.

2. This file ensures uniqueness of scraped profiles, using the profile url as a unique key.

3. If you re-run the scraper later then you can skip all the profiles you already know about.
   1. Note: If you want to bust the cache then delete the json file.

If you `node output` then the contents of `cached.json` will be written into `output.csv`.

Be very careful if you plan to blast an email to the scraped email list. Consider using a cleansing service and emailing them individually instead of blasting them.

## TODO

1. key off arbitrary function and include key as an output

2. business documentation for the whole workflow: index, wrangler, write-csv, their options, etc.

3. if cache.json, etc, doesn't exist, write it. so we don't assume lib user created one.

4. seperate scripts to:

   1. [scraper.js] scrape into cache.json
   2. [wrangler.js] post-process cache.json into wrangled.json
   3. includes mailgun functionality
   4. [write-csv.js] write wrangled.json into output.csv and ordered-output.csv
      1. debug like `node --inspect-brk write-csv cache cache-2 --UniqueKey=sEmail`
      2. takes json file and writes to csv with alphebetized columns
      3. `--drop-key=/myregex/` will cause certain keys not to be written as rows. useful to skip things if you are caching things that aren't really observations, like a page of results.
   5. [merge.js] multiple csvs
      1. `write-csv` has --merge option instead of merge.js
      2. `unwrite-csv` takes csv and creates cache-like json file called `unwrite-${n}.json` by default, but also takes arbitrary name arg.
      3. without --merge then write-csv makes multiple output for multiple input
      4. use as a cli tool like `merge email csv1 csv2 csv3`
      5. Takes all 3 csvs and makes a row with first variable (eg email) as unique column name
      6. leftmost csv takes precedence in the case of unique key collision.
         1. default is when a collision happens to merge records; so john@abc.com from csv1 and csv2 gets merged with columns from both csv
         2. `--drop-dup` means john@abc.com from csv1 is included and duplicates are simply dropped from other spreadsheets
         3. `--uniquify-dup` means john@abc.com from csv1 is included and john@abc.com from csv2 becomes john@abc.com-csv2
         4. conflicting options take alphabetical precedence
      7. output has a superset of columns from any spreadsheet

5. it would be nice if cache file were updated with every scrape instead of at the end. that way we could stop early if we want and crash salvage
