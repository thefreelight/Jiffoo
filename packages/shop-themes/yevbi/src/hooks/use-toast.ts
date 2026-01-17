/**
 * Simplified useToast hook for yevbi theme
 */

export function useToast() {
    return {
        toast: ({ title, description }: { title?: string; description?: string }) => {
            console.log('Toast:', title, description);
        },
        dismiss: () => { },
    };
}
