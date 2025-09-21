export type Col<T> = { key: keyof T | string; title: string; map?: (row: T) => any };

const toCell = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    const needsQuote = /[",\n;]/.test(s);
    const esc = s.replace(/"/g, '""');
    return needsQuote ? `"${esc}"` : esc;
};

export function exportCSV<T>(filename: string, rows: T[], cols: Col<T>[]) {
    const head = cols.map(c => toCell(c.title)).join(';');
    const body = rows
        .map(r =>
            cols
                .map(c => {
                    const raw = typeof c.map === 'function' ? c.map(r) : (r as any)[c.key as string];
                    return toCell(raw);
                })
                .join(';')
        )
        .join('\n');
    const csv = '\uFEFF' + head + '\n' + body; // BOM
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function exportJSON(filename: string, data: any) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export async function fetchAllPages<T>(firstUrl: string, params?: Record<string, any>) {
    const axios = (await import('axios')).default;
    let url: string | null = firstUrl;
    const all: T[] = [];
    while (url) {
        const { data } = await axios.get(url, { params });
        const page = data?.data ?? [];
        all.push(...page);
        url = data?.next_page_url ?? null;
        if (!Array.isArray(page) || (page.length === 0 && !url)) break;
    }
    return all;
}
