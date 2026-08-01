# AGENTS.md

## GitHub Pages deployment

The live site is published from the `gh-pages` branch and served from the branch root.

Repository Pages configuration:

- Source: **Deploy from a branch**
- Branch: `gh-pages`
- Folder: `/(root)`
- Live URL: `https://danielsobrado.github.io/fluffytree-threejs/`

Do not add a GitHub Actions Pages workflow unless the deployment strategy is intentionally changed.

### Deploy

Deploy only committed changes that have already been pushed to `main`:

```bash
npm ci
npm run deploy:pages
```

The `deploy:pages` script:

1. Runs the project checks.
2. Fetches `origin/main` and `origin/gh-pages`.
3. Verifies the required deployment files configured in `pages.config.yml`.
4. Publishes the exact remote `main` commit to `gh-pages`.
5. Uses `--force-with-lease` when updating an existing `gh-pages` branch.

The script intentionally does not deploy uncommitted work or local commits that have not been pushed to `main`.

Deployment configuration is stored in `pages.config.yml`. The implementation is in `tools/deploy-pages.js`.

### Normal release sequence

```bash
git status
git add <files>
git commit -m "<message>"
git push origin main
npm ci
npm run deploy:pages
```

After deployment, verify:

- `main` and `gh-pages` point to the intended release commit.
- The live URL loads successfully.
- Browser developer tools show no missing asset, module, YAML, or CORS errors.
