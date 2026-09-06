'use client';
import { useParams } from 'next/navigation';
import { PrivacyPage as PrivacyContent } from '../../../components/PrivacyPage';
import type { Locale } from '../../../types';
export default function PrivacyPage() { const params = useParams(); const locale = ((params?.locale as string) || 'en') as Locale; return <PrivacyContent locale={locale} />; }
