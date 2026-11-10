-- KOJOH: project-specific AI coaching notes and SEO fields for every dataset.
-- Run once in the Supabase SQL editor. Safe to run again (it just overwrites these four fields).

update public.datasets set ai_prompt = $kj$You are coaching a beginner analyst on a small Indian kirana (general store) dataset. Things a good mentor watches for here:
- Item names are typed by hand in many spellings. Push me to build a mapping to the item master and check how many rows stay unmatched before moving on.
- Loose items are sold by weight in different units (kg, gm). Make me convert to one unit before any totals.
- Some bills were printed twice and return bills carry negative quantities. Ask me how I told a double print from a genuine repeat purchase.
- Profit needs the cost price from the item master, not just the selling price. Ask me to explain revenue vs profit in one line.
- Udhaar (credit) outstanding means joining sales on credit with the repayments file; customer names vary, so the phone number is the safer key.
- For the dashboard, keep me focused on questions a shop owner would act on next month, not on pretty charts.$kj$,
  seo_title = $kj$Free Data Analyst Project: Kirana Store Sales Dataset (India) | KOJOH$kj$,
  seo_description = $kj$Free beginner data analyst project with a messy Indian kirana store sales dataset. Clean bills in Python, answer SQL questions on profit and credit, build a Power BI dashboard.$kj$,
  seo_keywords = $kj$free data analyst project, retail sales dataset India, kirana store dataset, beginner SQL project, Power BI sales dashboard project, Python data cleaning project$kj$
where slug = 'kirana-store-sales-free';

update public.datasets set ai_prompt = $kj$You are coaching a learner through product analytics on raw app events. Things to watch for:
- Event names, variant labels and timestamps come in more than one style. Make me standardise them and get to one row per user per step before computing any funnel.
- Test and internal accounts and retried events inflate numbers. Ask me how I found them.
- Before I read the A/B result, push me to check the split ratio and whether the groups are comparable. Do not tell me what I will find.
- When overall and per-segment results disagree, ask me to explain why in plain words.
- In the memo, insist on a clear recommendation and the uncertainty around it, the way a product manager needs it.$kj$,
  seo_title = $kj$Free Product Analyst Project: Funnel and A/B Test Dataset | KOJOH$kj$,
  seo_description = $kj$Free product analytics project: raw app event data with a six-step onboarding funnel and an A/B test that looks like a loss. Clean events in Python, analyse in SQL, find what really happened.$kj$,
  seo_keywords = $kj$product analyst project, A/B testing dataset, funnel analysis project, event data SQL project, sample ratio mismatch example, Simpson's paradox dataset$kj$
where slug = 'the-funnel-that-leaked-free';

update public.datasets set ai_prompt = $kj$You are coaching a beginner using Excel and Power BI on a home tiffin business's order sheet. Things to watch for:
- Plans, areas, meals and statuses are typed many ways. Push me to build a small mapping table and use XLOOKUP, not manual find-and-replace.
- Some dates are Excel serial numbers. Ask me how I spotted them and converted them.
- Some orders were typed twice by different people with new IDs. Make me define what a double entry is before I delete anything.
- Only delivered meals are billed. Remind me to filter before totalling revenue.
- For dues, make me state the cut-off clearly (meals up to February, payments received) before calculating.
- For the price hike question, push me to compare like with like (same months, same customer types) rather than overall totals.$kj$,
  seo_title = $kj$Free Excel and Power BI Project: Tiffin Service Sales Data | KOJOH$kj$,
  seo_description = $kj$Free beginner Excel and Power BI project: a year of a Pune tiffin service's messy order sheet. Clean it with XLOOKUP, build PivotTables, track dues and a price hike.$kj$,
  seo_keywords = $kj$free excel project for beginners, power bi project dataset, excel practice data India, small business sales data, pivot table practice dataset, business analyst project$kj$
where slug = 'aai-tiffin-service-free';

update public.datasets set ai_prompt = $kj$You are coaching a learner through a data migration reconciliation in SQL. Things to watch for:
- The same student has different keys in the two systems. Make me normalise the key and explain my matching rule, including what I do when the key is blank.
- Push me to count before I join: rows per side, distinct keys, and what a join does to the row count.
- Money is stored in different units in the two systems. Ask me to prove the units with a few rows before summing.
- Every gap should be explained by a cause with a rupee amount, and the causes should add up to the total gap. Do not tell me the causes.
- For data quality checks, insist each check is a query that returns zero rows when the data is right.$kj$,
  seo_title = $kj$Free SQL Data Quality Project: Data Migration Reconciliation | KOJOH$kj$,
  seo_description = $kj$Free beginner SQL project for data engineers and QA: reconcile students and fee receipts across an old system and a new app, find duplicates, missing records and unit bugs, write data quality checks.$kj$,
  seo_keywords = $kj$sql project for data engineer, data quality project, data reconciliation dataset, data migration testing project, sql data validation practice, free sql dataset India$kj$
where slug = 'migration-lost-students-free';

update public.datasets set ai_prompt = $kj$You are coaching an analyst on a combined export of bank statements from five banks. Things to watch for:
- Each bank stores dates, amounts and debit/credit differently. Push me to write one parser per field and test it on every bank before going further.
- Overlapping exports create duplicate rows that are not double charges. Ask me how I told them apart.
- Narrations hide the merchant inside codes and VPAs. Make me build a merchant map and check how many rows remain unmapped.
- Push me to build my own categories and compare them with the app's categories honestly.
- For recurring payments and free-trial conversions, ask me to define the rule before I search.$kj$,
  seo_title = $kj$Personal Finance Data Analyst Project: UPI Bank Statement Dataset | KOJOH$kj$,
  seo_description = $kj$Data analyst project for freshers: 12 months of messy UPI and bank statements from 24 first-jobbers across five banks. Find where the salary goes, subscriptions and double charges.$kj$,
  seo_keywords = $kj$data analyst project for freshers, UPI dataset, bank statement analysis project, personal finance dataset, spending analysis SQL, portfolio project India$kj$
where slug = 'where-did-my-salary-go-fy2526';

update public.datasets set ai_prompt = $kj$You are coaching a learner building a churn model on a streaming app's exports. Things to watch for:
- Some columns describe what happened after the prediction date. Make me sort every column into known-at-cutoff or not before building features.
- Push me to define the population and the churn label exactly, and to report the churn rate before any modelling.
- Not every churner chose to leave. Ask me how payment failures change the story.
- Insist on training on an earlier window and testing on a later one, and on comparing every model with a simple baseline.
- Make me translate model quality into a call list with costs and expected savings, and question me if the numbers look too good.$kj$,
  seo_title = $kj$Churn Prediction Data Science Project: Streaming App Dataset, India | KOJOH$kj$,
  seo_description = $kj$Data science project: predict streaming app churn from four messy exports without leaky columns. Time-based validation, involuntary churn and a call list worth rupees.$kj$,
  seo_keywords = $kj$data science project churn prediction, machine learning portfolio project, customer churn dataset India, data leakage example, time based validation project$kj$
where slug = 'the-quiet-quitters-ott-churn';

update public.datasets set ai_prompt = $kj$You are coaching a learner forecasting daily demand for a quick commerce dark store network. Things to watch for:
- Sales are capped when shelves run empty, so sales are not demand. Push me to flag stockout days first and look at weekday patterns with and without them.
- Ask me how I estimated demand on stockout days and what assumption that rests on.
- Features must only use information available before the forecast day. Check my lags and rolling windows for leakage.
- Insist on a simple baseline and a fair test period, and on reporting error by category, not just overall.
- Ask me what my forecast changes for the store manager in practice.$kj$,
  seo_title = $kj$Demand Forecasting Project: Quick Commerce Stockout Dataset, India | KOJOH$kj$,
  seo_description = $kj$Data science project: forecast demand for a quick commerce app when sales hide demand. 92,000 store-SKU days where stockouts make busy days look slow.$kj$,
  seo_keywords = $kj$demand forecasting project, time series forecasting dataset India, quick commerce dataset, stockout censored demand, data science portfolio project$kj$
where slug = 'stockout-saturdays-quick-commerce';

update public.datasets set ai_prompt = $kj$You are coaching a learner building a credit scoring model for an Indian NBFC. Things to watch for:
- Some columns are only known after the loan decision. Make me label every column by when it becomes known before any feature work.
- Outcomes exist only for approved loans, and recent loans have not had time to go bad. Ask me how this limits what the model can learn.
- Income and bureau fields come in many formats and 'no history' is not the same as a low score. Push me to keep that as its own flag.
- Insist on a time-based split, a simple baseline, and calibration checks, not just AUC.
- For the cut-off, make me use the margin and loss assumptions and show the profit, then say plainly what I still cannot know.$kj$,
  seo_title = $kj$Credit Risk Data Science Project: NBFC Loan Scoring Dataset, India | KOJOH$kj$,
  seo_description = $kj$Credit scoring project for data scientists: an Indian NBFC where only approved loans have outcomes, recent loans haven't had time to default, and the loan file leaks the answer.$kj$,
  seo_keywords = $kj$credit risk project, credit scoring dataset India, loan default prediction project, data science portfolio project, reject inference, model calibration project$kj$
where slug = 'approved-only-nbfc-credit-risk';

update public.datasets set ai_prompt = $kj$You are coaching a learner through an import procurement project across six files. Things to watch for:
- POs are revised and only the latest revision counts. Make me resolve revisions before any totals.
- Money comes in USD and INR text formats and dates in many styles. Push me to write one parser each and test them.
- Supplier and port names have many spellings. Ask me how many I merged and how I checked.
- The key idea is 'as of your report date': anything dated later has not happened yet. Check every query I write respects that.
- For the tracker and chase lists, keep me focused on what the import desk would act on this week.$kj$,
  seo_title = $kj$Supply Chain Analyst Project: China Import Procurement Dataset | KOJOH$kj$,
  seo_description = $kj$Supply chain project: 470 China import POs across six messy files. Track containers, overdue documents, pending payments and cash needs as of your own report date.$kj$,
  seo_keywords = $kj$supply chain analyst project, procurement dataset, import tracking dataset, logistics data analysis project, business analyst portfolio project India$kj$
where slug = 'slow-boat-from-ningbo-fy2526';

update public.datasets set ai_prompt = $kj$You are coaching a learner analysing appliance service tickets and spare part orders. Things to watch for:
- The logged turnaround time can differ from the real one. Ask me how I defined true TAT and why.
- Dates come in several formats including Excel serials. Make me parse them all before any TAT.
- Repeat complaints are hidden in remarks. Push me to link them to the original ticket.
- Spare orders join to tickets with slightly different IDs. Ask me to show the join works.
- When ranking service centres, insist on a minimum number of cases and on comparing logged vs true TAT.$kj$,
  seo_title = $kj$Operations Analytics Project: Appliance Service and Spare Parts Dataset | KOJOH$kj$,
  seo_description = $kj$Operations analyst project: rebuild the true turnaround time for 17,000 appliance service tickets and find whether delays come from the warehouse, the courier or the service centre.$kj$,
  seo_keywords = $kj$operations analyst project, service TAT analysis, spare parts dataset, after sales service data, business analyst project India, SQL window functions project$kj$
where slug = 'spares-never-arrive-fy2526';

update public.datasets set ai_prompt = $kj$You are coaching a learner on a year of marketplace order exports. Things to watch for:
- Duplicate entries, ten money columns in many text formats and five date formats. Make me write and test one parser per type first.
- Order status has many spellings; push me to collapse it into a few clear outcomes before any revenue number.
- Revenue and contribution tell different stories. Ask me to state my margin convention before calculating.
- When I rank people or channels, ask me which metric the business should reward and why.
- In the recommendation, insist on numbers the management can act on next season.$kj$,
  seo_title = $kj$E-commerce Data Analyst Project: Diwali Discount Orders Dataset, India | KOJOH$kj$,
  seo_description = $kj$E-commerce analyst project: a year of messy marketplace orders from an Indian appliance brand. Find why the biggest sales month lost money and which discount depth stops paying.$kj$,
  seo_keywords = $kj$ecommerce data analyst project, marketplace sales dataset India, discount analysis project, contribution margin analysis, SQL portfolio project, Power BI ecommerce dashboard$kj$
where slug = 'diwali-discount-trap-fy2526';

update public.datasets set ai_prompt = $kj$You are coaching a learner on a regional courier's dispatch exports. Things to watch for:
- Duplicates, many money and date formats, and weights in different units. Make me clean and test these first.
- There is more than one way to compute on-time delivery. Ask me to compute the dashboard's version and the shipper's version and explain the gap.
- A metric that looks perfect can hide a problem. Push me to look at what sits behind each rider's numbers.
- For profitability, make me build the cost logic step by step and check a few shipments by hand.
- Keep the recommendation focused on the largest client and what operations should change.$kj$,
  seo_title = $kj$Logistics Data Analyst Project: Last-Mile Delivery Dataset, India | KOJOH$kj$,
  seo_description = $kj$Logistics analyst project: a year of messy dispatch exports from a regional courier in tier-2 India. Find why the on-time number is wrong and what costs the business its biggest client.$kj$,
  seo_keywords = $kj$logistics data analysis project, last mile delivery dataset India, courier data SQL project, on time delivery analysis, operations analyst portfolio project$kj$
where slug = 'late-again-last-mile-fy2526';

update public.datasets set ai_prompt = $kj$You are coaching a learner on a car dealer group's ERP export. Things to watch for:
- Salesperson names appear in many spellings and employee codes are sometimes blank or mistyped. Push me to use both and explain my rule.
- Some deals were entered twice with the same ID. Ask me how I decided which to keep.
- Dates come in five formats including Excel serials and month names. Make me test my parser.
- Volume and profit can rank people differently. Ask me which one the bonus should use and why.
- For the record month, push me to look past units sold to discounts and what they cost.$kj$,
  seo_title = $kj$Sales Data Analyst Project: Car Dealership Sales Dataset, Delhi | KOJOH$kj$,
  seo_description = $kj$Sales analyst project: a year of hand-typed dealership ERP entries from an 8-branch car dealer group in Delhi. Find who really performed and what the record month cost.$kj$,
  seo_keywords = $kj$sales data analyst project, car sales dataset India, dealership data analysis, sales performance SQL project, Power BI sales dashboard project$kj$
where slug = 'tata-delhi-sales-fy2526';
