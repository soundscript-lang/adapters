# @soundscript/register

Node preload hooks for local `.sts` source execution.

Use it directly from Node:

```bash
node --import @soundscript/register ./src/main.sts
```

If you need custom options, import `registerSoundscriptHooks()` and call it yourself before the
first `.sts` import.
