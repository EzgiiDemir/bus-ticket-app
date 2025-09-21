'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';
import { exportCSV } from '@/app/lib/export';

type Trip = {
    id:number;
    trip?: string;
    company_name?: string;
    terminal_from:string;
    terminal_to:string;
    departure_time:string;
    cost:number;
    capacity_reservation:number;
    is_active:number|boolean;
    note?:string;
    duration?:string;
    bus_type?:string;
    route?: { name:string; time?:string }[];
};

export default function Trips(){
    const { token, isLoading } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [open,setOpen]=useState(false);
    const [edit,setEdit]=useState<Trip|null>(null);

    // pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const load = () => axios.get('/products').then(r => setRows(r.data.products || []));

    useEffect(()=>{
        if (isLoading || !token) return;
        load();
    },[isLoading, token]);

    // filter + paginate
    const filtered = useMemo(()=>{
        const ql = q.trim().toLowerCase();
        const f = ql
            ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(ql))
            : rows;
        return f;
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page > totalPages) setPage(totalPages); },[totalPages, page]);
    const paged = useMemo(()=>{
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered, page, pageSize]);

    return (
        <div className="space-y-4 text-indigo-900/80">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>

                <div className="flex items-center gap-2">
                    <input
                        className="rounded-xl border px-3 py-2"
                        placeholder="Ara (sefer, firma, güzergâh)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                    />
                    <button
                        onClick={()=>{setEdit(null);setOpen(true);}}
                        className="rounded-xl bg-indigo-600 text-white px-4 py-2"
                    >
                        Yeni Sefer
                    </button>
                    <button
                        onClick={()=>{
                            exportCSV('seferler', filtered, [
                                { key:'id', title:'ID' },
                                { key:'trip', title:'Sefer' },
                                { key:'company_name', title:'Firma' },
                                { key:'terminal_from', title:'Kalkış' },
                                { key:'terminal_to', title:'Varış' },
                                { key:'departure_time', title:'Kalkış Zamanı' },
                                { key:'cost', title:'Ücret' },
                                { key:'capacity_reservation', title:'Kapasite' },
                                { key:'duration', title:'Süre' },
                                { key:'bus_type', title:'Otobüs Tipi' },
                                { key:'route', title:'Durak Sayısı', map:(r)=>r.route?.length ?? 0 },
                                { key:'is_active', title:'Aktif', map:(r)=> r.is_active ? 'Evet':'Hayır' },
                            ]);
                        }}
                        className="rounded-xl border px-4 py-2"
                    >
                       CSV
                    </button>
                </div>
            </div>

            {/* Desktop/tablet: tablo */}
            <div className="hidden md:block rounded-2xl border bg-white p-4">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
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
                    {paged.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2 font-medium">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</td>
                            <td className="whitespace-nowrap">{r.company_name || '-'}</td>
                            <td className="truncate max-w-[260px]">{r.terminal_from} → {r.terminal_to}</td>
                            <td className="whitespace-nowrap">{fmtTR(r.departure_time)}</td>
                            <td className="whitespace-nowrap">{fmtTL(r.cost)}</td>
                            <td>{r.capacity_reservation}</td>
                            <td className="whitespace-nowrap">{r.duration || '-'}</td>
                            <td className="whitespace-nowrap">{r.bus_type || '-'}</td>
                            <td>{r.route?.length ?? 0}</td>
                            <td>{r.is_active ? 'Evet' : 'Hayır'}</td>
                            <td className="text-right whitespace-nowrap">
                                <button className="px-2 py-1 rounded-lg border mr-2"
                                        onClick={()=>{setEdit(r);setOpen(true);}}>
                                    Düzenle
                                </button>
                            </td>
                        </tr>
                    ))}
                    {paged.length===0 && (
                        <tr><td colSpan={11} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Mobile: kart liste */}
            <div className="md:hidden space-y-3">
                {paged.map(r=>(
                    <div key={r.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</div>
                            <span className="text-xs px-2 py-1 rounded-lg border">{r.is_active?'Aktif':'Pasif'}</span>
                        </div>
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
                            <button className="px-3 py-1 rounded-lg border" onClick={()=>{setEdit(r);setOpen(true);}}>Düzenle</button>
                            <button className="px-3 py-1 rounded-lg border"
                                    onClick={async()=>{
                                        if(!token || isLoading) return alert('Giriş yapın');
                                        if(confirm('Silinsin mi?')){ await axios.delete(`/products/${r.id}`); load(); }
                                    }}>Sil</button>
                        </div>
                    </div>
                ))}
                {paged.length===0 && (
                    <div className="rounded-2xl border bg-white p-6 text-center text-indigo-900/50">
                        Kayıt yok
                    </div>
                )}
            </div>

            {/* Pagination bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-indigo-900/60">
                    Toplam <b>{total}</b> kayıt • Sayfa {page}/{totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="rounded-xl border px-2 py-1"
                        value={pageSize}
                        onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                    >
                        {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                disabled={page<=1}
                                onClick={()=>setPage(p=>Math.max(1,p-1))}>Önceki</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                disabled={page>=totalPages}
                                onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sonraki</button>
                    </div>
                </div>
            </div>

            {open && <TripModal onClose={()=>setOpen(false)} onSaved={()=>{setOpen(false);load();}} initial={edit}/>}
        </div>
    );
}

function TripModal({onClose,onSaved,initial}:{onClose:()=>void; onSaved:()=>void; initial:Trip|null}){
    const { token, isLoading } = myAppHook() as any;
    const [form,setForm]=useState<Partial<Trip>>(initial ?? { is_active:1, capacity_reservation:0, route:[] });

    const change=(k:string,v:any)=> setForm(s=>({...s,[k]:v}));
    const addStop=()=> setForm(s=>({...s, route:[...(s.route||[]), {name:'', time:''}]}));
    const setStop=(i:number, k:'name'|'time', v:string)=> setForm(s=>{
        const r=[...(s.route||[])]; r[i]={...r[i], [k]:v}; return {...s, route:r};
    });
    const delStop=(i:number)=> setForm(s=>{
        const r=[...(s.route||[])]; r.splice(i,1); return {...s, route:r};
    });

    const save=async()=>{
        if (isLoading || !token) { alert('Önce giriş yapın'); return; }
        const payload = {
            trip: form.trip || `${form.terminal_from} - ${form.terminal_to}`,
            company_name: form.company_name,
            terminal_from: form.terminal_from,
            terminal_to: form.terminal_to,
            departure_time: form.departure_time, // 'YYYY-MM-DDTHH:mm'
            cost: Number(form.cost||0),
            capacity_reservation: Number(form.capacity_reservation||0),
            is_active: !!form.is_active,
            note: form.note||null,
            duration: form.duration || null,
            bus_type: form.bus_type || null,
            route: (form.route||[]).filter(s=>s.name?.trim()),
            cancellation_policy: form.cancellation_policy || null,
            important_notes: form.important_notes || null,
        };
        if(initial) await axios.put(`/products/${initial.id}`, payload);
        else await axios.post('/products', payload);
        onSaved();
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">{initial? 'Seferi Düzenle':'Yeni Sefer'}</h2>
                    <button onClick={onClose} className="px-2 py-1 rounded-lg border">Kapat</button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Sefer Adı" value={String(form.trip||'')} onChange={v=>change('trip',v)} />
                    <Input label="Firma" value={String(form.company_name||'')} onChange={v=>change('company_name',v)} />
                    <Input label="Kalkış Terminal" value={String(form.terminal_from||'')} onChange={v=>change('terminal_from',v)}/>
                    <Input label="Varış Terminal" value={String(form.terminal_to||'')} onChange={v=>change('terminal_to',v)}/>
                    <Input label="Kalkış Zamanı" type="datetime-local" value={String(form.departure_time||'')} onChange={v=>change('departure_time',v)}/>
                    <Input label="Ücret" type="number" value={String(form.cost??'')} onChange={v=>change('cost',v)}/>
                    <Input label="Kapasite" type="number" value={String(form.capacity_reservation??'')} onChange={v=>change('capacity_reservation',v)}/>
                    <Input label="Süre" value={String(form.duration||'')} onChange={v=>change('duration',v)} />
                    <Input label="Otobüs Tipi" value={String(form.bus_type||'')} onChange={v=>change('bus_type',v)} />
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
                                  value={String((form as any).important_notes||'')}
                                  onChange={e=>change('important_notes', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">İptal/İade Koşulları</label>
                        <textarea className="w-full rounded-xl border px-3 py-2" rows={2}
                                  value={String((form as any).cancellation_policy||'')}
                                  onChange={e=>change('cancellation_policy', e.target.value)} />
                    </div>

                    {/* Duraklar */}
                    <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-indigo-900">Güzergâh Durakları</label>
                            <button type="button" onClick={addStop} className="px-2 py-1 rounded-lg border">Durak Ekle</button>
                        </div>
                        <div className="space-y-2">
                            {(form.route||[]).map((s, i)=>(
                                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                                    <input className="rounded-xl border px-3 py-2" placeholder="Durak adı"
                                           value={s.name||''} onChange={e=>setStop(i,'name',e.target.value)} />
                                    <input className="rounded-xl border px-3 py-2" placeholder="Saat (örn 19:45)"
                                           value={s.time||''} onChange={e=>setStop(i,'time',e.target.value)} />
                                    <button type="button" className="px-2 py-2 rounded-lg border" onClick={()=>delStop(i)}>Sil</button>
                                </div>
                            ))}
                            {(form.route||[]).length===0 && (
                                <div className="text-sm text-indigo-900/60">Henüz durak eklenmedi.</div>
                            )}
                        </div>
                    </div>

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

function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){
    return (
        <div>
            <label className="block text-sm font-medium text-indigo-900 mb-1">{label}</label>
            <input type={type} value={value} onChange={e=>onChange(e.target.value)}
                   className="w-full rounded-xl border px-3 py-2"/>
        </div>
    );
}

const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));
