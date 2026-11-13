-- KOJOH blog post 2, saved as a DRAFT. Run in the Supabase SQL editor, then open Admin -> Blog, review and Publish.
insert into public.blog_posts (slug, title, description, body_md, cover_url, cover_alt, project_slug, tags, author, status)
values (
  'what-makes-kojoh-different',
  'What Makes KOJOH Different: Portfolio Projects, Not Just Datasets',
  'KOJOH is not just a dataset marketplace: messy real-world data, a business brief, unique data packs, an AI coach and verified certificates.',
  $kj$There is no shortage of free datasets on the internet. Kaggle alone has hundreds of thousands, and they are excellent for competitions, machine learning practice and public research. But if you are a student or job seeker trying to build a portfolio, a dataset on its own is only the starting point. You still have to find a real question, work out what a company would want, clean the data, and turn it into something a recruiter will remember.

KOJOH is built for that one job. It is not a general dataset marketplace. It is a place to do **portfolio projects that look like real work**. Here is what that means in practice.

## 1. Every dataset comes with a business problem

A KOJOH project starts with a story, not a file. A kirana owner in Lucknow wants to know which items really make money. An online fashion store thinks returns are eating its profit. A quick commerce app keeps running out of stock on Saturdays.

Each project gives you:

- **A short brief** written like a message from a manager: who the business is, what went wrong and what they need.
- **Phased tasks**: clean the data, answer the questions, then build the dashboard or model.
- **Interview questions** the project prepares you for, so you know how to talk about it.

That structure is the difference between "I analysed a dataset" and "I found that the shop's top seller makes almost no profit, and here is why." The second answer gets interviews.

## 2. The data is messy on purpose

Most practice datasets are tidy: one date format, prices as numbers, no duplicates. Real company exports never look like that, and cleaning is a large part of any analyst's week.

KOJOH datasets are synthetic but built to behave like real business data, including the mess. In the [Kirana Store Sales](/projects/kirana-store-sales-free) project, for example, one column holds three date formats, prices are typed as `54`, `₹54` and `Rs.54`, and 62 products appear under 259 different spellings. Every project has a data dictionary that lists each problem, so you know what you are dealing with before you start.

When an interviewer asks "what problems did you find in the data?", you will have real answers.

## 3. Your data can be different from everyone else's

The biggest problem with popular datasets is that thousands of people use the same ones. A recruiter who has seen the same supermarket dashboard fifty times will not remember yours.

On many KOJOH projects, buyers receive their own **licence pack**: a version of the dataset and task set generated for them. Some projects give each buyer a unique pack, others share one pack across a small group. Your numbers, and your answers, are not copied from a public notebook.

## 4. An AI coach that guides instead of solving

Every project has a ready-made prompt you copy into ChatGPT, Claude or Gemini. It tells the AI about your project, your files, every column and how it is messy, and then asks it to behave like a mentor:

- Ask which task you are on before helping.
- Tell you which file and which join you need for each task.
- Point you to the right approach instead of pasting finished code.
- Push back when a number you report looks impossible.

You get help when you are stuck, but you still do the thinking, which is the part you need to explain in an interview.

## 5. Indian business context, plus global projects

Most famous datasets come from the US or Europe. KOJOH focuses on businesses Indian students recognise: kirana stores, UPI statements, NBFC loans, quick commerce, appliance service centres and Diwali sales. Prices are in rupees and the problems feel familiar.

There are also global projects, such as a fashion store selling in the US, UK and EU, a SaaS company with subscriptions in 14 countries, and food delivery across Chicago, London and Singapore, for learners who want international experience on their CV.

## 6. Verified certificates that recruiters can check

When you finish a paid project, or the free Returns project, the KOJOH team reviews your work before a certificate is issued. Each certificate has a public verification page with a QR code and a button to add it to LinkedIn, so anyone can confirm it is real.

## 7. Practice that runs in your browser

Alongside projects, KOJOH Practice gives you question sets for four roles: Data Analyst, Business Analyst, Data Scientist and Data Engineer. SQL and Python run directly in the browser, with no installation, and every level is a case company with its own tables. The first questions in each role are free.

## How KOJOH compares

| | Free dataset sites | Online courses | KOJOH |
|---|---|---|---|
| Realistic messy data | Sometimes | Rarely | Always, documented |
| Business brief and tasks | No | Course exercises | Yes, per project |
| Unique data per learner | No | No | On many projects |
| Help when stuck | Forums | Course mentors | AI coach prompt per project |
| Reviewed certificate | No | Course certificate | Yes, publicly verifiable |
| Indian business context | Rare | Rare | Most projects |
| Price | Free | Monthly or course fee | Free projects, paid ones from ₹99 one-time |

Free dataset sites are still the best place to explore data or join a competition, and courses are great for learning a tool from scratch. KOJOH sits after both: it is where you build the project you show to an employer.

## What KOJOH is not

To be clear about what you are getting:

- **The data is synthetic.** The companies, people and transactions are invented. They are built to behave like real data, but they are not leaked or scraped company records.
- **It does not teach tools from zero.** You should know the basics of Excel, SQL or Python first. The [free skill check](/skills) tells you where you stand.
- **It does not hand you answers.** The tasks, the AI prompt and the review are all designed to make you do the work.

## Where to start

Start with a free project. Five are fully free, with complete datasets rather than samples:

- [Kirana Store Sales](/projects/kirana-store-sales-free): Python, SQL and Power BI on a year of grocery bills.
- [Returns Are Eating Our Profit](/projects/returns-eating-profit-free): e-commerce returns across three currencies, with a certificate.
- [The Funnel That Leaked](/projects/the-funnel-that-leaked-free): product analytics and an A/B test.
- [Aai's Tiffin Service](/projects/aai-tiffin-service-free): Excel and Power BI for a home kitchen business.
- [The Migration That Lost Students](/projects/migration-lost-students-free): SQL data reconciliation for data engineers.

When you are ready for more, [browse all projects](/projects). One finished project you can explain well is worth more than ten you copied.
$kj$,
  '/assets/blog/what-makes-kojoh-different/cover.webp',
  'What makes KOJOH different: business brief, messy data, unique data packs, AI coach, verified certificate',
  'kirana-store-sales-free',
  array['KOJOH', 'dataset marketplace', 'data analyst portfolio projects', 'messy datasets', 'Kaggle alternative'],
  'KOJOH team',
  'draft'
)
on conflict (slug) do nothing;
