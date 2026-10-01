// Per-file ordering: lint-staged runs the commands of ONE matching glob
// sequentially but different globs concurrently, so ts/tsx files get a single
// function config (ESLint --fix, then Prettier --write) to avoid races.
const pkgOf = (f) => f.match(/((?:apps|packages)\/[^/]+|e2e)\//)?.[1];

export default {
  '*.{ts,tsx}': (files) => {
    const byPkg = new Map();
    for (const f of files) {
      const pkg = pkgOf(f);
      if (!pkg) continue;
      byPkg.set(pkg, [...(byPkg.get(pkg) ?? []), f]);
    }
    return [
      ...[...byPkg].map(([pkg, fs]) => `pnpm --dir ${pkg} exec eslint --fix ${fs.join(' ')}`),
      `prettier --write ${files.join(' ')}`,
    ];
  },
  '*.{js,mjs,cjs,json,md,yml,yaml,css}': ['prettier --write'],
};
