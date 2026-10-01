import { ProductModal } from '@/components/product-modal';
import { findProduct, findServer } from '@/lib/catalog';
import { notFound } from 'next/navigation';

export default async function ProductModalPage({
  params,
}: {
  params: Promise<{ server: string; product: string }>;
}) {
  const { server: serverSlug, product: productSlug } = await params;
  const server = findServer(serverSlug);
  const product = findProduct(serverSlug, productSlug);
  if (!server || !product) notFound();
  return <ProductModal product={product} server={server} />;
}
