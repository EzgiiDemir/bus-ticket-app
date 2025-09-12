const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

type HeadersInit = Record<string, string>;

export const api = {
    async json<T = any>(res: Response): Promise<T> {
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw err;
        }
        return res.json();
    },

    get: (path: string, token?: string) => {
        const headers: HeadersInit = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(`${BASE}${path}`, { method: "GET", headers });
    },

    post: (path: string, body: any, token?: string) => {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(`${BASE}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
    },

    put: (path: string, body: any, token?: string) => {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(`${BASE}${path}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });
    },

    delete: (path: string, token?: string) => {
        const headers: HeadersInit = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(`${BASE}${path}`, { method: "DELETE", headers });
    },
};
