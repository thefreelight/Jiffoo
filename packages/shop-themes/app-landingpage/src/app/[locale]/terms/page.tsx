'use client';
import { useParams } from 'next/navigation';
import { TermsPage as TermsContent } from '../../../components/TermsPage';
import type { Locale } from '../../../types';
export default function TermsPage() { const params = useParams(); const locale = ((params?.locale as string) || 'en') as Locale; return <TermsContent locale={locale} />; }
