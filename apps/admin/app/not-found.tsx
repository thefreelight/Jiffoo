import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-raised">
            <div className="text-center p-8">
                <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-foreground mb-4">Page Not Found</h2>
                <p className="text-muted-foreground mb-8">Sorry, the page you are looking for does not exist.</p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-foreground text-ground rounded-lg hover:bg-foreground transition-colors"
                >
                    Go back home
                </Link>
            </div>
        </div>
    )
}
