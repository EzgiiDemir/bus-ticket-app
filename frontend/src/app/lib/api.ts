// frontend/src/app/lib/api.ts
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const BASE = `${API_ORIGIN}`;

type HeadersInit = Record<string, string>;

async function parse<T = any>(res: Response): Promise<T> {
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
        if (ct.includes("application/json")) throw await res.json();
        const text = await res.text().catch(() => "");
        throw { message: text || `HTTP ${res.status}` };
    }
    if (ct.includes("application/json")) return res.json();
    const text = await res.text().catch(() => "");
    // @ts-ignore
    return text as T;
}

async function request<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: any,
    token?: string
): Promise<T> {
    const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: HeadersInit = { Accept: "application/json" };
    const init: RequestInit = { method, headers };

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        init.credentials = "same-origin";
    } else {
        init.credentials = "include"; // cookie/Sanctum desteği
    }

    const res = await fetch(url, init);
    return parse<T>(res);
}

export const api = {
    json: parse,
    get: <T = any>(path: string, token?: string) => request<T>("GET", path, undefined, token),
    post: <T = any>(path: string, body: any, token?: string) => request<T>("POST", path, body, token),
    put:  <T = any>(path: string, body: any, token?: string) => request<T>("PUT", path, body, token),
    delete: <T = any>(path: string, token?: string) => request<T>("DELETE", path, undefined, token),
    csrf: () => fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, { credentials: "include" }),
};
