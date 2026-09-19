'use client';
import { useParams } from 'next/navigation';
import { PrivacyPage as PrivacyContent } from '../../../components/PrivacyPage';
import type { Locale, CoreLocale  } from '../../../types';
export default function PrivacyPage() { const params = useParams(); const locale = ((params?.locale as string) || 'en') as CoreLocale; return <PrivacyContent locale={locale} />; }
