/**
 * Simplified auth store for yevbi theme
 * Extended interface to match yevbi component expectations
 */

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    initializeAuth: () => void;
    logout: () => void;
}

export function useAuthStore(): AuthState {
    return {
        user: null,
        isAuthenticated: false,
        initializeAuth: () => { },
        logout: () => { },
    };
}
