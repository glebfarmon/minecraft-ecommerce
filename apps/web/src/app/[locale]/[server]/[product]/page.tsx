import { Footer } from '@/components/footer';
import { ProductDetail } from '@/components/product-detail';
import { Link } from '@/i18n/navigation';
import { findProduct, findServer, products } from '@/lib/catalog';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

export function generateStaticParams() {
  return products.map((p) => ({ server: p.server, product: p.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ server: string; product: string }>;
}) {
  const { server: serverSlug, product: productSlug } = await params;
  const server = findServer(serverSlug);
  const product = findProduct(serverSlug, productSlug);
  if (!server || !product) notFound();
  const t = await getTranslations('product');

  return (
    <>
      <main
        data-server={server.slug}
        style={{ '--accent': server.accent, '--on-accent': server.onAccent } as CSSProperties}
        className="mx-auto max-w-[1100px] px-[var(--gutter)] pt-32 pb-24"
      >
        <Link
          href={`/${server.slug}#shop`}
          className="mb-8 inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:border-white/30"
        >
          <ArrowLeft className="size-4" />
          {t('back')}
        </Link>
        <ProductDetail product={product} server={server} titleId="product-title" />
      </main>
      <Footer />
    </>
  );
}
