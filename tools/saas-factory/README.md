# SaaS Factory generator v1

Requirements: Node.js 22.12 or newer (below 27); no install or network access is needed.

From the repository root, preview the deterministic file manifest:

```sh
node tools/saas-factory/generate.mjs \
  --config tools/saas-factory/examples/minimal.json \
  --output-root /tmp/saas-factory-demo
```

The default is dry-run. To create a new `<projectSlug>` directory under the explicitly chosen output root, add `--write`. Existing destinations and symbolic links are refused; no Git repository, credentials, or remote deployment is created. The CLI accepts the camelCase v1 contract documented in `docs/factory/02-generator-contract.md`.

The generator is dependency-free and can be extracted by copying this directory into an independent `SaaS-Factory` repository. Run it with `node generate.mjs` there; keep template changes reviewed and versioned with the contract. The generated Cloudflare option configures local OpenNext builds only, never deployment.
