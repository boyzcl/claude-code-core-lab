# Pull Request

## Summary

Describe the smallest useful change in this PR.

## Change Type

- [ ] Course / learner documentation
- [ ] Lab implementation or verify case
- [ ] Core implementation or verify case
- [ ] Roadmap / validation matrix / authority map
- [ ] GitHub / CI / contribution flow
- [ ] Other

## Evidence

Commands run:

```bash
git diff --check
npm run docs:links
```

Add focused commands or `npm run verify:all` when implementation, scripts, package metadata, or behavior changed.

## Boundary Checklist

- [ ] I did not add API keys, tokens, `.env.local`, private traces, copied prompts, source maps, or decompiled source snippets.
- [ ] I did not present local deterministic evidence as a production Claude Code replacement, official implementation, real provider bill, or RelativeScore.
- [ ] If I changed learning docs, I kept the course -> lab -> core naming system intact.
- [ ] If I changed behavior, I added or updated the matching verify evidence.
- [ ] If I added a new doc, I updated the relevant README, docs index, or authority map.
