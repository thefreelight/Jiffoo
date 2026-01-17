import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Jiffoo Documentation</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
        Open source e-commerce platform with plugin ecosystem. Build your online store with modern technology.
      </p>
      
      <div className="flex gap-4 mb-12">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Get Started
        </Link>
        <Link
          href="https://github.com/thefreelight/Jiffoo"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          GitHub
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
        <FeatureCard
          title="🛒 Complete E-commerce"
          description="Products, cart, orders, payments - everything you need"
        />
        <FeatureCard
          title="🔌 Plugin System"
          description="Extensible architecture for custom functionality"
        />
        <FeatureCard
          title="🎨 Theme System"
          description="Customizable storefront themes with design tokens"
        />
      </div>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-left">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
