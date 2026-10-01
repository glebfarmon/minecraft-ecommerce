'use client';

import { demoPrizes } from '@/lib/catalog';
import type { Roll } from '@/lib/fairness';
import { roll, sha256Hex } from '@/lib/fairness';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

const SERVER_SEED = 'demo-7f3c9a1e5b2d4086';

export function FairCases() {
  const t = useTranslations('fair');
  const clientId = useId();
  const nonceId = useId();
  const [clientSeed, setClientSeed] = useState('my-lucky-seed');
  const [nonce, setNonce] = useState(1);
  const [hash, setHash] = useState('');
  const [result, setResult] = useState<Roll | null>(null);

  const total = demoPrizes.reduce((sum, p) => sum + p.weight, 0);

  useEffect(() => {
    void sha256Hex(SERVER_SEED).then(setHash);
  }, []);

  useEffect(() => {
    let current = true;
    void roll(SERVER_SEED, clientSeed, nonce, demoPrizes).then((r) => {
      if (current) setResult(r);
    });
    return () => {
      current = false;
    };
  }, [clientSeed, nonce]);

  return (
    <section id="fair" aria-labelledby="fair-title" className="scroll-mt-24 border-b border-line">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-[var(--gutter)] py-24 lg:grid-cols-12 lg:gap-6 lg:py-32">
        <div className="lg:col-span-5">
          <h2
            id="fair-title"
            className="max-w-[14ch] text-[clamp(2rem,4vw,3.5rem)] leading-[1] font-bold tracking-[-0.03em]"
          >
            {t('title')}
          </h2>
          <p className="mt-6 max-w-[52ch] leading-relaxed text-fg/80">{t('lead')}</p>

          <table className="mt-10 w-full max-w-md text-left text-sm">
            <caption className="mb-3 text-left text-[13px] font-medium tracking-[0.02em] text-muted uppercase">
              {`//${t('odds')} · Mythic case`}
            </caption>
            <tbody className="divide-y divide-line">
              {demoPrizes.map((prize) => {
                const won = result?.prize.id === prize.id;
                return (
                  <tr key={prize.id} className={won ? 'text-fg' : 'text-fg/70'}>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`size-1.5 rounded-full ${won ? 'bg-accent' : 'bg-transparent'}`}
                        />
                        {prize.name}
                      </span>
                    </td>
                    <td className="tabular py-3 text-right font-mono text-muted">{prize.weight}</td>
                    <td className="tabular py-3 text-right font-mono">
                      {((prize.weight / total) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 lg:p-8">
            <Field label={t('serverHash')}>
              <code className="block font-mono text-xs leading-relaxed break-all text-fg/90">
                {hash || '…'}
              </code>
            </Field>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
              <label htmlFor={clientId} className="block">
                <FieldLabel>{t('clientSeed')}</FieldLabel>
                <input
                  id={clientId}
                  value={clientSeed}
                  onChange={(e) => {
                    setClientSeed(e.target.value);
                  }}
                  spellCheck={false}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-bg px-4 font-mono text-sm outline-none focus-visible:border-accent"
                />
              </label>
              <label htmlFor={nonceId} className="block">
                <FieldLabel>{t('nonce')}</FieldLabel>
                <input
                  id={nonceId}
                  type="number"
                  min={0}
                  value={nonce}
                  onChange={(e) => {
                    setNonce(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className="tabular mt-2 h-12 w-full rounded-xl border border-border bg-bg px-4 font-mono text-sm outline-none focus-visible:border-accent sm:w-28"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 border-t border-line pt-6">
              <Field label={t('hmac')}>
                <code className="block font-mono text-xs leading-relaxed break-all text-muted">
                  {result ? (
                    <>
                      <span className="text-accent">{result.hmac.slice(0, 13)}</span>
                      {result.hmac.slice(13)}
                    </>
                  ) : (
                    '…'
                  )}
                </code>
              </Field>
              <Field label={t('value')}>
                <code className="tabular block font-mono text-xs text-fg/90">
                  {result
                    ? `⌊${String(result.x)} / 2⁵² × ${String(result.totalWeight)}⌋ = ${String(result.roll)}`
                    : '…'}
                </code>
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-inner)] bg-accent-soft p-4 pl-5">
              <div aria-live="polite">
                <FieldLabel>{t('result')}</FieldLabel>
                <p className="mt-1 text-2xl font-bold tracking-[-0.02em]">
                  {result?.prize.name ?? '…'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNonce((n) => n + 1);
                }}
                className="flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent transition-[filter] hover:brightness-110"
              >
                <RefreshCw className="size-4" />
                {t('roll')} · {t('nonce').toLowerCase()} {nonce + 1}
              </button>
            </div>

            <p className="mt-5 text-xs text-muted">
              {t('demo')} {t('serverSeed')}: <code className="font-mono">{SERVER_SEED}</code>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}
