'use client';
import { useParams, useRouter } from 'next/navigation';
import { HelpPage as HelpContent } from '../../../components/HelpPage';
import type { Locale } from '../../../types';
export default function HelpPage() { const params = useParams(); const router = useRouter(); const locale = ((params?.locale as string) || 'en') as Locale; return <HelpContent locale={locale} onNavigateToContact={() => router.push(`/${locale}/contact`)} />; }
