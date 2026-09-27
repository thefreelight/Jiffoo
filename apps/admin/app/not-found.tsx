import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-veil">
            <div className="text-center p-8">
                <h1 className="text-6xl font-bold text-neutral-deepest mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-neutral-deep mb-4">Page Not Found</h2>
                <p className="text-neutral-base mb-8">Sorry, the page you are looking for does not exist.</p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-action-strong text-surface rounded-lg hover:bg-action-deep transition-colors"
                >
                    Go back home
                </Link>
            </div>
        </div>
    )
}
