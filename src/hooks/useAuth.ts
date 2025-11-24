import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export type AuthUser = {
    id: number;
    full_name: string;
    email: string;
    role: string;
    team_id: number | null;
    avatar_url?: string | null;
};

export function useAuth() {
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Load session from localStorage
    useEffect(() => {
        const token = localStorage.getItem('ett_token');
        const userStr = localStorage.getItem('ett_user');
        if (token && userStr) {
            try {
                const u = JSON.parse(userStr) as AuthUser;
                setAuthToken(token);
                setAuthUser(u);
            } catch {
                localStorage.removeItem('ett_token');
                localStorage.removeItem('ett_user');
            }
        }
        setIsAuthReady(true);
    }, []);

    // Google authentication
    const handleGoogleCredential = async (credential: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: credential }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                alert('Login failed: ' + (err?.error || 'Unknown error'));
                return;
            }

            const data = await res.json();
            setAuthToken(data.token);
            setAuthUser(data.user);
            localStorage.setItem('ett_token', data.token);
            localStorage.setItem('ett_user', JSON.stringify(data.user));
        } catch (e) {
            console.error('Google login error', e);
            alert('Login failed. Check console.');
        }
    };

    // Initialize Google Sign-In
    useEffect(() => {
        if (authUser) return;
        const interval = setInterval(() => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                clearInterval(interval);
                try {
                    window.google.accounts.id.initialize({
                        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                        callback: (response: any) => handleGoogleCredential(response.credential),
                    });
                    window.google.accounts.id.renderButton(
                        document.getElementById('google-signin-button'),
                        { theme: 'outline', size: 'large', width: 320 }
                    );
                } catch (err) {
                    console.error('GSI init error:', err);
                }
            }
        }, 250);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authUser]);

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('ett_token');
        localStorage.removeItem('ett_user');
        setAuthToken(null);
        setAuthUser(null);
    };

    return {
        authUser,
        setAuthUser,
        authToken,
        setAuthToken,
        isAuthReady,
        handleLogout,
    };
}
