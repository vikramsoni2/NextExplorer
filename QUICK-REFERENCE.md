# Quick Reference - Monorepo Commands

## Development

```bash
# Start both backend and frontend together
npm run dev

# Start backend only (runs on configured port)
npm run dev:backend

# Start frontend only (Vite dev server)
npm run dev:frontend
```

## Code Quality

```bash
# Lint entire monorepo
npm run lint

# Lint and automatically fix issues
npm run lint:fix

# Format all code
npm run format

# Check if code is formatted (CI-friendly)
npm run format:check
```

## Testing

```bash
# Run backend tests
npm run test

# Run frontend unit tests
npm run test:unit -w frontend
```

## Building

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview -w frontend
```

## Dependencies

```bash
# Install dependencies for all workspaces
npm install

# Add dependency to specific workspace
npm install <package> -w backend
npm install <package> -w frontend

# Add shared dev dependency (ESLint plugins, etc.)
npm install <package> -D
```

## Workspace-Specific Commands

```bash
# Run any script in a specific workspace
npm run <script> -w <workspace>

# Examples:
npm run storybook -w frontend
npm run download_samples -w backend
```

## Project Structure

```
nextExplorer/
├── Root config (applies to all)
│   ├── .eslintrc.cjs
│   ├── .eslintignore
│   ├── prettier.config.cjs
│   ├── .prettierignore
│   └── .editorconfig
│
├── backend/            Node.js/Express API
│   └── .eslintrc.cjs   (Node-specific rules)
│
├── frontend/           Vue 3 + Vite
│   └── .eslintrc.cjs   (Vue + browser rules)
│
└── docs/               VitePress documentation
```

## Tips

- All lint/format commands now run from **root** for entire monorepo
- ESLint and Prettier configs are automatically inherited by workspaces
- Shared dev tools (eslint, prettier) are hoisted to root `node_modules`
- Editor settings in `.editorconfig` ensure consistency across IDEs
- Use `-w <workspace>` flag to target specific workspace

## Troubleshooting

**If linting/formatting doesn't work:**

```bash
# Ensure dependencies are installed
npm install

# Verify ESLint can find the config
npx eslint --print-config backend/src/app.js | grep "root"
```

**If you see "module not found" errors:**

```bash
# Reinstall to properly hoist dependencies
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
```

**To see which files will be linted/formatted:**

```bash
# ESLint
npx eslint . --debug 2>&1 | grep "Processing"

# Prettier
npx prettier . --list-different
```
