import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'SIGN IN | ESIM MALL',
    description: 'Access the global connectivity corridor. Secure identity verification required for system entry.',
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
