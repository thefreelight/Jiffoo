import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Reset Password | YEVBI',
    description: 'Reset your YEVBI account password.',
};

export default function ForgotPasswordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
