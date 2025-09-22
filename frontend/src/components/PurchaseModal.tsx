"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { myAppHook } from "../../context/AppProvider";

type TripDetail = {
    id:number; terminal_from:string; terminal_to:string; departure_time:string;
    company_name?:string; cost:number|string; duration?:string|null; bus_type?:string|null;
    seat_map?:{ layout?:"2+1"|"2+2"; rows?:number }|null; taken_seats?:string[];
    important_notes?:string|null; cancellation_policy?:string|null;
};

export default function PurchaseModal({
                                          id, onClose, onPurchased
                                      }:{ id:number; onClose:()=>void; onPurchased:(pnr:string)=>void }){

    const { token, isLoading } = (myAppHook() as any) || {};
    const [detail,setDetail]=useState<TripDetail|null>(null);
    const [loading,setLoading]=useState(true);

    const [qty,setQty]=useState(1);
    const [seats,setSeats]=useState<string[]>([]);
    const [passenger,setPassenger]=useState({ first_name:"", last_name:"", doc_type:"tc", national_id:"", passport_no:"", nationality:"TR", email:"", phone:"" });
    const [payment,setPayment]=useState({ card_holder:"", card_number:"", card_exp:"", card_cvv:"" });
    const [submitting,setSubmitting]=useState(false);

    useEffect(()=>{ (async()=>{
        try{
            const res = await api.get(`/public/products/${id}`, { public:true });
            const d:TripDetail = await api.json(res);
            if(!d.seat_map) d.seat_map = { layout:(d.bus_type as any) || "2+1", rows:12 };
            setDetail(d);
        } finally { setLoading(false); }
    })(); },[id]);

    const taken = useMemo(()=> new Set(detail?.taken_seats||[]), [detail?.taken_seats]);
    const canSubmit = seats.length===qty
        && (passenger.doc_type==='tc' ? passenger.national_id.trim() : passenger.passport_no.trim())
        && passenger.first_name.trim() && passenger.last_name.trim()
        && payment.card_holder.trim() && payment.card_number.replace(/\s+/g,'').length>=12
        && /\d{2}\/\d{2}/.test(payment.card_exp) && payment.card_cvv.length>=3;

    const submit = async ()=>{
        if(isLoading) return;
        if(!token){ window.location.href="/auth?mode=login"; return; }
        if(!detail || !canSubmit) return;

        setSubmitting(true);
        try{
            const payload = {
                product_id: detail.id, qty, seats,
                passenger_name: `${passenger.first_name} ${passenger.last_name}`.trim(),
                passenger_doc_type: passenger.doc_type,
                passenger_national_id: passenger.doc_type==='tc'? passenger.national_id : null,
                passenger_passport_no: passenger.doc_type==='passport'? passenger.passport_no : null,
                passenger_nationality: passenger.doc_type==='passport'? passenger.nationality : 'TR',
                passenger_email: passenger.email || null, passenger_phone: passenger.phone || null,
                card_holder: payment.card_holder, card_number: payment.card_number, card_exp: payment.card_exp, card_cvv: payment.card_cvv,
            };
            const res = await api.post("/orders", payload, { token });
            const data = await api.json<{status:boolean; pnr?:string; message?:string}>(res);
            if(data?.status) onPurchased(data.pnr || "");
            else alert(data?.message || "Satın alma başarısız");
        } catch(e:any){ alert(e?.message || "Satın alma hatası"); }
        finally{ setSubmitting(false); }
    };

    if(loading || !detail) return <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center text-white">Yükleniyor…</div>;

    const layout = (detail.seat_map?.layout || "2+1") as "2+1"|"2+2";
    const rows = detail.seat_map?.rows ?? 12;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl border bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">{detail.terminal_from} → {detail.terminal_to}</div>
                        <div className="text-xs text-indigo-900/60">{detail.company_name||"-"} • {new Date(detail.departure_time).toLocaleString()} • {detail.bus_type||"—"}</div>
                    </div>
                    <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Kapat</button>
                </div>

                <div className="p-4 grid lg:grid-cols-[1.2fr_1fr] gap-4">
                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Koltuk Seçimi</h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm">Adet</label>
                                    <select className="rounded-lg border px-2 py-1" value={qty} onChange={e=>{ const n=Number(e.target.value); setQty(n); setSeats(s=>s.slice(0,n)); }}>
                                        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                            <SeatMap rows={rows} layout={layout} taken={taken} selected={seats} onToggle={(s)=>{
                                if(taken.has(s)) return;
                                setSeats(curr=>{ const has=curr.includes(s); let next=has? curr.filter(x=>x!==s) : [...curr,s]; if(next.length>qty) next=next.slice(0,qty); return next; });
                            }}/>
                            <div className="mt-2 text-sm text-indigo-900/70">Seçilen: {seats.length? seats.join(", ") : "—"}</div>
                        </section>

                        {(detail.important_notes || detail.cancellation_policy) && (
                            <section className="rounded-xl border p-3 text-sm">
                                {detail.important_notes && (<><div className="font-semibold mb-1">Önemli Notlar</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.important_notes}</div></>)}
                                {detail.cancellation_policy && (<><div className="font-semibold mt-2 mb-1">İptal/İade</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.cancellation_policy}</div></>)}
                            </section>
                        )}
                    </div>

                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Yolcu</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input label="Ad" value={passenger.first_name} onChange={v=>setPassenger(s=>({...s,first_name:v}))}/>
                                <Input label="Soyad" value={passenger.last_name}  onChange={v=>setPassenger(s=>({...s,last_name:v}))}/>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                <Input label="E-posta" value={passenger.email} onChange={v=>setPassenger(s=>({...s,email:v}))}/>
                                <Input label="Telefon" value={passenger.phone} onChange={v=>setPassenger(s=>({...s,phone:v}))}/>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-sm text-indigo-900/70 mb-1">Belge</label>
                                    <select className="w-full rounded-lg border px-3 py-2" value={passenger.doc_type} onChange={e=>setPassenger(s=>({...s,doc_type:e.target.value as any}))}>
                                        <option value="tc">TC Kimlik</option><option value="passport">Pasaport</option>
                                    </select>
                                </div>
                                {passenger.doc_type==='tc'
                                    ? (<Input label="TC Kimlik No" value={passenger.national_id} onChange={v=>setPassenger(s=>({...s,national_id:v}))}/>)
                                    : (<>
                                        <Input label="Pasaport No" value={passenger.passport_no} onChange={v=>setPassenger(s=>({...s,passport_no:v}))}/>
                                        <Input label="Uyruk" value={passenger.nationality} onChange={v=>setPassenger(s=>({...s,nationality:v}))}/>
                                    </>)
                                }
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Ödeme</h3>
                            <Input label="Kart Üzerindeki İsim" value={payment.card_holder} onChange={v=>setPayment(s=>({...s,card_holder:v}))}/>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <Input label="Kart Num." value={payment.card_number} onChange={v=>setPayment(s=>({...s,card_number:v}))} placeholder="**** **** **** ****"/>
                                <Input label="SKT (AA/YY)" value={payment.card_exp} onChange={v=>setPayment(s=>({...s,card_exp:v}))} placeholder="MM/YY"/>
                                <Input label="CVV" value={payment.card_cvv} onChange={v=>setPayment(s=>({...s,card_cvv:v}))}/>
                            </div>
                        </section>

                        <div className="flex items-center justify-end gap-2">
                            <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Vazgeç</button>
                            <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50" disabled={!canSubmit||submitting} onClick={submit}>
                                {submitting? "Gönderiliyor…" : "Satın Al"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Input({label,value,onChange,placeholder=''}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){
    return (<div><label className="block text-sm text-indigo-900/70 mb-1">{label}</label>
        <input className="w-full rounded-lg border px-3 py-2" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>);
}

function SeatMap({rows,layout,taken,selected,onToggle}:{rows:number;layout:"2+1"|"2+2";taken:Set<string>;selected:string[];onToggle:(s:string)=>void}){
    const left=["A","B"]; const right= layout==="2+1"? ["C"] : ["C","D"];
    return (
        <div className="border rounded-xl p-3">
            <div className="mb-2 text-xs text-indigo-900/60">Düzen: {layout} • Sıra: {rows}</div>
            <div className="space-y-1">
                {Array.from({length:rows}).map((_,i)=>{
                    const r=i+1;
                    return (
                        <div key={r} className="flex items-center gap-2">
                            <div className="flex gap-1">{left.map(c=>{ const code=`${r}${c}`; const sel=selected.includes(code); const tk=taken.has(code);
                                return <button key={code} type="button" className={`w-10 h-10 rounded-lg border text-xs font-medium ${tk?"bg-gray-300 text-gray-500 cursor-not-allowed": sel?"bg-indigo-600 text-white":"bg-white hover:bg-gray-50"}`} disabled={tk} onClick={()=>onToggle(code)}>{code}</button>; })}</div>
                            <div className="w-6" />
                            <div className="flex gap-1">{right.map(c=>{ const code=`${r}${c}`; const sel=selected.includes(code); const tk=taken.has(code);
                                return <button key={code} type="button" className={`w-10 h-10 rounded-lg border text-xs font-medium ${tk?"bg-gray-300 text-gray-500 cursor-not-allowed": sel?"bg-indigo-600 text-white":"bg-white hover:bg-gray-50"}`} disabled={tk} onClick={()=>onToggle(code)}>{code}</button>; })}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
