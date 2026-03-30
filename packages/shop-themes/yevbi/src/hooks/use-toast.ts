/**
 * Simplified useToast hook for yevbi theme
 */

export function useToast() {
    return {
        toast: ({ title, description }: { title?: string; description?: string }) => {
            // Toast implementation - in production this would show a UI toast
            // For now, this is a no-op that can be connected to a toast library
            void title;
            void description;
        },
        dismiss: () => { },
    };
}
