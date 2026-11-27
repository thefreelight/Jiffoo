import Link from 'next/link'
import { NotFoundLine } from '@/components/not-found-line'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8">
                <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-gray-700 mb-4"><NotFoundLine k="common.notFound.pageNotFound" fallback="Page Not Found" /></h2>
                <p className="text-gray-500 mb-8"><NotFoundLine k="common.notFound.sorryThePageYouAreLooking" fallback="Sorry, the page you are looking for does not exist." /></p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <NotFoundLine k="common.notFound.goBackHome" fallback="Go back home" />
                </Link>
            </div>
        </div>
    )
}
