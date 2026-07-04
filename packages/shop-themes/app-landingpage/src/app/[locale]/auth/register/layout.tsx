import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'SIGN UP | ESIM MALL',
    description: 'Join the ESIM MALL community. Securely register to manage your global connectivity assets.',
};

export default function RegisterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
