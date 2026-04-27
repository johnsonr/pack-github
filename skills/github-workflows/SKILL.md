---
name: github-workflows
description: GitHub workflows — listing/searching/creating issues and PRs, looking up users and repos, paginating large result sets, handling rate limits, and the search-then-get pattern. Activate this skill BEFORE making any GitHub call when the user asks anything involving issues, pull requests, repositories, commits, releases, GitHub users, organisations, or anything on github.com.
---

# GitHub Workflows

Operational guide when the user asks about anything on GitHub. Activating
this skill replaces guesswork about pagination, field names, response
shapes, and rate limits with concrete patterns.

## Read this first — naming convention

The workspace exposes GitHub via two namespaces, both reached as
`gateway.<namespace>.<method>(args)` from inside `execute_javascript` or
`execute_python`. **Never call them as top-level tools.**

| Namespace | When to use |
|---|---|
| `gateway.gh.*` | OpenAPI-typed. **Method names are camelCase**: `issuesListForRepo`, `issuesGet`, `usersGetByUsername`. The TYPED API SURFACE shows exact request/response shapes. **Prefer this namespace.** |
| `gateway.github.*` | MCP-backed fallback. Use only if `gh` is not installed. Response types may be `unknown`, requiring an exploratory call. |

**Cardinal naming rule for `gateway.gh.*`:**
- **Method** = camelCase (`issuesListForRepo`, NOT `issues_list_for_repo`)
- **Arguments** = snake_case where GitHub's REST API uses snake_case
  (`per_page`, `issue_number`, `pull_number`, `q`)

If a call returns `Error: gateway.gh.foo is not a workspace tool`, the
error message lists every available method. **Read it.** Don't re-issue
the same call — pick a method from the list. A second identical call is
always wrong.

To see the full surface inline: `bash_run "cat /workspace/interfaces.ts"`.

## The cardinal rules

1. **Don't fabricate identifiers.** Issue numbers, PR numbers, commit
   SHAs, usernames, repo names, URLs — every one must come from a tool
   result. If you don't have it, fetch it. If you can't fetch it, say so.
2. **Always pass `owner` and `repo` explicitly.** Never assume a
   "current" repo — there isn't one. Ask the user if they didn't say.
3. **Cap pagination.** GitHub will happily serve 10,000 issues if you
   ask. Default to the first 1–3 pages of `per_page: 100` and stop early
   when you have enough.
4. **Render every linkable thing as a link.** Issue numbers, PR numbers,
   commits, repos, users — wrap in `<a href="...">` using the `html_url`
   field where available.

## Pattern: list issues / PRs

```javascript
const r = await gateway.gh.issuesListForRepo({
  owner: "embabel",
  repo: "embabel-agent",
  state: "open",          // open | closed | all
  sort: "created",        // created | updated | comments
  direction: "desc",
  per_page: 30,
});
// r is a bare array — each item has: number, title, state, user.login,
// html_url, created_at, updated_at, labels[], assignees[].
console.log(r.map(i => `#${i.number} ${i.title}`).join("\n"));
```

**PRs are issues** in the GitHub API. `issuesListForRepo` returns both;
filter with `i.pull_request !== undefined` for PRs only, or use
`pullsList` if you only want PRs.

## Pattern: get a single issue / PR

If the user gives a number, fetch it directly — don't list-and-filter:

```javascript
const i = await gateway.gh.issuesGet({
  owner: "embabel", repo: "assistant", issue_number: 42,
});
```

## Pattern: search-then-get

For "find issues mentioning X" or "what's been said about Y", use
`searchIssuesAndPullRequests` first, then `issuesGet` on the hits you
need full details for. Search returns a wrapped object:
`{ total_count, items, incomplete_results }`.

```javascript
const s = await gateway.gh.searchIssuesAndPullRequests({
  q: "repo:embabel/embabel-agent state:open label:bug pagination",
  per_page: 10,
});
console.log(`${s.total_count} hits`);
for (const hit of s.items) {
  console.log(`#${hit.number} ${hit.title} — ${hit.html_url}`);
}
```

Search query operators worth knowing:
`repo:owner/name`, `org:owner`, `user:login`, `is:open|closed|merged`,
`state:open|closed`, `label:foo`, `author:login`, `assignee:login`,
`mentions:login`, `created:>2025-01-01`, `updated:<2026-01-01`,
`in:title`, `in:body`.

## Pattern: paginate safely

```javascript
let all = [];
const MAX_PAGES = 3;        // hard cap — raise consciously
for (let page = 1; page <= MAX_PAGES; page++) {
  const r = await gateway.gh.issuesListForRepo({
    owner: "embabel", repo: "embabel-agent",
    state: "all", per_page: 100, page,
  });
  if (!r || r.length === 0) break;       // empty page → done
  all.push(...r);
  if (r.length < 100) break;             // partial page → last page
}
```

Always have BOTH break conditions. The `r.length < 100` check is the one
people forget; without it you waste one extra request per run.

## Pattern: look up a user

```javascript
const u = await gateway.gh.usersGetByUsername({ username: "johnsonr" });
console.log(`${u.name || u.login} — ${u.bio || "(no bio)"} — ${u.html_url}`);
```

Useful fields: `login`, `name`, `bio`, `company`, `blog`, `location`,
`public_repos`, `followers`, `html_url`, `avatar_url`.

For the authenticated user: `usersGetAuthenticated()` (no args).

## Pattern: create an issue

```javascript
const i = await gateway.gh.issuesCreate({
  owner: "embabel", repo: "assistant",
  title: "Short imperative title",
  body: "## Context\n…\n## Repro\n…\n## Expected\n…",
  labels: ["bug"],
});
console.log(`Created #${i.number}: ${i.html_url}`);
```

Don't create issues without confirming the user actually wants one
created — issue creation is visible to other people.

## Pattern: comment on an issue / PR

```javascript
await gateway.gh.issuesCreateComment({
  owner: "embabel", repo: "assistant", issue_number: 42,
  body: "Comment markdown here.",
});
```

## Pattern: repository metadata

```javascript
const repo = await gateway.gh.reposGet({ owner: "embabel", repo: "assistant" });
const readme = await gateway.gh.reposGetReadme({ owner: "embabel", repo: "assistant" });
const release = await gateway.gh.reposGetLatestRelease({ owner: "embabel", repo: "assistant" });
```

For listing repos under a user: `reposListForUser({ username: "johnsonr" })`.
For your own: `reposListForAuthenticatedUser({ per_page: 100 })`.

## Common pitfalls

- **camelCase methods, snake_case args**: `issuesListForRepo({ per_page: 30 })`
  — the method is camelCase, the arg is snake_case. Most "not a workspace
  tool" errors come from method names written as snake_case.
- **Don't repeat a failed call.** If a method name is wrong, the error
  lists every valid method. Pick from the list; never re-send the same
  call.
- **Wrong field name on user**: it's `i.user.login`, not `i.author.login`.
- **Wrong shape on search**: search endpoints return
  `{ total_count, items }`, not a bare array. Listing endpoints return a
  bare array.
- **`q` vs `query`**: search uses `q`, not `query`.
- **`per_page` max is 100**: anything above 100 is silently capped.
- **No "current repo" default**: every call needs `owner` and `repo`.
- **Empty `state` defaults to `open`**: pass `state: "all"` if you want
  closed too.
- **Token rate limits**: 5,000 requests/hour authenticated. If a script
  needs >100 calls, ask the user to confirm the scope first.
- **Search has a smaller rate limit**: 30 req/min. Don't loop search; do
  one query and refine it.

## When NOT to use this skill

- General "what is git" / "how do I rebase" questions — that's
  documentation, not the API.
- Questions about a LOCAL git repository — use `bash_run` with `git`.
- "Build me a dashboard for GitHub data" — call the app builder tool;
  it fetches data itself through the same gateway.
