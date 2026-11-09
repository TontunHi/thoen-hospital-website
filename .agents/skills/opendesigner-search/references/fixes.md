# From what the engines did to page fixes

Each fix is a proposal with its evidence: the question, the engine, what it searched and what it used instead. The owner says yes before anything changes. Rewrite in the site's own voice, and copy nothing from the pages the engine used.

| What you saw | What it means | The fix |
|---|---|---|
| The engine searched the question verbatim and cited pages whose URL and title repeat it | It matches pages to the asker's words | A page, or a section with its own heading, whose title, h1 and first sentence answer that question in the same words. Keep an existing URL; change the words, not the address |
| It suggested follow-up questions | It expects them next, and will look for answers | Short answers on the FAQ or the right page: two or three sentences each, with a link onward. FAQPage markup is fine when it matches the visible text |
| A competitor is named first | The engine has a comparison in mind | An honest comparison: what each does, checked against the competitor's own pages. Never invent their weaknesses |
| It confused the brand with another of the same name | The entity is ambiguous | `Organization` JSON-LD with `sameAs` links to the profiles that are really yours (repository, directory listing); name the product the same way everywhere |
| It searched for official docs (for example "CLAUDE.md … documentation official") | It trusts the platform's own pages for that | Say on your page how your product fits that platform's own mechanism, with a link to the official page |
| It cited roundups, awesome-lists or directories | Category answers come from lists | A proposal to be listed there, one by one, for the owner's yes. Never post or submit unasked |
| It answered a how-to question with general advice and named the product only in passing, or not at all | Steps and things to copy beat a page that describes the product | Lead the how-to page with what the asker can copy: the files and where they go, a ready rule or config file, a first prompt. Then show how the product makes them |
| A capability the product has went unmentioned | No page says it in a sentence the engine can quote | One plain sentence per capability, on the page people land on ("it checks contrast on every text and background pair, including hover and pressed fills, in light and dark mode"), in the words people use for the product ("Claude skill", not only "plugin") |
| It read none of the site's pages for a question the site answers | The page is missing, buried or worded differently | First check that it is in the sitemap, linked from another page and readable without JavaScript. Then the wording |
| The answer about the brand was wrong | The engine trusts an outdated or wrong source | Correct the site first. Then tell the owner which source said it |

## Writing the fix
- **Answer in the first sentence** under the heading; detail comes after.
- **Facts the engines can quote:** real figures with their qualifier (for whom, over what time, compared with what) and named sources. Only the owner's proof from Q-site-03. Never a number, quote or review that was not given.
- **The words people use,** not internal names. No repeating them for its own sake: keyword stuffing makes things worse.
- **Something to copy.** For a how-to question, a file tree, a ready rule file or a prompt is what gets quoted.
- **One page per question.** Never make a set of near-identical pages to rank (scaled content abuse).
