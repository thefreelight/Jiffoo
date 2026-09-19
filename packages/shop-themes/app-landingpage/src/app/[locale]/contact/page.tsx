'use client';
import { useParams } from 'next/navigation';
import { ContactPage as ContactContent } from '../../../components/ContactPage';
import type { Locale, CoreLocale  } from '../../../types';
export default function ContactPage() { const params = useParams(); const locale = ((params?.locale as string) || 'en') as CoreLocale; return <ContactContent locale={locale} onSubmitForm={async () => undefined} />; }
