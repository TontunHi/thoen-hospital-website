# Practices, their sources and how strong they are

Three kinds of evidence, kept apart. A platform's own docs settle what that platform does. A study shows an effect under its conditions. Practice is advice that holds often, and is never a rule. All of these were read on 2026-11-07.

## Platform docs
| Practice | Source |
|---|---|
| No special file, schema or optimisation is needed to appear in AI Overviews or AI Mode; normal SEO applies | Google, [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) |
| Limit what Google shows with `nosnippet`, `data-nosnippet`, `max-snippet` or `noindex`; robots.txt for Googlebot controls crawling. Google-Extended is about AI training and grounding elsewhere, not Search | Same page |
| Structured data must be a true picture of the visible page; don't mark up what readers can't see | Google, [structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) |
| FAQ rich results are no longer shown (2026); HowTo rich results were removed in 2023. Matching markup is harmless; report it as info and keep it | Google Search Central documentation updates, entries of 2026-05-08 and 2026-06-15 (served at [the FAQ page address](https://developers.google.com/search/docs/appearance/structured-data/faqpage)), and [blog, 2023-08](https://developers.google.com/search/blog/2023/08/howto-faq-changes) |
| Keyword stuffing and scaled content abuse (many pages made to manipulate rankings) are spam | Google, [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) |
| OAI-SearchBot puts sites in ChatGPT search, and a site that blocks it is not shown there. Blocking GPTBot (training) does not remove it. ChatGPT-User acts for a person, so robots.txt "may not apply" | OpenAI, [crawlers](https://developers.openai.com/api/docs/bots) |
| PerplexityBot surfaces sites in Perplexity and is not used for training. Perplexity-User "generally ignores robots.txt" | Perplexity, [bots](https://docs.perplexity.ai/guides/bots) |
| ClaudeBot collects training data. Claude-User fetches for a person and Claude-SearchBot improves search. Anthropic says its bots honour robots.txt | Anthropic, [help center](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| IndexNow tells Bing, Yandex, Seznam, Naver and others about changed pages, with a key file at the site root. Google is not a participant: it reads the sitemap | [IndexNow](https://www.indexnow.org/documentation) |
| llms.txt is a proposal (Jeremy Howard, 2024): Markdown at `/llms.txt`, with an H1 as the one required part. Google says such files are not needed for Search | [llmstxt.org](https://llmstxt.org); Google's changelog |

## Studies (medium: real effects, under their conditions)
- **Aggarwal et al., "GEO: Generative Engine Optimization", KDD 2024** ([arXiv 2311.09735](https://arxiv.org/abs/2311.09735)).
  - Setup: 10,000 queries, with GPT-3.5 answering from the top five Google results.
  - Effect on how much of the answer used a page: adding quotations +41%, statistics +31%, citing sources +27%, keyword stuffing −8%.
  - On Perplexity: up to +37%. Lower-ranked pages gained most.
  - Engines have changed since 2023.
- **Liu, Zhang, Liang, "Evaluating Verifiability in Generative Search Engines", Findings of EMNLP 2023** ([arXiv 2304.09848](https://arxiv.org/abs/2304.09848)).
  - Across four engines, only 51.5% of sentences were fully supported by their citations, and 74.5% of citations supported their sentence.
  - The more useful an answer looked, the less often its citations held up (r = −0.96).
  - So check what an engine says about the site against the cited page.

## Practice (weak: often true, never a rule)
- Titles of about 50 to 60 characters and descriptions of about 140 to 160, because longer ones are cut in results. The search script warns past 60 and 160.
- One h1 per page, in the words people search.
- A canonical on every public page, pointing at itself. Don't pair `noindex` with a canonical to another page. Allow crawling and use `noindex` to drop a page: a `Disallow` stops the crawler from ever seeing the `noindex`.
- Comparison pages and directory listings help with category questions (our own probe, 2026-11-07: six questions on two engines, in one day).
