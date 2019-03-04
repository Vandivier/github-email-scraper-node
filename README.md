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

1. key oCache of both sScrapedUrl and sUniqueKey;

2. deal with invalid commas and quotes interior to cell values. Eg [Brody](https://github.com/Ryan-B-W).

3. scrape for each Github sorting option, and include which sorting option an entry is initially obtained from

   1. maybe collect all sorting options under which result appears

   2. maybe find some way to access unobserved records (rn I can only get ~7k / 50k for location "united states")
