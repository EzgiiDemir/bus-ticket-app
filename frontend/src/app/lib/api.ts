// frontend/src/app/lib/api.ts
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export const BASE = `${API_ORIGIN}`;

type HeadersInit = Record<string, string>;
type Opt = { token?: string; params?: Record<string, any>; public?: boolean; headers?: HeadersInit; };

const qs = (p?: Record<string, any>)=>{
    if(!p) return "";
    const s = new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v!==''&&v!=null))).toString();
    return s?`?${s}`:"";
};

export async function parse<T=any>(res: Response): Promise<T>{
    const ct = res?.headers?.get?.('content-type') || '';
    if(!res?.ok){
        if(ct.includes('application/json')) throw await res.json();
        const t = await res.text().catch(()=> '');
        throw { message: t || `HTTP ${res?.status}` };
    }
    if(ct.includes('application/json')) return res.json();
    // @ts-ignore
    return (await res.text()) as T;
}

const norm = (x?: string|Opt): Opt => typeof x==='string'? {token:x} : (x||{});

async function request(method: 'GET'|'POST'|'PUT'|'DELETE', path: string, body?: any, x?: string|Opt){
    const opt = norm(x);
    const url = `${BASE}${path.startsWith('/')?path:`/${path}`}${qs(opt.params)}`;
    const headers: HeadersInit = { Accept: 'application/json', ...(opt.headers||{}) };
    const init: RequestInit = { method, headers };

    if(body!==undefined){
        headers['Content-Type']='application/json';
        init.body = typeof body==='string'? body : JSON.stringify(body);
    }

    const isPublic = opt.public ?? /(^|\/)public(\/|$)/.test(path);
    if(opt.token) headers['Authorization'] = `Bearer ${opt.token}`;

    // PROXY sayesinde origin aynı; yine de cookie gerekecekse include.
    init.credentials = isPublic ? 'omit' : 'include';

    return fetch(url, init);
}

export const api = {
    json: parse,
    get:    (p: string, o?: string|Opt)=> request('GET', p, undefined, o),
    post:   (p: string, b:any, o?: string|Opt)=> request('POST', p, b, o),
    put:    (p: string, b:any, o?: string|Opt)=> request('PUT', p, b, o),
    delete: (p: string, o?: string|Opt)=> request('DELETE', p, undefined, o),
    csrf:   () => fetch(`/api/sanctum/csrf-cookie`, { credentials: 'include' }),
};
