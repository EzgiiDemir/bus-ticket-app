'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

type Trip = {
    id:number; trip:string; company_name:string; terminal_from:string; terminal_to:string;
    departure_time:string; cost:number; capacity_reservation:number; is_active:number; note?:string
};

export default function Trips(){
    const { token, isLoading } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [open,setOpen]=useState(false);
    const [edit,setEdit]=useState<Trip|null>(null);

    const load=()=> axios.get('/products').then(r=> setRows(r.data.products||[]));

    useEffect(()=>{
        if (isLoading) return;
        if (!token) return;
        load();
    },[isLoading, token]);

    const filtered = useMemo(
        ()=> rows.filter(r=> JSON.stringify(r).toLowerCase().includes(q.toLowerCase())),
        [rows,q]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <button onClick={()=>{setEdit(null);setOpen(true);}} className="rounded-xl bg-indigo-600 text-white px-4 py-2">
                    Yeni Sefer
                </button>
            </div>

            <div className="rounded-2xl border bg-white p-4 text-indigo-900/70">
                <input className="w-full rounded-xl border px-3 py-2 mb-3 text-indigo-900/70" placeholder="Ara..." value={q} onChange={e=>setQ(e.target.value)}/>
                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Sefer</th><th>Firma</th><th>Güzergah</th><th>Kalkış</th><th>Ücret</th><th>Kapasite</th><th>Aktif</th><th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map(r=> (
                            <tr key={r.id} className="border-t">
                                <td className="py-2 font-medium">{r.trip}</td>
                                <td>{r.company_name}</td>
                                <td>{r.terminal_from} → {r.terminal_to}</td>
                                <td>{r.departure_time}</td>
                                <td>{r.cost} ₺</td>
                                <td>{r.capacity_reservation}</td>
                                <td>{r.is_active? 'Evet':'Hayır'}</td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border mr-2" onClick={()=>{setEdit(r);setOpen(true);}}>Düzenle</button>
                                    <button
                                        className="px-2 py-1 rounded-lg border"
                                        onClick={async()=>{
                                            if(!token || isLoading) return alert('Giriş yapın');
                                            if(confirm('Silinsin mi?')){
                                                await axios.delete(`/products/${r.id}`);
                                                load();
                                            }
                                        }}
                                    >Sil</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {open && <TripModal onClose={()=>setOpen(false)} onSaved={()=>{setOpen(false);load();}} initial={edit}/>}
        </div>
    );
}

function TripModal({onClose,onSaved,initial}:{onClose:()=>void; onSaved:()=>void; initial:Trip|null}){
    const { token, isLoading } = myAppHook() as any;
    const [form,setForm]=useState<Partial<Trip>>(initial ?? { is_active:1, capacity_reservation:0 });
    const change=(k:string,v:any)=> setForm(s=>({...s,[k]:v}));

    const save=async()=>{
        if (isLoading || !token) { alert('Önce giriş yapın'); return; }
        const payload = {
            trip: form.trip,
            company_name: form.company_name,
            terminal_from: form.terminal_from,
            terminal_to: form.terminal_to,
            departure_time: form.departure_time, // 'YYYY-MM-DDTHH:mm'
            cost: Number(form.cost||0),
            capacity_reservation: Number(form.capacity_reservation||0),
            is_active: !!form.is_active,
            note: form.note||null,
        };
        if(initial) await axios.put(`/products/${initial.id}`, payload);
        else await axios.post('/products', payload);
        onSaved();
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">{initial? 'Seferi Düzenle':'Yeni Sefer'}</h2>
                    <button onClick={onClose} className="px-2 py-1 rounded-lg border">Kapat</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                    <Input label="Sefer Adı" value={String(form.trip||'')} onChange={v=>change('trip',v)}/>
                    <Input label="Firma" value={String(form.company_name||'')} onChange={v=>change('company_name',v)}/>
                    <Input label="Kalkış Terminal" value={String(form.terminal_from||'')} onChange={v=>change('terminal_from',v)}/>
                    <Input label="Varış Terminal" value={String(form.terminal_to||'')} onChange={v=>change('terminal_to',v)}/>
                    <Input label="Kalkış Zamanı" type="datetime-local" value={String(form.departure_time||'')} onChange={v=>change('departure_time',v)}/>
                    <Input label="Ücret" type="number" value={String(form.cost??'')} onChange={v=>change('cost',v)}/>
                    <Input label="Kapasite" type="number" value={String(form.capacity_reservation??'')} onChange={v=>change('capacity_reservation',v)}/>
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
                        <label className="block text-sm font-medium text-indigo-900 mb-1">Not</label>
                        <textarea className="w-full rounded-xl border px-3 py-2" rows={3}
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
            <input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2"/>
        </div>
    );
}
