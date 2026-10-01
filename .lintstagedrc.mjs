export default {
  '*.{ts,tsx,js,mjs,cjs}': ['prettier --write'],
  '{apps,packages,e2e}/**/*.{ts,tsx}': (files) => {
    const byPkg = new Map();
    for (const f of files) {
      const m = f.match(/((?:apps|packages)\/[^/]+|e2e)\//);
      if (!m) continue;
      byPkg.set(m[1], [...(byPkg.get(m[1]) ?? []), f]);
    }
    return [...byPkg].map(([pkg, fs]) => `pnpm --dir ${pkg} exec eslint --fix ${fs.join(' ')}`);
  },
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
};
