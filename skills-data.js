// KOJOH skill check: 10 questions per skill, ordered easy -> hard.
// Points: questions 1-4 = 1, 5-7 = 2, 8-10 = 3 (19 in total).
// The right option is listed first (a: 0); the page shuffles options before showing them.
window.KOJOH_SKILLS = [
{
  id: 'sql', name: 'SQL', blurb: 'Filters, joins, GROUP BY and window functions.',
  next: {
    beginner: { text: 'Start with the free Beginner questions in Practice, then answer the SQL phase of the Kirana Store project.', practice: '/practice?role=data-analyst', project: '/free' },
    intermediate: { text: 'You can query. Now practise joins on messy data and window functions on a full case.', practice: '/practice?role=data-analyst', project: '/free' },
    advanced: { text: 'Strong. Take on a Data Engineer or Business Analyst case where the data fights back.', practice: '/practice?role=data-engineer', project: '/search?q=SQL' }
  },
  qs: [
    { q: 'Which clause filters rows <b>before</b> they are grouped?', o: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], a: 0, why: 'WHERE filters rows first. HAVING filters the groups after GROUP BY.' },
    { q: 'Which query returns the number of rows in the <code>orders</code> table?', o: ['SELECT COUNT(*) FROM orders;', 'SELECT SUM(*) FROM orders;', 'SELECT LENGTH(orders);', 'SELECT TOTAL(orders);'], a: 0, why: 'COUNT(*) counts every row, including rows with NULLs.' },
    { q: 'Fill the blank to get total sales per city.', code: 'SELECT city, SUM(amount)\nFROM orders\n______ city;', o: ['GROUP BY', 'ORDER BY', 'PARTITION BY', 'SORT BY'], a: 0, why: 'GROUP BY makes one row per city, and SUM adds up the amounts inside each group.' },
    { q: 'Which condition finds customers whose name starts with "Ra"?', o: ["name LIKE 'Ra%'", "name LIKE '%Ra'", "name = 'Ra*'", "name IN ('Ra')"], a: 0, why: '% matches any characters, so "Ra%" means "Ra" followed by anything.' },
    { q: 'You run <code>customers LEFT JOIN orders</code>. What happens to a customer who has never ordered?', o: ['They appear once, with NULL in the order columns', 'They are dropped from the result', 'They appear with order values of 0', 'The query fails'], a: 0, why: 'A LEFT JOIN keeps every row from the left table. Where there is no match, the right side is NULL.' },
    { q: 'A table has 10 rows. The <code>phone</code> column is NULL in 3 of them. What does this return?', code: 'SELECT COUNT(phone) FROM customers;', o: ['7', '10', '3', 'NULL'], a: 0, why: 'COUNT(column) skips NULLs. COUNT(*) would return 10.' },
    { q: 'Which query lists only the cities whose total sales are above 1,00,000?', o: ['SELECT city, SUM(amount) FROM orders GROUP BY city HAVING SUM(amount) > 100000;', 'SELECT city, SUM(amount) FROM orders WHERE SUM(amount) > 100000 GROUP BY city;', 'SELECT city FROM orders WHERE amount > 100000;', 'SELECT city, SUM(amount) FROM orders GROUP BY city LIMIT 100000;'], a: 0, why: 'You cannot use an aggregate in WHERE. Filters on SUM, COUNT or AVG go in HAVING.' },
    { q: 'Which gives a <b>running total</b> of each customer\'s spend over time?', o: ['SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date)', 'SUM(amount) OVER (ORDER BY customer_id)', 'SUM(amount) GROUP BY customer_id, order_date', 'RUNNING_SUM(amount) BY customer_id'], a: 0, why: 'PARTITION BY restarts the total for each customer, and ORDER BY makes it cumulative by date.' },
    { q: 'The <code>discount</code> column holds 10, NULL and 20. What does this return?', code: 'SELECT AVG(discount) FROM orders;', o: ['15', '10', 'NULL', '30'], a: 0, why: 'AVG ignores NULLs: (10 + 20) / 2 = 15. If NULL should count as 0, use AVG(COALESCE(discount, 0)), which gives 10.' },
    { q: 'You join 100 orders to <code>payments</code>. Some orders have two payment rows. Now SUM(order_amount) is bigger than the real total. Why?', o: ['The join repeated those orders, once per payment row', 'SUM rounds up decimals', 'NULL payments are counted twice', 'The orders table must have duplicates'], a: 0, why: 'A one-to-many join fans out rows. Total the payments per order first, then join, or sum the order amount before joining.' }
  ]
},
{
  id: 'excel', name: 'Excel', blurb: 'Formulas, lookups, PivotTables and messy dates.',
  next: {
    beginner: { text: 'Learn SUM, COUNTIF, absolute references and PivotTables on a real file. The Kirana Store project is a good first file.', practice: '/practice?role=data-analyst', project: '/free' },
    intermediate: { text: 'Good base. Practise SUMIFS, lookups and cleaning on Data Analyst Excel tasks.', practice: '/practice?role=data-analyst', project: '/free' },
    advanced: { text: 'Strong. Add Power BI or SQL next, since most analyst jobs ask for Excel plus one of them.', practice: '/practice?role=data-analyst', project: '/search?q=Excel' }
  },
  qs: [
    { q: 'Which formula adds the values in A2 to A10?', o: ['=SUM(A2:A10)', '=ADD(A2:A10)', '=TOTAL(A2,A10)', '=A2+A10'], a: 0, why: 'SUM adds every cell in the range. =A2+A10 adds only those two cells.' },
    { q: 'Which symbol keeps a cell reference fixed when you copy a formula?', o: ['$ (as in $B$1)', '# (as in #B1)', '@ (as in @B1)', '& (as in &B1)'], a: 0, why: '$ locks the column, the row, or both, so the reference does not move when the formula is copied.' },
    { q: 'Which formula counts the cells in B2:B100 that say "Delhi"?', o: ['=COUNTIF(B2:B100,"Delhi")', '=COUNT(B2:B100,"Delhi")', '=SUMIF(B2:B100,"Delhi")', '=COUNTA("Delhi")'], a: 0, why: 'COUNTIF counts the cells that meet one condition.' },
    { q: 'You need total sales by region and by month, without writing formulas. What do you use?', o: ['A PivotTable', 'Conditional formatting', 'Data validation', 'Freeze panes'], a: 0, why: 'A PivotTable groups and totals data by any fields you drag in.' },
    { q: 'In <code>=VLOOKUP(E2, A:C, 3, FALSE)</code>, what does FALSE mean?', o: ['Find an exact match only', 'Return the third match', 'Search from bottom to top', 'Ignore blank cells'], a: 0, why: 'FALSE asks for an exact match. TRUE or a blank allows an approximate match on sorted data, a common source of wrong answers.' },
    { q: 'What does <code>=IFERROR(VLOOKUP(E2,A:C,3,FALSE),"Not found")</code> do when E2 is not in column A?', o: ['Shows "Not found"', 'Shows #N/A', 'Shows 0', 'Shows the closest match'], a: 0, why: 'IFERROR replaces any error, here #N/A, with the value you give it.' },
    { q: 'Which formula sums column C where region (B) is "North" and month (A) is "Jan"?', o: ['=SUMIFS(C:C,B:B,"North",A:A,"Jan")', '=SUMIF(C:C,"North","Jan")', '=SUM(IF(B:B="North",A:A="Jan"))', '=SUMIFS("North","Jan",C:C)'], a: 0, why: 'SUMIFS takes the range to add first, then pairs of condition range and condition.' },
    { q: 'What can XLOOKUP do that VLOOKUP cannot?', o: ['Return a value from a column to the left of the lookup column', 'Look up numbers', 'Work across sheets', 'Return text values'], a: 0, why: 'VLOOKUP only returns columns to the right. XLOOKUP takes separate lookup and return ranges, and matches exactly by default.' },
    { q: 'Dates like "05-11-2026" sort in a strange order: all the 01s first, then the 02s. What is the most likely cause?', o: ['They are stored as text, so they sort alphabetically', 'The column is too narrow', 'Excel cannot sort dates', 'The sheet is protected'], a: 0, why: 'Text sorts character by character. Convert the column to real dates (DATEVALUE, Text to Columns or Power Query) and set the right day and month order.' },
    { q: 'What does this return?', code: '=INDEX(C2:C100, MATCH(MAX(D2:D100), D2:D100, 0))', o: ['The value in column C on the row with the highest value in D', 'The highest value in column C', 'The row number of the highest D', 'The sum of C where D is highest'], a: 0, why: 'MAX finds the top value, MATCH finds its row, and INDEX returns column C from that row.' }
  ]
},
{
  id: 'python', name: 'Python', blurb: 'pandas basics, filtering, groupby and merges.',
  next: {
    beginner: { text: 'Learn read_csv, filtering and groupby, then clean the Kirana Store bills in the free project.', practice: '/practice?role=data-analyst', project: '/free' },
    intermediate: { text: 'Good. Practise merges, missing values and duplicates on a full case.', practice: '/practice?role=data-scientist', project: '/free' },
    advanced: { text: 'Strong. Try the Data Scientist track, where leakage and time-based splits matter.', practice: '/practice?role=data-scientist', project: '/search?q=Python' }
  },
  qs: [
    { q: 'What is the usual way to import pandas?', o: ['import pandas as pd', 'from pandas import all', 'include pandas', 'require("pandas")'], a: 0, why: 'pd is the standard short name used in almost every example and job codebase.' },
    { q: 'Which line loads <code>sales.csv</code> into a DataFrame?', o: ["df = pd.read_csv('sales.csv')", "df = pd.open('sales.csv')", "df = pd.load_csv('sales.csv')", "df = csv.read('sales.csv')"], a: 0, why: 'read_csv reads a CSV file into a DataFrame.' },
    { q: 'What does <code>df.shape</code> return?', o: ['(rows, columns)', 'The column names', 'The data types', 'The first 5 rows'], a: 0, why: 'shape is a tuple: number of rows, then number of columns.' },
    { q: 'Which keeps only the rows where amount is above 500?', o: ["df[df['amount'] > 500]", "df.where('amount > 500')", "df['amount' > 500]", "df.filter(amount > 500)"], a: 0, why: 'The comparison builds a True/False mask, and df[mask] keeps the True rows.' },
    { q: 'What does this give you?', code: "df.groupby('city')['amount'].sum()", o: ['Total amount for each city', 'The number of cities', 'The amount column sorted by city', 'The average amount per city'], a: 0, why: 'groupby splits the rows by city, then sum adds up the amount inside each group.' },
    { q: 'What does this print?', code: 'x = [3, 1, 2]\ny = x.sort()\nprint(y)', o: ['None', '[1, 2, 3]', '[3, 1, 2]', 'An error'], a: 0, why: 'list.sort() sorts in place and returns None. Use sorted(x) when you need a new list.' },
    { q: 'What does <code>df[\'amount\'].isna().sum()</code> tell you?', o: ['How many values in amount are missing', 'The total of amount without missing values', 'Whether the column exists', 'How many rows are duplicated'], a: 0, why: 'isna() is True where a value is missing, and summing True values counts them.' },
    { q: 'You want every order, with customer details where they exist. Which merge?', o: ["pd.merge(orders, customers, on='customer_id', how='left')", "pd.merge(orders, customers, on='customer_id', how='inner')", "pd.merge(customers, orders, on='customer_id', how='left')", "pd.concat([orders, customers])"], a: 0, why: 'A left merge keeps every row from the left table (orders). An inner merge would drop orders whose customer is missing.' },
    { q: 'Which correctly keeps Delhi orders above 500?', o: ["df[(df['city'] == 'Delhi') & (df['amount'] > 500)]", "df[df['city'] == 'Delhi' and df['amount'] > 500]", "df[df['city'] == 'Delhi' & df['amount'] > 500]", "df[(df['city'] == 'Delhi') + (df['amount'] > 500)]"], a: 0, why: 'pandas needs & (not "and"), and each condition in brackets, because & binds tighter than ==.' },
    { q: 'What does this keep?', code: "df.drop_duplicates(subset=['order_id'], keep='last')", o: ['One row per order_id: the last one that appears', 'Only rows whose order_id is unique', 'The first row per order_id', 'Every row, sorted by order_id'], a: 0, why: 'subset decides what counts as a duplicate, and keep chooses which copy survives. Sort first if "last" should mean "latest".' }
  ]
},
{
  id: 'powerbi', name: 'Power BI', blurb: 'Power Query, data models and DAX measures.',
  next: {
    beginner: { text: 'Learn Power Query, a simple star schema and your first measures. Then build the dashboard phase of the Kirana Store project.', practice: '/practice?role=data-analyst', project: '/free' },
    intermediate: { text: 'Good. Practise CALCULATE, a proper date table and time intelligence on Data Analyst tasks.', practice: '/practice?role=data-analyst', project: '/free' },
    advanced: { text: 'Strong. Build a full dashboard on a corporate case and write the one-page summary too.', practice: '/practice?role=data-analyst', project: '/search?q=Power BI' }
  },
  qs: [
    { q: 'Which language do you write Power BI measures in?', o: ['DAX', 'M', 'SQL', 'VBA'], a: 0, why: 'Measures and calculated columns use DAX. M is the language behind Power Query.' },
    { q: 'Where do you clean and reshape data before it loads into the model?', o: ['Power Query', 'The report canvas', 'The Format pane', 'Bookmarks'], a: 0, why: 'Power Query (Transform data) is where you fix types, split columns, merge and append.' },
    { q: 'Which visual best shows how sales changed month by month?', o: ['Line chart', 'Pie chart', 'Card', 'Table'], a: 0, why: 'A line chart shows change over time. Pie charts compare parts of a single total.' },
    { q: 'In a star schema, the table with one row per product is a…', o: ['Dimension table', 'Fact table', 'Bridge table', 'Measure table'], a: 0, why: 'Dimensions describe things (products, customers, dates). Fact tables hold the events, such as each sale.' },
    { q: 'Total Sales must change when someone clicks a slicer. Should it be a measure or a calculated column?', o: ['A measure', 'A calculated column', 'Either, they behave the same', 'Neither, use a parameter'], a: 0, why: 'Measures are calculated at query time in the current filters. Calculated columns are stored per row when the data refreshes.' },
    { q: 'What does this measure return?', code: 'North Sales = CALCULATE([Total Sales], Region[Name] = "North")', o: ['Sales for North, even when a slicer selects another region', 'Sales for North only when North is selected', 'Sales for every region except North', 'An error, because CALCULATE needs a table'], a: 0, why: 'A filter argument in CALCULATE replaces any existing filter on that column.' },
    { q: 'Why use <code>DIVIDE([Profit], [Sales])</code> instead of <code>[Profit] / [Sales]</code>?', o: ['DIVIDE returns blank instead of an error when Sales is 0', 'DIVIDE is the only way to get a percentage', 'The / operator does not work in measures', 'DIVIDE rounds the result'], a: 0, why: 'DIVIDE handles divide-by-zero safely, so visuals do not show errors.' },
    { q: 'What does this calculate?', code: 'Revenue = SUMX(Sales, Sales[Qty] * Sales[Price])', o: ['Qty × Price for each row, then the total', 'Total Qty × total Price', 'The average price', 'The number of sales rows'], a: 0, why: 'SUMX works row by row, then sums. Total Qty × total Price would give a much bigger, wrong number.' },
    { q: 'SAMEPERIODLASTYEAR returns blanks. What is the most likely cause?', o: ['No proper date table (every day, no gaps) related to the facts and marked as a date table', 'The visual is a bar chart', 'The measure name has a space in it', 'Power BI only keeps one year of data'], a: 0, why: 'Time intelligence functions need a continuous date table connected to your fact table.' },
    { q: 'What does this measure show for each product in a table visual?', code: 'Share = DIVIDE([Sales], CALCULATE([Sales], ALL(Product)))', o: ['That product\'s share of total sales across all products', 'Sales for all products in every row', '100% for every product', 'The rank of the product'], a: 0, why: 'ALL(Product) removes the product filter in the denominator, so each row is divided by the grand total.' }
  ]
},
{
  id: 'stats', name: 'Statistics', blurb: 'Averages, A/B tests and reading results honestly.',
  next: {
    beginner: { text: 'Learn mean vs median, spread and what a p-value really says. The Funnel project shows them on a real A/B test.', practice: '/practice?role=data-scientist', project: '/free' },
    intermediate: { text: 'Good. Practise A/B test checks (split ratio, segments) on the Funnel project.', practice: '/practice?role=data-scientist', project: '/free' },
    advanced: { text: 'Strong. The Data Scientist and Product Analyst tracks will push you on experiment design and leakage.', practice: '/practice?role=data-scientist', project: '/search?q=Statistics' }
  },
  qs: [
    { q: 'What is the median of 2, 3 and 100?', o: ['3', '35', '2', '100'], a: 0, why: 'The median is the middle value once sorted. The mean would be 35.' },
    { q: 'Most orders are ₹200 to ₹500, with a few ₹50,000 bulk orders. Which number best describes a typical order?', o: ['The median', 'The mean', 'The maximum', 'The sum'], a: 0, why: 'A few huge values pull the mean up. The median is not affected by them.' },
    { q: 'What does the standard deviation measure?', o: ['How spread out values are around the mean', 'The most common value', 'The middle value', 'How many values there are'], a: 0, why: 'A small standard deviation means values sit close to the mean. A large one means they are spread out.' },
    { q: 'Ice cream sales and AC sales have a correlation of 0.9. What can you say?', o: ['They rise and fall together, but this alone does not show one causes the other', 'Ice cream sales cause AC sales', 'AC sales cause ice cream sales', 'The data must be wrong'], a: 0, why: 'Both are probably driven by hot weather. Correlation is not causation.' },
    { q: 'An A/B test gives p = 0.03 (you test at 5%). What does that mean?', o: ['If there were no real difference, a result this extreme would happen about 3% of the time', 'There is a 97% chance B is better', 'B is 3% better than A', 'There is a 3% chance the test was set up wrongly'], a: 0, why: 'A p-value is about the data assuming no difference. It is not the probability that B wins.' },
    { q: 'You planned a 50/50 split, but with 1,00,000 users you got 60/40. What should you do first?', o: ['Check how users were assigned and logged before trusting any result', 'Report the winner, since there are plenty of users', 'Delete users until it is 50/50', 'Ignore it, splits never come out exactly 50/50'], a: 0, why: 'At this size, 60/40 is far too large to be chance. A sample ratio mismatch usually means a bug, and the result cannot be trusted.' },
    { q: 'A converts 200 of 4,000 users. B converts 260 of 4,000. What is B\'s relative lift?', o: ['30%', '1.5%', '6.5%', '60%'], a: 0, why: 'A = 5%, B = 6.5%. The gap is 1.5 points, and 1.5 / 5 = 30% relative lift.' },
    { q: 'B beats A on Android and on iOS, but A wins overall. How can that happen?', o: ['The two groups have a different mix of Android and iOS users', 'It cannot happen, the numbers must be wrong', 'Android users are counted twice', 'The test ran too long'], a: 0, why: 'This is Simpson\'s paradox. When group sizes differ by segment, the overall result can flip. Compare like with like.' },
    { q: 'The 95% confidence interval for B\'s lift is −1% to +4%. What do you conclude?', o: ['You cannot say B is better yet, the interval includes zero', 'B is better by 4%', 'B is better by 1.5%', 'B is worse'], a: 0, why: 'A lift of zero (or a small loss) is still plausible. You need more data or a bigger effect.' },
    { q: 'You survey only your current customers to measure satisfaction. What is the problem?', o: ['Unhappy customers who left are missing, so the score looks too good', 'The sample is too large', 'Current customers always answer randomly', 'There is no problem'], a: 0, why: 'This is survivorship bias. The people most likely to be unhappy are no longer in the sample.' }
  ]
}
];
