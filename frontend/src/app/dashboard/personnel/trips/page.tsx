'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';
import { exportCSV } from '@/app/lib/export';

/* ---------- Types ---------- */
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
    created_at?:string;
};
type Passenger = {
    id:number;
    passenger_name:string;
    passenger_email?:string;
    passenger_phone?:string;
    qty:number;
    seats?:string[];
    pnr:string;
    created_at:string;
};
type Paged<T> = {
    data:T[];
    total:number;
    per_page:number;
    current_page:number;
    next_page_url?:string|null;
    prev_page_url?:string|null;
};

/* ---------- Page ---------- */
export default function Trips(){
    const { token, isLoading } = myAppHook() as any;

    // server-paginated trips
    const [page,setPage] = useState(1);
    const [pageSize,setPageSize] = useState(10);
    const [paged,setPaged] = useState<Paged<Trip> | null>(null);
    const [q,setQ] = useState('');
    const [loadingList,setLoadingList] = useState(false);

    // modal: create/edit
    const [open,setOpen] = useState(false);
    const [edit,setEdit] = useState<Trip|null>(null);

    // modal: passengers
    const [showPassengers,setShowPassengers]=useState<Trip|null>(null);
    const [passengers,setPassengers]=useState<Paged<Passenger>|null>(null);
    const [pPerPage,setPPerPage]=useState(10);

    const load = async (pageArg=page, perPageArg=pageSize) => {
        if (isLoading || !token) return;
        setLoadingList(true);
        try {
            // backend'te sayfalı endpoint varsa kullan: ?page=&per_page=
            const { data } = await axios.get('/products', { params:{ page: pageArg, per_page: perPageArg, q: q || undefined } });
            // 1) paginator dönerse
            if (data?.data && typeof data?.total === 'number') {
                setPaged({
                    data: data.data as Trip[],
                    total: data.total,
                    per_page: data.per_page ?? perPageArg,
                    current_page: data.current_page ?? pageArg,
                    next_page_url: data.next_page_url ?? null,
                    prev_page_url: data.prev_page_url ?? null,
                });
            } else if (data?.products?.data) {
                // 2) products altında paginator
                setPaged(data.products as Paged<Trip>);
            } else {
                // 3) tam liste dönerse (eski sürüm) -> client-side paginate
                const rows: Trip[] = data?.products || data || [];
                const start = (pageArg-1) * perPageArg;
                setPaged({
                    data: rows.slice(start, start+perPageArg),
                    total: rows.length,
                    per_page: perPageArg,
                    current_page: pageArg,
                    next_page_url: null,
                    prev_page_url: null,
                });
            }
        } finally { setLoadingList(false); }
    };

    useEffect(()=>{ if(!isLoading && token) load(1, pageSize); },[isLoading, token, pageSize]);
    useEffect(()=>{ const t = setTimeout(()=>load(1,pageSize), 300); return ()=>clearTimeout(t); },[q]); // arama debounce

    const totalPages = useMemo(()=> Math.max(1, Math.ceil((paged?.total||0) / (paged?.per_page||pageSize))), [paged, pageSize]);

    /* Yolcu Modalı aç */
    const openPassengers = async (trip:Trip, page=1) => {
        try{
            const { data } = await axios.get(`/products/${trip.id}/orders`, { params:{ page, per_page: pPerPage } });
            const result: Paged<Passenger> = data?.data ? data : (data?.orders || data);
            setPassengers(result);
            setShowPassengers(trip);
        }catch(e:any){
            alert(e?.response?.data?.message || 'Yolcular alınamadı');
        }
    };

    return (
        <div className="space-y-4 text-indigo-900/80">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>

                <div className="flex items-center gap-2">
                    <input
                        className="rounded-xl border px-3 py-2"
                        placeholder="Ara (sefer, firma, güzergâh)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); }}
                    />
                    <button
                        onClick={()=>{ setEdit(null); setOpen(true); }}
                        className="rounded-xl bg-indigo-600 text-white px-4 py-2"
                    >
                        Yeni Sefer
                    </button>
                    <button
                        onClick={()=>{
                            exportCSV('seferler_sayfa.csv', (paged?.data||[]), [
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
                                { key:'route', title:'Durak Sayısı', map:(r:any)=>r.route?.length ?? 0 },
                                { key:'is_active', title:'Durum', map:(r:any)=> r.is_active ? 'Aktif':'Cancelled' },
                            ]);
                        }}
                        className="rounded-xl border px-4 py-2"
                    >
                        CSV
                    </button>
                </div>
            </div>

            {/* Desktop/tablet */}
            <div className="hidden md:block rounded-2xl border bg-white p-4">
                {loadingList ? (
                    <div className="py-10 text-center text-indigo-900/60">Yükleniyor…</div>
                ) : (
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
                            <th>Durum</th>
                            <th className="text-right">İşlem</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(paged?.data||[]).map(r=>{
                            const cancelled = !r.is_active;
                            return (
                                <tr key={r.id} className={`border-t ${cancelled ? 'opacity-60' : ''}`}>
                                    <td className="py-2 font-medium">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</td>
                                    <td className="whitespace-nowrap">{r.company_name || '-'}</td>
                                    <td className="truncate max-w-[260px]">{r.terminal_from} → {r.terminal_to}</td>
                                    <td className="whitespace-nowrap">{fmtTR(r.departure_time)}</td>
                                    <td className="whitespace-nowrap">{fmtTL(r.cost)}</td>
                                    <td>{r.capacity_reservation}</td>
                                    <td className="whitespace-nowrap">{r.duration || '-'}</td>
                                    <td className="whitespace-nowrap">{r.bus_type || '-'}</td>
                                    <td>{r.route?.length ?? 0}</td>
                                    <td>
                    <span className={`px-2 py-1 rounded-lg border text-xs ${cancelled?'bg-red-50 border-red-200 text-red-600':'border-emerald-200 text-emerald-700 bg-emerald-50'}`}>
                      {cancelled ? 'Cancelled' : 'Aktif'}
                    </span>
                                    </td>
                                    <td className="text-right whitespace-nowrap">
                                        <button
                                            className="px-2 py-1 rounded-lg border mr-2 disabled:opacity-50"
                                            onClick={()=>{setEdit(r);setOpen(true);}}
                                            disabled={false /* düzenleme aktif kalsın */}
                                        >
                                            Düzenle
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {(paged?.data||[]).length===0 && (
                            <tr><td colSpan={11} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
                {(paged?.data||[]).map(r=>{
                    const cancelled = !r.is_active;
                    return (
                        <div key={r.id} className={`rounded-2xl border bg-white p-4 ${cancelled?'opacity-60':''}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</div>
                                <span className={`text-xs px-2 py-1 rounded-lg border ${cancelled?'bg-red-50 border-red-200 text-red-600':'border-emerald-200 text-emerald-700 bg-emerald-50'}`}>
                  {cancelled?'Cancelled':'Aktif'}
                </span>
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
                                <button className="px-3 py-1 rounded-lg border disabled:opacity-50" onClick={()=>openPassengers(r,1)} disabled={cancelled}>
                                    Yolcuları Gör
                                </button>
                            </div>
                        </div>
                    );
                })}
                {(paged?.data||[]).length===0 && (
                    <div className="rounded-2xl border bg-white p-6 text-center text-indigo-900/50">Kayıt yok</div>
                )}
            </div>

            {/* Pagination (server fetch) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-indigo-900/60">
                    Toplam <b>{paged?.total ?? 0}</b> kayıt • Sayfa {paged?.current_page ?? page}/{totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="rounded-xl border px-2 py-1"
                        value={pageSize}
                        onChange={e=>{ setPageSize(+e.target.value); setPage(1); }}
                    >
                        {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={(paged?.current_page ?? 1) <= 1}
                            onClick={()=>{ const np=(paged?.current_page||1)-1; setPage(np); load(np, pageSize); }}
                        >Önceki</button>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={(paged?.current_page ?? 1) >= totalPages}
                            onClick={()=>{ const np=(paged?.current_page||1)+1; setPage(np); load(np, pageSize); }}
                        >Sonraki</button>
                    </div>
                </div>
            </div>

            {open && (
                <TripModal
                    onClose={()=>setOpen(false)}
                    onSaved={()=>{ setOpen(false); load(page, pageSize); }}
                    initial={edit}
                />
            )}

            {showPassengers && passengers && (
                <PassengerModal
                    trip={showPassengers}
                    passengers={passengers}
                    perPage={pPerPage}
                    onChangePerPage={(n)=>{ setPPerPage(n); openPassengers(showPassengers,1); }}
                    onChangePage={(np)=>openPassengers(showPassengers, np)}
                    onClose={()=>{ setShowPassengers(null); setPassengers(null); }}
                />
            )}
        </div>
    );
}

/* ---------- Passenger Modal ---------- */
function PassengerModal({
                            trip, passengers, perPage, onChangePerPage, onChangePage, onClose
                        }:{
    trip:Trip;
    passengers:Paged<Passenger>;
    perPage:number;
    onChangePerPage:(n:number)=>void;
    onChangePage:(p:number)=>void;
    onClose:()=>void;
}){
    const totalPages = Math.max(1, Math.ceil(passengers.total / passengers.per_page));
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Yolcular • {trip.trip}</h2>
                    <button onClick={onClose} className="px-2 py-1 rounded-lg border">Kapat</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad Soyad</th>
                            <th>E-posta</th>
                            <th>Telefon</th>
                            <th>PNR</th>
                            <th>Koltuk</th>
                            <th>Adet</th>
                            <th>Satın Alma</th>
                        </tr>
                        </thead>
                        <tbody>
                        {passengers.data.map(p=>(
                            <tr key={p.id} className="border-t">
                                <td className="py-2">{p.passenger_name}</td>
                                <td>{p.passenger_email||'-'}</td>
                                <td>{p.passenger_phone||'-'}</td>
                                <td className="font-mono">{p.pnr}</td>
                                <td>{(p.seats||[]).join(', ') || '-'}</td>
                                <td>{p.qty}</td>
                                <td>{fmtTR(p.created_at)}</td>
                            </tr>
                        ))}
                        {passengers.data.length===0 && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Yolcu yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-indigo-900/60">Toplam <b>{passengers.total}</b> kayıt • Sayfa {passengers.current_page}/{totalPages}</div>
                    <div className="flex items-center gap-2">
                        <select className="rounded-xl border px-2 py-1" value={perPage} onChange={e=>onChangePerPage(+e.target.value)}>
                            {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={passengers.current_page<=1} onClick={()=>onChangePage(passengers.current_page-1)}>Önceki</button>
                            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={passengers.current_page>=totalPages} onClick={()=>onChangePage(passengers.current_page+1)}>Sonraki</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- Trip Modal (select + seeder verileri) ---------- */
function TripModal({onClose,onSaved,initial}:{onClose:()=>void; onSaved:()=>void; initial:Trip|null}){
    const { token, isLoading } = myAppHook() as any;
    const [form,setForm]=useState<Partial<Trip>>(initial ?? { is_active:1, capacity_reservation:0, route:[] });

    // seeder kaynaklı listeler
    const [companyName,setCompanyName] = useState<string>('');
    const [terminals,setTerminals] = useState<{id:number; name:string}[]>([]);
    const [busTypes,setBusTypes] = useState<string[]>(['2+1','2+2']);
    const [durations] = useState<string[]>([
        '3sa', '4sa', '5sa', '6sa', '7sa', '8sa', '9sa 30dk', '10sa'
    ]);

    useEffect(()=>{
        // firma adı: personel -> /personnel/company
        axios.get('/personnel/company').then(r=>{
            const name = r.data?.name || r.data?.company?.name || '';
            setCompanyName(name);
            setForm(s=>({...s, company_name: name}));
        }).catch(()=>{});
        // terminaller
        axios.get('/public/terminals').then(r=>{
            const list = r.data?.terminals || r.data || [];
            setTerminals(list);
        }).catch(()=>{ /* fallback örnek */ setTerminals([
            {id:1,name:'İstanbul (Esenler) Otogarı'},
            {id:2,name:'Alibeyköy Cep Otogarı'},
            {id:3,name:'Ankara AŞTİ'},
            {id:4,name:'Bursa Terminal'},
            {id:5,name:'İzmir (Otogar)'},
        ]); });
        // opsiyonel bus types endpoint
        axios.get('/public/bus-types').then(r=>{
            const list = r.data?.bus_types || r.data;
            if (Array.isArray(list) && list.length) setBusTypes(list);
        }).catch(()=>{});
    },[]);

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
            company_name: companyName || form.company_name,
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
            cancellation_policy: (form as any).cancellation_policy || null,
            important_notes: (form as any).important_notes || null,
        };
        if (initial) await axios.put(`/products/${initial.id}`, payload);
        else         await axios.post('/products', payload);
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
                    {/* Sefer adı (opsiyonel) */}
                    <Input label="Sefer Adı (opsiyonel)" value={String(form.trip||'')} onChange={v=>change('trip',v)} />

                    {/* Firma (readonly) */}
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Firma</label>
                        <input className="w-full rounded-xl border px-3 py-2 bg-gray-50" value={companyName} disabled />
                    </div>

                    {/* Kalkış/Varış (select — seeder) */}
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Kalkış Terminal</label>
                        <select className="w-full rounded-xl border px-3 py-2" value={String(form.terminal_from||'')}
                                onChange={e=>change('terminal_from', e.target.value)}>
                            <option value="">Seçiniz…</option>
                            {terminals.map(t=> <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Varış Terminal</label>
                        <select className="w-full rounded-xl border px-3 py-2" value={String(form.terminal_to||'')}
                                onChange={e=>change('terminal_to', e.target.value)}>
                            <option value="">Seçiniz…</option>
                            {terminals.map(t=> <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>

                    {/* Kalkış zamanı */}
                    <Input label="Kalkış Zamanı" type="datetime-local" value={String(form.departure_time||'')} onChange={v=>change('departure_time',v)}/>

                    {/* Ücret/Kapasite */}
                    <Input label="Ücret" type="number" value={String(form.cost??'')} onChange={v=>change('cost',v)}/>
                    <Input label="Kapasite" type="number" value={String(form.capacity_reservation??'')} onChange={v=>change('capacity_reservation',v)}/>

                    {/* Süre / Otobüs tipi */}
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Yaklaşık Süre</label>
                        <select className="w-full rounded-xl border px-3 py-2" value={String(form.duration||'')}
                                onChange={e=>change('duration', e.target.value)}>
                            <option value="">Seçiniz…</option>
                            {durations.map(d=> <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Otobüs Tipi</label>
                        <select className="w-full rounded-xl border px-3 py-2" value={String(form.bus_type||'')}
                                onChange={e=>change('bus_type', e.target.value)}>
                            <option value="">Seçiniz…</option>
                            {busTypes.map(bt=> <option key={bt} value={bt}>{bt}</option>)}
                        </select>
                    </div>

                    {/* Aktif/Pasif */}
                    <div>
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Durum</label>
                        <select className="w-full rounded-xl border px-3 py-2"
                                value={form.is_active?1:0}
                                onChange={e=>change('is_active', Number(e.target.value))}>
                            <option value={1}>Aktif</option>
                            <option value={0}>Cancelled</option>
                        </select>
                    </div>

                    {/* Notlar */}
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
                                    {/* durak adını da terminal listesinden seçilebilir yap */}
                                    <select className="rounded-xl border px-3 py-2"
                                            value={s.name||''}
                                            onChange={e=>setStop(i,'name',e.target.value)}>
                                        <option value="">Durak seçin…</option>
                                        {terminals.map(t=> <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
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

/* ---------- Small Inputs & helpers ---------- */
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
