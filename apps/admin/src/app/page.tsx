import { Button } from '@shop/ui/button';

export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Shop Admin</h1>
      <Button variant="outline">Sign in</Button>
    </main>
  );
}
