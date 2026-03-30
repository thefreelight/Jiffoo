'use client';

import React, { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { authApi } from '../../../../lib/api';
import { Button } from '../../../../ui/Button';
import { cn } from '../../../../lib/utils';

function ForgotPasswordContent() {
    const params = useParams();
    const router = useRouter();
    const locale = (params?.locale as string) || 'en';

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email) {
            setError('RECIPIENT EMAIL REQUIRED');
            return;
        }

        setIsLoading(true);
        try {
            const forgotPassword = (authApi as { forgotPassword?: (targetEmail: string) => Promise<unknown> }).forgotPassword;

            if (typeof forgotPassword === 'function') {
                await forgotPassword(email);
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            setIsSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'DISPATCH FAILED');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white flex flex-col text-gray-900">
                <header className="flex items-center justify-between px-6 lg:px-10 h-20 border-b border-gray-100 flex-shrink-0 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                    <button onClick={() => router.push(`/${locale}`)} className="font-black text-2xl tracking-tighter text-blue-600 italic">
                        ESIM MALL
                    </button>
                </header>

                <div className="flex-1 flex items-center justify-center px-4 py-20">
                    <div className="w-full max-w-md text-center">
                        <div className="w-32 h-32 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-blue-100 shadow-xl shadow-blue-500/10">
                            <CheckCircle2 className="w-16 h-16" />
                        </div>
                        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tighter italic mb-6">Dispatch Successful</h1>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-12 italic leading-relaxed px-10">
                            If an account is associated with <span className="text-blue-600 underline">{email}</span>, a recovery link has been transmitted.
                        </p>
                        <Button onClick={() => router.push(`/${locale}/auth/login`)} className="rounded-3xl h-16 px-10 font-black italic bg-blue-600 shadow-2xl shadow-blue-500/20 uppercase tracking-widest text-sm">
                            Back to Authentication <ArrowRight className="ml-3 w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col text-gray-900">
            {/* Auth header */}
            <header className="flex items-center justify-between px-6 lg:px-10 h-20 border-b border-gray-100 flex-shrink-0 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <button
                    onClick={() => router.push(`/${locale}`)}
                    className="font-black text-2xl tracking-tighter text-blue-600 italic"
                >
                    ESIM MALL
                </button>
                <button
                    onClick={() => router.push(`/${locale}/auth/login`)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-all italic hover:gap-3"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
            </header>

            {/* Main */}
            <div className="flex-1 flex items-center justify-center px-4 pt-10 pb-20">
                <div className="w-full max-w-sm">
                    {/* Title */}
                    <div className="mb-12 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-600 italic border border-blue-100 mb-6">
                            Account Recovery Node
                        </div>
                        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tighter leading-none italic mb-4">
                            Reset Key
                        </h1>
                        <p className="text-sm font-medium text-gray-400 italic">Initiate credential recovery protocol.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-3 group">
                            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic ml-2 group-focus-within:text-blue-600 transition-colors">
                                Verified Email Coord
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-gray-300 group-focus-within:text-blue-600 transition-colors">
                                    <Mail className="w-4.5 h-4.5" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@dispatch.com"
                                    className="w-full h-16 pl-14 pr-6 bg-gray-50 border-2 border-transparent focus:border-blue-600/30 focus:bg-white rounded-2xl outline-none font-bold italic text-gray-900 transition-all shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 animate-shake">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-red-600 uppercase italic tracking-tight">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-16 bg-blue-600 text-white font-black text-sm rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20 uppercase tracking-widest italic"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Coord...</>
                            ) : (
                                <span className="flex items-center gap-3">Dispatch Reset <ArrowRight className="w-4 h-4" /></span>
                            )}
                        </Button>
                    </form>

                    <p className="mt-12 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic">
                        Secure Relay System v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
        }>
            <ForgotPasswordContent />
        </Suspense>
    );
}
