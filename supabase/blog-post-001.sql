-- KOJOH blog: first post, saved as a DRAFT. Run after schema-blog.sql.
-- It appears in Admin -> Blog. Read it, edit anything, then press Publish.
insert into public.blog_posts (slug, title, description, body_md, cover_url, cover_alt, project_slug, tags, author, status)
values (
  'grocery-store-sales-dataset-project-ideas',
  'Grocery Store Sales Dataset for Data Analysis: 10 Project Ideas',
  'A free, messy grocery store sales dataset from an Indian kirana: 9,629 rows in CSV and Excel, with 10 SQL, Python and Power BI project ideas.',
  $kj$If you search for a grocery store sales dataset, most results are tidy supermarket tables: every date in one format, every price a number, no typos. Real shop data never looks like that, and recruiters know it. This guide walks through a free grocery store sales dataset that is messy on purpose, and gives you 10 analysis project ideas you can build with it in SQL, Python, Excel or Power BI.

## What is in the dataset

The data comes from a fictional but realistic kirana (neighbourhood grocery store) in Lucknow: one full year of bills, from April 2025 to March 2026, as the shop's billing app and credit notebook would export them. It has 9,629 rows across three CSV files, plus the same data in one Excel workbook.

| File | Rows | What it holds |
|---|---|---|
| kirana_sales_raw.csv | 9,469 | One row per bill line: bill number, date, time, item, quantity, rate, amount, payment mode, customer, cashier |
| udhaar_payments_raw.csv | 98 | Credit (udhaar) repayments from regular customers |
| item_master.csv | 62 | The clean item list: category, unit, MRP and cost price |

The item master is the key. Because it has a cost price for every item, you can work out profit, not just revenue, which most public sales datasets cannot do.

Here are the first rows of the sales file, exactly as exported:

| Bill_No | Bill_Date | Bill_Time | Item | Qty | Rate | Amount | Payment_Mode | Cashier |
|---|---|---|---|---|---|---|---|---|
| B00001 | 01-04-25 | 08:01 | Poha 500g | 3 | 45 | | PhonePe | Rakesh |
| B00001 | 01-04-25 | 08:01 | Poha  500g | 2 | Rs.45 | 90 | PhonePe | Rakesh |

Two rows in and there is already a blank amount, a double space in an item name and a price typed as text.

## Why messy data makes a better portfolio project

Cleaning is most of a real analyst's week. A project that starts from clean data skips the part interviewers ask about most: "What problems did you find in the data, and how did you fix them?" With this dataset you have real answers to give.

![Bar chart of the date and price formats found in the raw grocery sales file](/assets/blog/grocery-store-sales-dataset/mess-chart.webp "Counts taken from kirana_sales_raw.csv")

The numbers in the chart are counts from the raw file. On top of those:

- **Item names** are typed by the cashier, so 62 products appear under 259 different spellings, such as `Amul Gold Milk 500ml`, `AMUL GOLD MILK 500ML` and `Amul Gold Milk 1/2L`.
- **Quantities** are sometimes plain numbers and sometimes text such as `2 pcs`, `0.5 kg` or `500 gm`. Returns show up as negative quantities.
- **Payment mode** is written more than a dozen ways: `CASH`, `cash`, `Cash`, `UPI`, `upi`, `GPay`, `PhonePe`, `Paytm`, `QR`, `udhar`, `Udhaar`, `Khata`, `Credit`.
- **510 rows** have a blank amount, and **189 rows** are exact duplicates from double printing.

## 10 grocery sales analysis project ideas

Each idea below works on this dataset. Pick two or three and you have a complete project.

1. **Clean the bills into one tidy table (Python or Power Query).** Parse three date formats, strip `₹` and `Rs.` from prices, convert loose quantities to one unit and remove duplicates. Document every rule you apply.
2. **Match typed item names to the item master (Python or SQL).** Normalise case and spacing, then map each spelling to its item code. Report how many rows you could not match and why.
3. **Revenue versus profit by product (SQL).** Join the clean sales to the item master and rank items by revenue and by profit. The two lists do not look the same, and that difference is the story.
4. **Busiest hours and days (SQL or Excel).** Count bills by hour and weekday to suggest when the owner needs a second person at the counter.
5. **Payment mix over the year (Power BI).** Group the payment spellings into cash, UPI and credit, then show how the mix changes month by month.
6. **Udhaar (credit) tracking (SQL).** Total what each regular customer bought on credit, subtract what they paid back from the udhaar file, and list who still owes the most.
7. **Festival impact (Excel or Python).** Compare sales in the Diwali weeks with normal weeks, item by item, to see what really sells during the festival.
8. **Basket analysis (Python).** Find which items are bought together on the same bill, as a first step towards placement or combo offers.
9. **Discount check (SQL).** Compare the rate charged with the MRP to find where the shop sells below the printed price, and what it costs over a year.
10. **A two-page owner dashboard (Power BI).** Page one shows sales, profit and the busiest times. Page two shows credit outstanding by customer. Keep it simple enough for a shop owner to read in a minute.

## How to present it in your portfolio

Recruiters skim, so lead with the business question and the answer, then show the work:

- **README first line:** what the owner wanted to know, in one sentence.
- **Data cleaning section:** a short before-and-after table of the problems you fixed, with counts.
- **Three findings:** each one a sentence plus one chart.
- **Credit the data:** "Dataset: Kirana Store Sales by KOJOH (kojohhi.com)", so reviewers know it is a realistic synthetic dataset.

## Get the dataset

The full dataset is free on KOJOH: all three CSV files and the Excel workbook, a short business brief, 18 guided tasks across Python, SQL and Power BI, a data dictionary and an AI coach prompt that guides you without giving away answers. Sign in, download and start with task one: [Kirana Store Sales, free project](/projects/kirana-store-sales-free).

Want more practice after this? See all [free projects](/free) or browse [messy datasets for data cleaning practice](/messy-datasets-for-data-cleaning-practice).
$kj$,
  '/assets/blog/grocery-store-sales-dataset/cover.webp',
  'Grocery store sales dataset guide cover with a comic of a kirana shopkeeper',
  'kirana-store-sales-free',
  array['grocery store sales dataset', 'retail sales dataset India', 'data analysis project ideas', 'SQL', 'Python', 'Power BI'],
  'KOJOH team',
  'draft'
)
on conflict (slug) do nothing;
