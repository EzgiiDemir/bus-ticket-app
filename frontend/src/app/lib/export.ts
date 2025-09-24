// frontend/src/app/lib/export.ts
"use client";

/**
 * CSV/JSON dışa aktarma + sayfalı veri çekme yardımcıları (Next/SSR güvenli)
 * - Excel uyumlu CSV (BOM + ; ayırıcı + CRLF)
 * - Dot-path key desteği: "product.trip"
 * - Map fonksiyonu: (row, index) => any
 * - SSR koruması: document/window yoksa no-op/throw
 * - fetchAllPages: Laravel paginate şekillerini normalize eder
 */

export type Col<T> = {
    key: keyof T | string;
    title: string;
    map?: (row: T, index: number) => unknown;
};

type HeadersLoose = Record<string, string | number | boolean | null | undefined>;

const SAFE_NEWLINE = "\r\n";
const DEFAULT_DELIM = ";";

/* ---------------- CSV core ---------------- */

const toCell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Excel/CSV kaçışları
    const needsQuote = /[",\n;]|^\s|\s$/.test(s);
    const esc = s.replace(/"/g, '""');
    return needsQuote ? `"${esc}"` : esc;
};

const getByPath = (obj: any, path: string) => {
    if (!path) return undefined;
    if (path in (obj || {})) return obj[path];
    return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
};

function requireBrowser(feature = "download") {
    if (typeof window === "undefined" || typeof document === "undefined") {
        throw new Error(`Bu işlem yalnızca tarayıcıda çalışır (${feature}).`);
    }
}

/* ---------------- Public API ---------------- */

export function exportCSV<T>(
    filename: string,
    rows: T[],
    cols: Col<T>[],
    opts?: { delimiter?: string; headers?: HeadersLoose }
) {
    requireBrowser("CSV export");
    const delim = opts?.delimiter ?? DEFAULT_DELIM;

    const head = cols.map((c) => toCell(String(c.title))).join(delim);

    const body = rows
        .map((r, i) =>
            cols
                .map((c) => {
                    const raw =
                        typeof c.map === "function" ? c.map(r, i) : getByPath(r as any, String(c.key));
                    return toCell(raw);
                })
                .join(delim)
        )
        .join(SAFE_NEWLINE);

    // UTF-8 BOM + CRLF: Excel uyumluluğu
    const csv = "\uFEFF" + head + SAFE_NEWLINE + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // URL revoke küçük bir gecikmeyle
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

export function exportJSON(filename: string, data: unknown) {
    requireBrowser("JSON export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.toLowerCase().endsWith(".json") ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

/**
 * Laravel paginate eden endpointlerden tüm sayfaları toplar.
 * Farklı şekiller desteklenir:
 *  - { data, next_page_url }
 *  - { orders, next_page_url }
 *  - { meta:{ next_page_url }, links:{ next }, data:[...] }
 */
export async function fetchAllPages<T>(
    firstUrl: string,
    params?: Record<string, any>,
    opt?: { token?: string; maxPages?: number }
): Promise<T[]> {
    const axiosMod: typeof import("axios") = await import("axios");
    const axios = axiosMod.default;

    const all: T[] = [];

    let url: string | null =
        params && Object.keys(params).length
            ? `${firstUrl}${firstUrl.includes("?") ? "&" : "?"}${new URLSearchParams(
                Object.entries(params).filter(([, v]) => v !== "" && v != null) as [string, string][]
            ).toString()}`
            : firstUrl;

    const maxPages = Math.max(1, opt?.maxPages ?? 200);

    for (let i = 0; i < maxPages && url; i++) {
        const res: import("axios").AxiosResponse<any> = await axios.get(url, {
            headers: opt?.token ? { Authorization: `Bearer ${opt.token}` } : undefined,
            withCredentials: !/^\/?public(\/|$)/.test(firstUrl),
        });

        const data: any = res?.data ?? {};
        const rows: T[] = Array.isArray(data?.data)
            ? (data.data as T[])
            : Array.isArray(data?.orders)
                ? (data.orders as T[])
                : Array.isArray(data)
                    ? (data as T[])
                    : [];

        all.push(...rows);

        const nextLinkFromLinks: string | null =
            typeof data?.links?.next === "string" ? (data.links.next as string) : null;

        const nextLink: string | null =
            (data?.next_page_url as string | null | undefined) ??
            (data?.meta?.next_page_url as string | null | undefined) ??
            nextLinkFromLinks ??
            null;

        url = nextLink;

        if ((!rows || rows.length === 0) && !url) break;
    }

    return all;
}

