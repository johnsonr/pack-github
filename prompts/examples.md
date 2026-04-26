# github-openapi pack — usage examples

The OpenAPI-typed GitHub gateway exposes namespace `gh` (vs the MCP-backed
`github`). Methods are derived from the spec's operationId; the LLM sees
full request and response types in `interfaces.ts`, including pagination
wrappers and exact field names.

## Why this pack exists

The MCP-backed `github` namespace gives the LLM minimal type info — tool
names and argument schemas, with response types marked `unknown`. That
costs every chat turn an extra round-trip to discover the response shape:

- `.forEach` on `{issues, totalCount, pageInfo}` because the LLM thought
  it was a bare array
- `i.user.login` vs `i.author.login` field-name guessing
- `after: null` rejected by the MCP server (expected `string | undefined`)
- `q` vs `query` argument-name confusion across endpoints

With OpenAPI types the LLM reads the wrapper shape from `interfaces.ts`
before writing the script. Same data, fewer iterations.

## Common patterns

List the most recent issues in a repo:

```javascript
const r = await gateway.gh.issues_list_for_repo({
  owner: "embabel",
  repo: "embabel-agent",
  state: "open",
  sort: "created",
  direction: "desc",
  per_page: 10,
});
console.log(JSON.stringify(r.map(i => ({number: i.number, title: i.title})), null, 2));
```

Top-N issue creators (paginated):

```javascript
let all = [];
for (let page = 1; page <= 10; page++) {
  const r = await gateway.gh.issues_list_for_repo({
    owner: "embabel",
    repo: "embabel-agent",
    state: "all",
    per_page: 100,
    page,
  });
  if (!r || r.length === 0) break;
  all.push(...r);
  if (r.length < 100) break;
}
const counts = {};
for (const i of all) counts[i.user.login] = (counts[i.user.login] || 0) + 1;
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(JSON.stringify(top));
```

Lookup a user:

```javascript
const u = await gateway.gh.users_get_by_username({ username: "johnsonr" });
console.log(`${u.name} (${u.login}) — ${u.bio}`);
```

Create an issue:

```javascript
const i = await gateway.gh.issues_create({
  owner: "embabel",
  repo: "assistant",
  title: "...",
  body: "...",
});
console.log(`#${i.number}: ${i.html_url}`);
```
