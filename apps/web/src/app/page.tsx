import { Button } from '@shop/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Minecraft Shop</h1>
      <Button>Browse servers</Button>
    </main>
  );
}
