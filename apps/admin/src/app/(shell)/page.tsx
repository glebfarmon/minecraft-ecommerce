import {requireMe} from '@/lib/session'

export default async function HomePage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome, {me.name || me.email}</h1>
      <p className="text-muted-foreground">
        The dashboard arrives with deliveries (sub-project 5).
      </p>
    </section>
  )
}
