/**
 * TravelPass NotFound Component - SDK Compliant
 */

import type { NotFoundProps } from '../../../../shared/src/types/theme';

const getText = (t: NotFoundProps['t'], key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
};

export function NotFound({ route, message, onGoHome, t }: NotFoundProps) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md px-4">
                <h1 className="text-9xl font-bold text-gray-200">404</h1>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    {getText(t, 'shop.notFound.title', 'Page Not Found')}
                </h2>
                <p className="text-gray-500 mb-8">
                    {message || getText(t, 'shop.notFound.message', `Sorry, we couldn't find the page${route ? ` "${route}"` : ''} you're looking for.`)}
                </p>
                <button onClick={onGoHome} className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md transition">
                    {getText(t, 'shop.notFound.backHome', 'Back to Home')}
                </button>
            </div>
        </div>
    );
}
