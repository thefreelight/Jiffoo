import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'INITIALIZE PROFILE | YEVBI',
    description: 'Deploy a new neural identity in the YEVBI ecosystem. Securely register to manage global connectivity assets.',
};

export default function RegisterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
