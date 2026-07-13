'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../lib/utils';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-9 h-9 border border-transparent" />
        );
    }

    const themes = [
        { name: 'light', icon: Sun, label: 'Light' },
        { name: 'dark', icon: Moon, label: 'Dark' },
        { name: 'system', icon: Monitor, label: 'System' },
    ] as const;

    return (
        <div className="flex items-center gap-1 border border-border p-1 bg-muted">
            {themes.map((t) => {
                const Icon = t.icon;
                const isActive = theme === t.name;

                return (
                    <button
                        key={t.name}
                        onClick={() => setTheme(t.name)}
                        className={cn(
                            "p-1.5 transition-all hover:bg-background",
                            isActive
                                ? "text-background bg-foreground shadow-sm"
                                : "text-muted-foreground opacity-40 hover:opacity-100"
                        )}
                        title={t.label}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="sr-only">{t.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
