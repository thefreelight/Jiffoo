export function FeaturedProducts() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
          <p className="text-muted-foreground">Discover our most popular items</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Product cards will be implemented here */}
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Product 1</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Product 2</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Product 3</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Product 4</span>
          </div>
        </div>
      </div>
    </section>
  );
}
