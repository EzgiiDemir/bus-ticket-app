// app/dashboard/ik/.../Trips.tsx  (Seferler)
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------------- Types ---------------- */
type Trip = {
    id:number;
    company_id?: number;
    trip?: string;
    company_name?: string;
    terminal_from:string;
    terminal_to:string;
    departure_time:string;
    cost:number|string;
    capacity_reservation:number|string;
    is_active:number|boolean;
    note?:string;
    duration?:string;
    bus_type?:'2+1'|'2+2'|string;
    route?: { name:string; time?:string }[];
    important_notes?: string|null;
    cancellation_policy?: string|null;
    created_at?:string;
};
type Company = { id:number; name:string; code:string };
type Terminal = { id:number; name:string; city:string; code:string };
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

const toNum = (v:any)=> Number((typeof v==='string' ? v.replace(',','.') : v) || 0);
const clamp = (n:number, min:number, max:number)=> Math.max(min, Math.min(max, n));
const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));

export default function Trips(){
    const { token, isLoading } = (myAppHook() as any) || {};

    /* --------- Axios taban ayarı + yetkili kısayollar --------- */
    useEffect(()=>{
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
    },[]);
    const withAuthHeaders = (cfg?:AxiosRequestConfig):AxiosRequestConfig => {
        const headers:any = { Accept:'application/json', ...(cfg?.headers||{}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        return { ...cfg, headers };
    };
    const GET = useCallback(async <T=any,>(path:string, cfg?:AxiosRequestConfig)=> {
        const { data } = await axios.get<T>(path, withAuthHeaders(cfg));
        return data;
    },[token]);
    const POST = useCallback(async <T=any,>(path:string, body:any, cfg?:AxiosRequestConfig)=> {
        const { data } = await axios.post<T>(path, body, withAuthHeaders(cfg));
        return data;
    },[token]);
    const PUT = useCallback(async <T=any,>(path:string, body:any, cfg?:AxiosRequestConfig)=> {
        const { data } = await axios.put<T>(path, body, withAuthHeaders(cfg));
        return data;
    },[token]);
    const DEL = useCallback(async (path:string, cfg?:AxiosRequestConfig)=> {
        await axios.delete(path, withAuthHeaders(cfg));
    },[token]);

    /* --------- State --------- */
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [open,setOpen]=useState(false);
    const [edit,setEdit]=useState<Trip|null>(null);
    const [myCompany, setMyCompany] = useState<Company|null>(null);
    const [err,setErr] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Kalkışa 60dk kala aktif seferleri otomatik pasife çekmek için zaman nabzı
    const [now, setNow] = useState<number>(Date.now());
    useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()), 30000); return ()=>clearInterval(t); },[]);

    /* --------- Yükleme --------- */
    const load = useCallback(async ()=>{
        if(!token) return;
        setErr('');
        try{
            const data:any = await GET('/products');
            const arr:Trip[] = Array.isArray(data?.products) ? data.products : (data?.data||[]);
            setRows(Array.isArray(arr) ? arr : []);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Seferler alınamadı.');
            setRows([]);
        }
    },[token, GET]);

    useEffect(()=>{
        if (isLoading || !token) return;
        (async ()=>{
            try{
                const data:any = await GET('/personnel/company');
                setMyCompany(data || null);
            }catch{ setMyCompany(null); }
            await load();
        })();
    },[isLoading, token, load, GET]);

    /* --------- Zaman yardımcıları --------- */
    const minutesLeft = (dt:string)=>{
        const s = dt?.includes?.('T')? dt : String(dt||'').replace(' ','T');
        return Math.floor((new Date(s).getTime() - now)/60000);
    };

    /* --------- Kalkışa ≤60dk kalanları tek sefer pasif et --------- */
    const closedOnce = useRef<Set<number>>(new Set());
    useEffect(()=>{
        if (isLoading || !token || !rows.length) return;
        const targets = rows.filter(r => (r.is_active===1 || r.is_active===true) && minutesLeft(r.departure_time) <= 60);
        const toCall = targets.filter(t => !closedOnce.current.has(t.id));
        if (!toCall.length) return;
        (async ()=>{
            try{
                await Promise.all(
                    toCall.map(t=>{
                        closedOnce.current.add(t.id);
                        return PUT(`/products/${t.id}`, { is_active:false }).catch(()=>{});
                    })
                );
                await load();
            }catch{}
        })();
    },[rows, now, isLoading, token, load, PUT]);

    /* --------- Filtre + sayfalama --------- */
    const filtered = useMemo(()=>{
        const ql = q.trim().toLowerCase();
        let base = rows;
        if (myCompany) base = base.filter(r => r.company_name === myCompany.name || r.company_id === myCompany.id);
        return ql ? base.filter(r => JSON.stringify(r).toLowerCase().includes(ql)) : base;
    },[rows,q,myCompany]);

    const closingSoon = useMemo(()=> filtered.filter(r=>{
        const m = minutesLeft(r.departure_time);
        return m>0 && m<=60;
    }),[filtered, now]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / clamp(pageSize,5,100)));
    useEffect(()=>{ if(page > totalPages) setPage(totalPages); },[totalPages, page]);
    const paged = useMemo(()=>{
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered, page, pageSize]);

    const DisableBadge = ({m}:{m:number})=>{
        if(m<=0) return <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200">Kapandı</span>;
        if(m<=60) return <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">Son {m} dk</span>;
        return null;
    };

    /* ================= CSV alt yapı: Sunucu → İstemci fallback ================= */
    // 1) CSV kaçış + BOM + ; ayırıcı (Excel/TR uyumlu)
    const csvEscape = (v:any) => {
        const s = v==null ? '' : String(v);
        return /[\";\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const buildCsv = (headings:string[], rows:(string|number)[][]) => {
        const bom = '\uFEFF';
        const head = headings.length ? headings.map(csvEscape).join(';') + '\n' : '';
        const body = rows.map(r=>r.map(csvEscape).join(';')).join('\n');
        return bom + head + body + (body ? '\n' : '');
    };
    const download = (filename:string, text:string) => {
        const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    };

    // 2) Sunucu varsa oraya post et; yoksa buildCsv ile indir
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][]) => {
        try{
            const res = await fetch('/company/export/array', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
                body: JSON.stringify({ filename, headings, rows })
            });
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
        }catch{
            const text = buildCsv(headings, rows);
            download(filename, text);
        }
    };

    // 3) Trips özel CSV dönüştürücüleri
    const tripRowToCells = (r:Trip):(string|number)[] => ([
        r.id,
        r.trip || `${r.terminal_from} - ${r.terminal_to}`,
        r.company_name || '',
        r.terminal_from,
        r.terminal_to,
        fmtTR(r.departure_time),
        typeof r.cost==='number' ? r.cost : Number(r.cost||0),
        r.capacity_reservation,
        r.duration || '',
        r.bus_type || '',
        (r.route?.length ?? 0),
        r.is_active ? 'Evet' : 'Hayır'
    ]);
    const tripHeadings = ['ID','Sefer','Firma','Kalkış','Varış','Kalkış Zamanı','Ücret','Kapasite','Süre','Otobüs','Durak Sayısı','Aktif'];

    // Ekrandaki sayfa CSV
    const exportPageCsv = ()=> saveCsv(
        `seferler_sayfa_${page}.csv`,
        tripHeadings,
        paged.map(tripRowToCells)
    );

    // Filtrelenmiş tüm kayıtlar CSV
    const exportAllCsv = ()=> saveCsv(
        `seferler_filtrelenmis_tumu.csv`,
        tripHeadings,
        filtered.map(tripRowToCells)
    );

    // Tek satır CSV (satır yanındaki buton)
    const exportOneCsv = (r:Trip)=> saveCsv(
        `sefer_${r.id}.csv`,
        tripHeadings,
        [tripRowToCells(r)]
    );

    /* ---------------- UI ---------------- */
    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    return (
        <div className="space-y-4 text-indigo-900/80">
            {/* Hata kutusu */}
            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            {/* Son 1 saat uyarısı */}
            {closingSoon.length>0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
                    <div className="font-semibold text-amber-900">Son 1 saate kalan {closingSoon.length} sefer var.</div>
                    <ul className="mt-1 text-sm text-amber-900/90 list-disc ml-5">
                        {closingSoon.slice(0,5).map(r=>{
                            const m = minutesLeft(r.departure_time);
                            return <li key={r.id}>{r.trip || `${r.terminal_from} → ${r.terminal_to}`} • {fmtTR(r.departure_time)} • {m} dk kaldı</li>;
                        })}
                    </ul>
                </div>
            )}

            {/* Başlık + Arama + CSV + Yeni */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <div className="flex items-center gap-2">
                    <input
                        className="rounded-xl border px-3 py-2"
                        placeholder="Ara (sefer, firma, güzergâh)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                        aria-label="Sefer ara"
                    />
                    <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                        <button className="px-3 py-1 rounded-lg border" onClick={exportAllCsv}>Tümü CSV</button>
                        <button onClick={()=>{setEdit(null);setOpen(true);}} className="rounded-xl bg-indigo-600 text-white px-4 py-2">Yeni Sefer</button>
                    </div>
                </div>
            </div>

            {/* Desktop tablo */}
            <div className="hidden md:block rounded-2xl border bg-white p-4">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">ID</th>
                        <th className="py-2">Sefer</th>
                        <th>Firma</th>
                        <th>Güzergâh</th>
                        <th>Kalkış</th>
                        <th>Ücret</th>
                        <th>Kapasite</th>
                        <th>Süre</th>
                        <th>Otobüs</th>
                        <th>Durak</th>
                        <th>Aktif</th>
                        <th className="text-right">İşlem</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paged.map(r=>{
                        const m = minutesLeft(r.departure_time);
                        const rowDim = (m<=60) ? 'opacity-70' : '';
                        return (
                            <tr key={r.id} className={`border-t ${rowDim}`}>
                                <td className="py-2">{r.id}</td>
                                <td className="py-2 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</span>
                                        <DisableBadge m={m}/>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap">{r.company_name || '-'}</td>
                                <td className="truncate max-w-[260px]">{r.terminal_from} → {r.terminal_to}</td>
                                <td className="whitespace-nowrap">{fmtTR(r.departure_time)}</td>
                                <td className="whitespace-nowrap">{fmtTL(r.cost)}</td>
                                <td>{r.capacity_reservation}</td>
                                <td className="whitespace-nowrap">{r.duration || '-'}</td>
                                <td className="whitespace-nowrap">{r.bus_type || '-'}</td>
                                <td>{r.route?.length ?? 0}</td>
                                <td>{(r.is_active ? 'Evet' : 'Hayır')}</td>
                                <td className="text-right whitespace-nowrap">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            className="px-2 py-1 rounded-lg border mr-0 disabled:opacity-50"
                                            disabled={m<=60}
                                            title={m<=60 ? 'Kalkışa ≤60 dk. Düzenleme pasif' : 'Düzenle'}
                                            onClick={()=>{setEdit(r);setOpen(true);}}
                                        >Düzenle</button>
                                        <button
                                            className="px-2 py-1 rounded-lg border"
                                            title="Bu satırı CSV olarak indir"
                                            onClick={()=>exportOneCsv(r)}
                                        >CSV</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {paged.length===0 && (
                        <tr><td colSpan={12} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Mobile kartlar */}
            <div className="md:hidden space-y-3">
                {paged.map(r=>{
                    const m = minutesLeft(r.departure_time);
                    const rowDim = (m<=60) ? 'opacity-75' : '';
                    return (
                        <div key={r.id} className={`rounded-2xl border bg-white p-4 ${rowDim}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</div>
                                <div className="flex items-center gap-2">
                                    <DisableBadge m={m}/><span className="text-xs px-2 py-1 rounded-lg border">{r.is_active?'Aktif':'Pasif'}</span>
                                </div>
                            </div>
                            <div className="mt-1 text-xs text-indigo-900/60">ID: {r.id}</div>
                            <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Firma</div><div>{r.company_name || '-'}</div>
                                <div className="text-indigo-900/60">Güzergâh</div><div className="truncate">{r.terminal_from} → {r.terminal_to}</div>
                                <div className="text-indigo-900/60">Kalkış</div><div>{fmtTR(r.departure_time)}</div>
                                <div className="text-indigo-900/60">Ücret</div><div>{fmtTL(r.cost)}</div>
                                <div className="text-indigo-900/60">Kapasite</div><div>{r.capacity_reservation}</div>
                                <div className="text-indigo-900/60">Süre</div><div>{r.duration || '-'}</div>
                                <div className="text-indigo-900/60">Otobüs</div><div>{r.bus_type || '-'}</div>
                                <div className="text-indigo-900/60">Durak</div><div>{r.route?.length ?? 0}</div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                                <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                        disabled={m<=60}
                                        title={m<=60 ? 'Kalkışa ≤60 dk. Düzenleme pasif' : 'Düzenle'}
                                        onClick={()=>{setEdit(r);setOpen(true);}}>Düzenle</button>
                                <button className="px-3 py-1 rounded-lg border" onClick={()=>exportOneCsv(r)}>Satır CSV</button>
                                <button className="px-3 py-1 rounded-lg border"
                                        onClick={async()=>{
                                            if(!token || isLoading) return alert('Giriş yapın');
                                            if(confirm('Silinsin mi?')){
                                                try{ await DEL(`/products/${r.id}`); await load(); }
                                                catch(e:any){ alert(e?.response?.data?.message || 'Silme hatası'); }
                                            }
                                        }}>Sil</button>
                            </div>
                        </div>
                    );
                })}
                {paged.length===0 && (
                    <div className="rounded-2xl border bg-white p-6 text-center text-indigo-900/50">Kayıt yok</div>
                )}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-indigo-900/60">Toplam <b>{total}</b> kayıt • Sayfa {page}/{totalPages}</div>
                <div className="flex items-center gap-2">
                    <select
                        className="rounded-xl border px-2 py-1"
                        value={pageSize}
                        onChange={e=>{ setPageSize(clamp(Number(e.target.value),5,100)); setPage(1); }}
                        aria-label="Sayfa başına"
                    >
                        {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                disabled={page<=1}
                                onClick={()=>setPage(p=>Math.max(1,p-1))}
                                aria-label="Önceki">Önceki</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                disabled={page>=totalPages}
                                onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                                aria-label="Sonraki">Sonraki</button>
                    </div>
                </div>
            </div>

            {/* Modallar */}
            {open && (
                <TripModal
                    initial={edit}
                    onClose={()=>setOpen(false)}
                    onSaved={async()=>{ setOpen(false); setEdit(null); await load(); }}
                />
            )}
            {/* Düzenleme modundayken koltuk arıza/kapalı paneli */}
            {edit && <SeatOverridesPanel productId={edit.id} />}
        </div>
    );
}

/* ---------------- Modal ---------------- */
function TripModal({onClose,onSaved,initial}:{onClose:()=>void; onSaved:()=>void; initial:Trip|null}){
    const { token, isLoading } = (myAppHook() as any) || {};

    const [terminals,setTerminals]=useState<Terminal[]>([]);
    const [loadingLookups,setLoadingLookups]=useState(true);
    const [err,setErr]=useState('');

    const [form,setForm]=useState<Partial<Trip>>(initial ?? {
        is_active:1, capacity_reservation:0, route:[], bus_type:'2+1'
    });

    // Terminal listesi + ilk değerlerin kurulumu
    useEffect(()=>{
        let mounted=true;
        (async()=>{
            try{
                const tRes = await axios.get('/public/terminals', { withCredentials:false, headers:{ Accept:'application/json' } });
                const term = Array.isArray(tRes.data) ? tRes.data as Terminal[] : (tRes.data?.terminals || []);
                if(!mounted) return;
                setTerminals(term);
                if(!initial){
                    const from = term[0]?.name || '';
                    const to   = term.find((x: { name: any; })=>x.name!==from)?.name || '';
                    setForm(s=>({
                        ...s,
                        terminal_from: s.terminal_from || from,
                        terminal_to:   s.terminal_to   || to
                    }));
                }
            } finally { if(mounted) setLoadingLookups(false); }
        })();
        return ()=>{ mounted=false; };
    },[initial]);

    // Form değişim kısayolu + sefer adı otomatik üret
    const change=(k:keyof Trip, v:any)=>{
        setForm(s=>{
            const next:any = { ...s, [k]:v };
            if((!next.trip || String(next.trip).trim()==='') && next.terminal_from && next.terminal_to){
                next.trip = `${next.terminal_from} - ${next.terminal_to}`;
            }
            return next;
        });
    };

    // Durak CRUD
    const addStop=()=> setForm(s=>({...s, route:[...(s.route||[]), {name:'', time:''}]}));
    const setStop=(i:number, k:'name'|'time', v:string)=> setForm(s=>{
        const r=[...(s.route||[])]; r[i]={...r[i], [k]:v}; return {...s, route:r};
    });
    const delStop=(i:number)=> setForm(s=>{
        const r=[...(s.route||[])]; r.splice(i,1); return {...s, route:r};
    });

    // Kalkış/varış swap
    const swapFromTo=()=> setForm(s=>{
        const from = s.terminal_from; const to = s.terminal_to;
        const trip = (to && from) ? `${to} - ${from}` : s.trip;
        return { ...s, terminal_from: to, terminal_to: from, trip };
    });

    // Basit doğrulama
    const validate = ()=>{
        const errors:string[] = [];
        const from = String(form.terminal_from||'').trim();
        const to   = String(form.terminal_to||'').trim();
        const dep  = String(form.departure_time||'').trim();
        if(!from) errors.push('Kalkış zorunlu.');
        if(!to) errors.push('Varış zorunlu.');
        if(from && to && from===to) errors.push('Kalkış ve varış aynı olamaz.');
        if(!dep) errors.push('Kalkış zamanı zorunlu.');
        const mLeft = dep ? Math.floor((new Date(dep.includes('T')?dep:dep.replace(' ','T')).getTime()-Date.now())/60000) : 0;
        if(dep && mLeft < 0) errors.push('Kalkış geçmişte olamaz.');
        const cost = toNum(form.cost);
        if(!(cost>=0)) errors.push('Ücret 0 veya daha büyük olmalı.');
        const cap = Math.trunc(toNum(form.capacity_reservation));
        if(!(cap>=0)) errors.push('Kapasite 0 veya daha büyük olmalı.');
        return { ok: errors.length===0, msg: errors.join('\n') };
    };

    /* ---- Durak zamanı normalize: "50dk", "2s 10dk" veya "19:45" gibi değerleri tek tipe çevir ---- */
    const normalizeStopTime = (raw: string) => {
        const t = String(raw || "").trim().toLowerCase();
        if (!t) return "";
        const hm = t.match(/^(\d{1,2}):(\d{2})$/);
        if (hm) return `${hm[1].padStart(2,"0")}:${hm[2]}`;
        let mins = 0;
        const h = t.match(/(\d+)\s*(s|sa|saat)/);
        if (h) mins += parseInt(h[1], 10) * 60;
        const m = t.match(/(\d+)\s*(dk|dak|dakika)?/);
        if (m) mins += parseInt(m[1], 10);
        if (mins > 0) return `${mins}dk`;
        const n = parseInt(t, 10);
        return Number.isFinite(n) && n > 0 ? `${n}dk` : t;
    };

    const buildRoutePayload = (route?: { name?: string; time?: string }[]) => {
        const r = (route || [])
            .map(s => ({
                stop: String(s?.name || "").trim(),
                time: normalizeStopTime(String(s?.time || "")),
            }))
            .filter(s => s.stop.length > 0);
        return r.length ? r : undefined;
    };

    // Kaydet
    const save=async()=>{
        if (isLoading || !token) { alert('Önce giriş yapın'); return; }
        const v = validate();
        if(!v.ok){ alert(v.msg); return; }

        const base:any = {
            trip: (form.trip || `${form.terminal_from} - ${form.terminal_to}`),
            company_name: form.company_name || undefined,
            terminal_from: form.terminal_from,
            terminal_to: form.terminal_to,
            departure_time: form.departure_time,
            cost: toNum(form.cost),
            capacity_reservation: Math.trunc(toNum(form.capacity_reservation)),
            is_active: !!form.is_active,
            note: form.note || null,
            duration: form.duration || null,
            bus_type: form.bus_type || null,
            cancellation_policy: form.cancellation_policy || null,
            important_notes: form.important_notes || null,
        };

        const routePayload = buildRoutePayload(form.route);
        if (routePayload) base.route = routePayload;

        try{
            setErr('');
            if(initial) await axios.put(`/products/${initial.id}`, base, );
            else        await axios.post('/products', base, );
            onSaved();
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Kayıt hatası.');
        }
    };

    if(loadingLookups){
        return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                <div className="rounded-2xl bg-white px-6 py-4">Yükleniyor…</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">{initial? 'Seferi Düzenle':'Yeni Sefer'}</h2>
                    <button onClick={onClose} className="px-2 py-1 rounded-lg border">Kapat</button>
                </div>

                {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

                <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Sefer Adı" value={String(form.trip||'')} onChange={v=>change('trip',v)} />

                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Kalkış Terminal</label>
                        <TerminalSelect terminals={terminals} value={String(form.terminal_from||'')} onChange={v=>change('terminal_from', v)} />
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-indigo-900 mb-1">Varış Terminal</label>
                            <button type="button" className="text-xs underline" onClick={swapFromTo}>Kalkış ↔ Varış</button>
                        </div>
                        <TerminalSelect terminals={terminals} value={String(form.terminal_to||'')} onChange={v=>change('terminal_to', v)} />
                    </div>

                    <Input label="Kalkış Zamanı" type="datetime-local" value={String(form.departure_time||'')} onChange={v=>change('departure_time',v)}/>
                    <Input label="Ücret (₺)" type="number" value={String(form.cost??'')} onChange={v=>change('cost',v)}/>

                    <Input label="Kapasite" type="number" value={String(form.capacity_reservation??'')} onChange={v=>change('capacity_reservation',v)}/>
                    <Input label="Süre (örn: 6s 15dk)" value={String(form.duration||'')} onChange={v=>change('duration',v)} />

                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Otobüs Düzeni</label>
                        <select className="w-full rounded-xl border px-3 py-2"
                                value={String(form.bus_type||'2+1')}
                                onChange={e=>change('bus_type', e.target.value)}>
                            <option value="2+1">2+1</option>
                            <option value="2+2">2+2</option>
                            <option value="">Diğer</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Aktif</label>
                        <select className="w-full rounded-xl border px-3 py-2"
                                value={form.is_active?1:0}
                                onChange={e=>change('is_active', Number(e.target.value))}>
                            <option value={1}>Evet</option>
                            <option value={0}>Hayır</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Önemli Notlar</label>
                        <textarea className="w-full rounded-xl border px-3 py-2" rows={2}
                                  value={String(form.important_notes||'')}
                                  onChange={e=>change('important_notes', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">İptal/İade Koşulları</label>
                        <textarea className="w-full rounded-xl border px-3 py-2" rows={2}
                                  value={String(form.cancellation_policy||'')}
                                  onChange={e=>change('cancellation_policy', e.target.value)} />
                    </div>

                    <RouteStops form={form} setStop={setStop} addStop={addStop} delStop={delStop} terminals={terminals} />

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Not</label>
                        <textarea className="w-full rounded-xl border px-3 py-2" rows={2}
                                  value={String(form.note||'')}
                                  onChange={e=>change('note',e.target.value)} />
                    </div>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border">Vazgeç</button>
                    <button onClick={save} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Kaydet</button>
                </div>
            </div>
        </div>
    );
}

/* ---------------- UI bits ---------------- */
function TerminalSelect({terminals, value, onChange}:{terminals:Terminal[]; value:string; onChange:(v:string)=>void}){
    return (
        <select className="w-full rounded-xl border px-3 py-2"
                value={value}
                onChange={e=>onChange(e.target.value)}>
            <option value="">Seçin</option>
            {terminals.map(t=> <option key={t.id} value={t.name}>{t.city} — {t.name}</option>)}
        </select>
    );
}

function RouteStops({
                        form,setStop,addStop,delStop,terminals
                    }:{ form:Partial<Trip>;
    setStop:(i:number,k:'name'|'time',v:string)=>void;
    addStop:()=>void;
    delStop:(i:number)=>void;
    terminals:Terminal[];
}){
    return (
        <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-indigo-900">Güzergâh Durakları</label>
                <button type="button" onClick={addStop} className="px-2 py-1 rounded-lg border">Durak Ekle</button>
            </div>
            <div className="space-y-2">
                {(form.route||[]).map((s, i)=>(
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2">
                        <select className="rounded-xl border px-3 py-2"
                                value={s.name||''}
                                onChange={e=>setStop(i,'name',e.target.value)}>
                            <option value="">Durak seçin</option>
                            {terminals.map(t=> <option key={t.id} value={t.name}>{t.city} — {t.name}</option>)}
                        </select>
                        <input className="rounded-xl border px-3 py-2"
                               placeholder="Süre/varış (örn 50dk veya 19:45)"
                               value={s.time||''}
                               onChange={e=>setStop(i,'time',e.target.value)} />
                        <button type="button" className="px-2 py-2 rounded-lg border" onClick={()=>delStop(i)}>Sil</button>
                    </div>
                ))}
                {(form.route||[]).length===0 && (
                    <div className="text-sm text-indigo-900/60">Henüz durak eklenmedi.</div>
                )}
            </div>
            <div className="mt-2 text-xs text-indigo-900/60">
                İpucu: Kalkış/varış terminallerini duraklara tekrar ekleme. Orta durakları seç.
            </div>
        </div>
    );
}

function SeatOverridesPanel({productId}:{productId:number}) {
    const [items,setItems] = useState<{id:number;seat_code:string;type:'fault'|'blocked';label:string;reason?:string|null}[]>([]);
    const [form,setForm] = useState<{seat_code:string;type:'fault'|'blocked';label:string;reason:string}>({
        seat_code:'', type:'fault', label:'Arıza', reason:''
    });
    const [err,setErr] = useState('');

    const load = useCallback(async ()=>{
        try{
            const { data } = await axios.get(`/personnel/products/${productId}/seat-overrides`, { headers:{ Accept:'application/json' } });
            setItems(Array.isArray(data)? data: []);
        } catch { setItems([]); }
    },[productId]);

    useEffect(()=>{ load(); },[load]);

    const save = async ()=>{
        setErr('');
        const sc = form.seat_code.trim().toUpperCase();
        if(!/^\d{1,2}[A-D]$/.test(sc)) { setErr('Koltuk kodu örn: 1A, 10C'); return; }
        try{
            await axios.post(`/personnel/products/${productId}/seat-overrides`, form, { headers:{ Accept:'application/json' } });
            setForm({seat_code:'',type:'fault',label: form.type==='fault'?'Arıza':'Kapalı',reason:''});
            await load();
        }catch(e:any){
            setErr(e?.response?.data?.message || 'Kayıt hatası');
        }
    };

    const delItem = async (id:number)=>{
        if(!confirm('Kaldırılsın mı?')) return;
        try{
            await axios.delete(`/personnel/products/${productId}/seat-overrides/${id}`, { headers:{ Accept:'application/json' } });
            await load();
        }catch{}
    };

    return (
        <section className="md:col-span-2 rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Koltuk Durumları</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[120px_140px_1fr_auto] gap-2">
                <input className="rounded-xl border px-3 py-2" placeholder="Koltuk (örn 1A)" value={form.seat_code}
                       onChange={e=>setForm(s=>({...s, seat_code:e.target.value}))}/>
                <select className="rounded-xl border px-3 py-2" value={form.type}
                        onChange={e=>{
                            const t = e.target.value as 'fault'|'blocked';
                            setForm(s=>({...s, type:t, label: t==='fault'?'Arıza':'Kapalı'}));
                        }}>
                    <option value="fault">Arıza</option>
                    <option value="blocked">Kapalı</option>
                </select>
                <input className="rounded-xl border px-3 py-2" placeholder="Etiket (opsiyonel)" value={form.label}
                       onChange={e=>setForm(s=>({...s, label:e.target.value}))}/>
                <button className="rounded-xl border px-3 py-2" onClick={save}>Ekle/Güncelle</button>
            </div>
            <input className="mt-2 w-full rounded-xl border px-3 py-2" placeholder="Açıklama (opsiyonel)"
                   value={form.reason} onChange={e=>setForm(s=>({...s, reason:e.target.value}))}/>

            {err && <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</div>}

            <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th>Koltuk</th><th>Tür</th><th>Etiket</th><th>Açıklama</th><th></th></tr></thead>
                    <tbody>
                    {items.map(it=>(
                        <tr key={it.id} className="border-t">
                            <td className="py-1 font-medium">{it.seat_code}</td>
                            <td>{it.type==='fault'?'Arıza':'Kapalı'}</td>
                            <td>{it.label}</td>
                            <td className="truncate max-w-[360px]">{it.reason||'-'}</td>
                            <td className="text-right">
                                <button className="px-2 py-1 rounded-lg border" onClick={()=>delItem(it.id)}>Sil</button>
                            </td>
                        </tr>
                    ))}
                    {items.length===0 && <tr><td colSpan={5} className="py-3 text-indigo-900/60">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){
    return (
        <div>
            <label className="block text-sm font-medium text-indigo-900 mb-1">{label}</label>
            <input type={type} value={value} onChange={e=>onChange(e.target.value)}
                   className="w-full rounded-xl border px-3 py-2"/>
        </div>
    );
}
