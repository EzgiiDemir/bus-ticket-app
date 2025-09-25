'use client';

import { useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { myAppHook } from "../../context/AppProvider";

/* ---------- Types ---------- */
type TripDetail = {
    disabled_seats?: { code:string; type:'fault'|'blocked'; label?:string; reason?:string }[];
    blocked_all?: string[];
    id: number;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    company_name?: string;
    cost: number | string;
    duration?: string | null;
    bus_type?: "2+1" | "2+2" | string | null;
    seat_map?: { layout?: "2+1" | "2+2"; rows?: number } | null;
    taken_seats?: string[];
    important_notes?: string | null;
    cancellation_policy?: string | null;
};
type PurchaseResp = { status: boolean; pnr?: string; message?: string };

/* ---------- Utils ---------- */
const toISO = (s?: string) => (s ? (s.includes("T") ? s : s.replace(" ", "T")) : "");
const minsLeft = (iso?: string) => {
    if (!iso) return Number.POSITIVE_INFINITY;
    const ms = new Date(toISO(iso)).getTime() - Date.now();
    return Math.floor(ms / 60000);
};
const digits = (s: string) => s.replace(/\D+/g, "");
const validExp = (v: string) => {
    const m = v.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const mm = +m[1], yy = +m[2];
    if (mm < 1 || mm > 12) return false;
    const exp = new Date(2000 + yy, mm, 0).getTime();
    return exp >= Date.now();
};
const luhn = (num: string) => {
    const s = digits(num);
    let sum = 0, dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
        let d = +s[i];
        if (dbl) { d *= 2; if (d > 9) d -= 9; }
        sum += d; dbl = !dbl;
    }
    return s.length >= 12 && sum % 10 === 0;
};
const trCur = (n: any) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 })
        .format(Number(String(n).replace(",", ".") || 0));

/* ---------- Passenger types/helpers ---------- */
type PassengerInfo = {
    seat?: string;
    first_name: string;
    last_name: string;
    doc_type: 'tc'|'passport';
    national_id: string;
    passport_no: string;
    nationality: string;
    email: string;
    phone: string;
};
const validPassenger = (p: PassengerInfo) => {
    const nameOk = p.first_name.trim().length>1 && p.last_name.trim().length>1;
    const emailOk = !p.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email);
    const phoneOk = !p.phone || /^[0-9+\-\s]{7,}$/.test(p.phone);
    const idOk = p.doc_type==='tc' ? /^\d{11}$/.test(digits(p.national_id)) :
        (p.passport_no.trim().length>0 && p.nationality.trim().length>0);
    return nameOk && emailOk && phoneOk && idOk;
};

/* ---------- Component ---------- */
export default function PurchaseModal({
                                          id,
                                          onClose,
                                          onPurchased,
                                      }: {
    id: number;
    onClose: () => void;
    onPurchased: (pnr: string) => void;
}) {
    const { token, isLoading } = (myAppHook() as any) || {};

    const [detail, setDetail] = useState<TripDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [qty, setQty] = useState(1);
    const [seats, setSeats] = useState<string[]>([]);
    const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
    const [payment, setPayment] = useState({ card_holder: "", card_number: "", card_exp: "", card_cvv: "" });
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState("");
    const [successPNR, setSuccessPNR] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // fetch detail
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setErr("");
                const res = await api.get(`/public/products/${id}`, { public: true });
                const d = (await api.json<TripDetail>(res)) || null;
                if (!mounted) return;
                const layout = (d?.seat_map?.layout as "2+1" | "2+2") || ((d?.bus_type as any) || "2+1");
                const rows = d?.seat_map?.rows ?? 12;
                setDetail(d ? { ...d, seat_map: { layout, rows } } : null);
            } catch (e: any) {
                if (mounted) setErr(e?.message || "Sefer bilgisi alınamadı.");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    // passengers length sync
    useEffect(()=>{
        setPassengers(prev=>{
            const base = [...prev];
            while (base.length < qty) {
                base.push({
                    first_name:'', last_name:'', doc_type:'tc',
                    national_id:'', passport_no:'', nationality:'TR',
                    email:'', phone:'', seat: undefined
                });
            }
            return base.slice(0, qty);
        });
    },[qty]);

    // seat -> passenger seat mapping
    useEffect(()=>{
        setPassengers(prev=> prev.map((p, i)=> ({...p, seat: seats[i]})));
    },[seats]);

    // maps/sets
    const disabledMap = useMemo(() => {
        const arr: NonNullable<TripDetail['disabled_seats']> = detail?.disabled_seats || [];
        const m = new Map<string, { label: string; type: 'fault' | 'blocked'; reason?: string }>();
        for (const o of arr) m.set(o.code, { label: o.label || (o.type === 'fault' ? 'Arıza' : 'Kapalı'), type: o.type, reason: o.reason });
        return m;
    }, [detail?.disabled_seats]);

    const taken = useMemo(() => {
        const codes =
            detail?.blocked_all && detail.blocked_all.length
                ? detail.blocked_all
                : [
                    ...(detail?.taken_seats || []),
                    ...(detail?.disabled_seats || []).map(o => o.code),
                ];
        return new Set(codes);
    }, [detail?.taken_seats, detail?.disabled_seats, detail?.blocked_all]);

    const price = useMemo(
        () => Number(String(detail?.cost ?? 0).replace(",", ".")) * seats.length,
        [detail?.cost, seats.length]
    );
    const leaveInMin = useMemo(() => minsLeft(detail?.departure_time), [detail?.departure_time]);
    const blocked = leaveInMin <= 60;

    const paymentOk =
        payment.card_holder.trim().length >= 2 &&
        luhn(payment.card_number) &&
        validExp(payment.card_exp) &&
        /^\d{3,4}$/.test(payment.card_cvv);

    const passengersOk = passengers.length===qty &&
        passengers.every((p, i)=> !!seats[i] && validPassenger(p));

    const canSubmit = !blocked && seats.length === qty && passengersOk && paymentOk;

    const toggleSeat = (s: string) => {
        if (taken.has(s)) return;
        if (disabledMap.has(s)) return;
        setSeats(curr => {
            const has = curr.includes(s);
            let next = has ? curr.filter(x => x !== s) : [...curr, s];
            if (next.length > qty) next = next.slice(0, qty);
            return next;
        });
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setSuccessMsg("PNR kopyalandı.");
            setTimeout(() => setSuccessMsg(null), 2500);
        } catch {
            setSuccessMsg("Kopyalama başarısız.");
            setTimeout(() => setSuccessMsg(null), 2500);
        }
    };

    const submit = async () => {
        if (isLoading) return;
        if (!token) { window.location.href = "/auth?mode=login"; return; }
        if (!detail) return;
        if (!canSubmit) { setErr("Form doğrulanmadı. Lütfen eksik alanları kontrol edin."); return; }

        setSubmitting(true);
        setErr("");
        try {
            const payload = {
                product_id: detail.id,
                qty,
                seats,
                passengers: passengers.map((p, i)=>({
                    seat: seats[i],
                    first_name: p.first_name.trim(),
                    last_name: p.last_name.trim(),
                    doc_type: p.doc_type,
                    national_id: p.doc_type==='tc' ? digits(p.national_id) : null,
                    passport_no: p.doc_type==='passport' ? p.passport_no.trim() : null,
                    nationality: p.doc_type==='passport' ? p.nationality.trim() : 'TR',
                    email: p.email || null,
                    phone: p.phone || null,
                })),
                card_holder: payment.card_holder.trim(),
                card_number: digits(payment.card_number),
                card_exp: payment.card_exp.trim(),
                card_cvv: payment.card_cvv.trim(),
            };
            const res = await api.post("/orders", payload, { token });
            const data = await api.json<PurchaseResp>(res);

            if (data?.status) {
                setSuccessPNR(data.pnr ?? null);
                setSuccessMsg(data.message ?? "Satın alma başarılı.");
                setErr("");
            } else {
                setErr(data?.message || "Satın alma başarısız.");
            }
        } catch (e: any) {
            setErr(
                e?.response?.data?.message ||
                (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join("\n")) ||
                e?.message ||
                "Satın alma hatası."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const layout = (detail?.seat_map?.layout || "2+1") as "2+1" | "2+2";
    const rows = detail?.seat_map?.rows ?? 12;

    // Success view
    if (successPNR && detail) {
        return (
            <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center" role="dialog" aria-modal="true">
                <div className="w-full max-w-lg rounded-2xl border bg-white p-6 text-indigo-900">
                    <h2 className="text-xl font-bold">Satın alma başarılı 🎉</h2>
                    <p className="mt-2 text-sm text-indigo-900/70">Biletiniz başarıyla oluşturuldu. Aşağıdaki PNR ile bilet bilgilerinize ulaşabilirsiniz.</p>

                    <div className="mt-4 p-4 rounded-lg border bg-emerald-50 flex items-center justify-between">
                        <div>
                            <div className="text-xs text-emerald-800/80">PNR</div>
                            <div className="text-2xl font-semibold">{successPNR}</div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button className="px-3 py-2 rounded-lg border bg-white" onClick={() => copyToClipboard(successPNR!)}>
                                Kopyala
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg border bg-white"
                                onClick={() => { onPurchased(successPNR!); }}
                            >
                                Tamam
                            </button>
                        </div>
                    </div>

                    {successMsg && <div className="mt-3 text-sm text-emerald-800">{successMsg}</div>}

                    <div className="mt-4 flex justify-end gap-2">
                        <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Kapat</button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !detail)
        return (
            <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center">
                <div className="rounded-2xl bg-white px-6 py-4">Yükleniyor…</div>
            </div>
        );

    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-label="Satın alma">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl border bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">
                            {detail.terminal_from} → {detail.terminal_to}
                        </div>
                        <div className="text-xs text-indigo-900/60">
                            {detail.company_name || "-"} • {new Date(detail.departure_time).toLocaleString("tr-TR")} • {detail.bus_type || "—"} • {trCur(detail.cost)}
                        </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg border" onClick={onClose} aria-label="Kapat">Kapat</button>
                </div>

                <div className="p-4 grid lg:grid-cols-[1.2fr_1fr] gap-4">
                    {/* Left */}
                    <div className="space-y-4">
                        {blocked && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                Kalkışa 1 saatten az kaldı. Satış kapalı.
                            </div>
                        )}

                        <section className="rounded-xl border p-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Koltuk Seçimi</h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm" htmlFor="qty">Adet</label>
                                    <select
                                        id="qty"
                                        className="rounded-lg border px-2 py-1"
                                        value={qty}
                                        onChange={(e) => {
                                            const n = Number(e.target.value);
                                            setQty(n);
                                            setSeats((s) => s.slice(0, n));
                                        }}
                                    >
                                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>

                            <SeatMap
                                rows={rows}
                                layout={layout}
                                taken={taken}
                                selected={seats}
                                onToggle={toggleSeat}
                                disabledMap={disabledMap}
                            />

                            <div className="mt-2 text-sm text-indigo-900/70">
                                Seçilen: {seats.length ? seats.join(", ") : "—"} • Tutar: <span className="font-semibold">{trCur(price)}</span>
                            </div>
                        </section>

                        {(detail.important_notes || detail.cancellation_policy) && (
                            <section className="rounded-xl border p-3 text-sm">
                                {detail.important_notes && (<><div className="font-semibold mb-1">Önemli Notlar</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.important_notes}</div></>)}
                                {detail.cancellation_policy && (<><div className="font-semibold mt-2 mb-1">İptal/İade</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.cancellation_policy}</div></>)}
                            </section>
                        )}
                    </div>

                    {/* Right */}
                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Yolcular</h3>
                            <div className="space-y-2">
                                {passengers.map((p, idx)=>(
                                    <details key={idx} className="rounded-lg border">
                                        <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                      <span>
                        {idx+1}. Yolcu {p.first_name && p.last_name ? `• ${p.first_name} ${p.last_name}`:''}
                          {seats[idx] ? ` • Koltuk ${seats[idx]}` : ''}
                      </span>
                                            {!validPassenger(p) && <span className="text-xs text-red-600">Eksik</span>}
                                        </summary>
                                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <Input label="Ad" value={p.first_name} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, first_name:v}:x))}/>
                                            <Input label="Soyad" value={p.last_name} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, last_name:v}:x))}/>
                                            <Input label="E-posta" value={p.email} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, email:v}:x))}/>
                                            <Input label="Telefon" value={p.phone} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, phone:v}:x))}/>
                                            <div>
                                                <label className="block text-sm text-indigo-900/70 mb-1">Belge</label>
                                                <select className="w-full rounded-lg border px-3 py-2"
                                                        value={p.doc_type}
                                                        onChange={e=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, doc_type: e.target.value as any }:x))}>
                                                    <option value="tc">TC Kimlik</option>
                                                    <option value="passport">Pasaport</option>
                                                </select>
                                            </div>
                                            {p.doc_type==='tc' ? (
                                                <Input label="TC Kimlik No" value={p.national_id}
                                                       onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, national_id:v}:x))}/>
                                            ) : (
                                                <>
                                                    <Input label="Pasaport No" value={p.passport_no}
                                                           onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, passport_no:v}:x))}/>
                                                    <Input label="Uyruk" value={p.nationality}
                                                           onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, nationality:v}:x))}/>
                                                </>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Ödeme</h3>
                            <Input label="Kart Üzerindeki İsim" value={payment.card_holder} onChange={(v) => setPayment((s) => ({ ...s, card_holder: v }))} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <Input label="Kart Num." value={payment.card_number} onChange={(v) => setPayment((s) => ({ ...s, card_number: v }))} placeholder="**** **** **** ****" />
                                <Input label="SKT (AA/YY)" value={payment.card_exp} onChange={(v) => setPayment((s) => ({ ...s, card_exp: v }))} placeholder="MM/YY" />
                                <Input label="CVV" value={payment.card_cvv} onChange={(v) => setPayment((s) => ({ ...s, card_cvv: v }))} />
                            </div>
                            {!!payment.card_number && !luhn(payment.card_number) && <div className="mt-1 text-xs text-red-600">Kart numarası geçersiz görünüyor.</div>}
                            {!!payment.card_exp && !validExp(payment.card_exp) && <div className="mt-1 text-xs text-red-600">Son kullanma tarihi (AA/YY) ve geçerli olmalı.</div>}
                        </section>

                        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

                        <div className="flex items-center justify-end gap-2">
                            <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Vazgeç</button>
                            <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50" disabled={!canSubmit || submitting} onClick={submit} aria-disabled={!canSubmit || submitting}>
                                {submitting ? "Gönderiliyor…" : "Satın Al"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- UI bits ---------- */
function Input({
                   label,
                   value,
                   onChange,
                   placeholder = "",
               }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-sm text-indigo-900/70 mb-1">{label}</label>
            <input className="w-full rounded-lg border px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );
}

function SeatMap({
                     rows, layout, taken, selected, onToggle, disabledMap
                 }: {
    rows: number;
    layout: "2+1" | "2+2";
    taken: Set<string>;
    selected: string[];
    onToggle: (s: string) => void;
    disabledMap: Map<string,{label:string;type:'fault'|'blocked';reason?:string}>;
}) {
    const left = ["A","B"];
    const right = layout === "2+1" ? ["C"] : ["C","D"];

    const btnCls = (code: string) => {
        const tk = taken.has(code);
        const sel = selected.includes(code);
        if (tk) return "bg-gray-200 text-gray-500 cursor-not-allowed relative";
        return sel ? "bg-indigo-600 text-white relative" : "bg-white hover:bg-gray-50 relative";
    };

    const Ribbon = ({code}:{code:string})=>{
        const meta = disabledMap.get(code);
        if (!meta) return null;
        return (
            <span
                className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[10px] border"
                title={`${meta.label}${meta.reason ? `: ${meta.reason}` : ""}`}
            >
        {meta.label}
      </span>
        );
    };

    return (
        <div className="border rounded-xl p-3" aria-label="Koltuk planı">
            <div className="mb-2 text-xs text-indigo-900/60">Düzen: {layout} • Sıra: {rows}</div>
            <div className="space-y-1">
                {Array.from({ length: rows }).map((_, i) => {
                    const r = i + 1;
                    return (
                        <div key={r} className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {left.map((c) => {
                                    const code = `${r}${c}`;
                                    const dis = taken.has(code);
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            className={`w-10 h-10 rounded-lg border text-xs font-medium ${btnCls(code)}`}
                                            disabled={dis}
                                            onClick={() => onToggle(code)}
                                            title={disabledMap.get(code)?.label ? `${code} (${disabledMap.get(code)?.label})` : code}
                                            aria-label={`Koltuk ${code}${dis ? " (Pasif)" : selected.includes(code) ? " (Seçili)" : ""}`}
                                        >
                                            {code}
                                            <Ribbon code={code}/>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-6" />
                            <div className="flex gap-1">
                                {right.map((c) => {
                                    const code = `${r}${c}`;
                                    const dis = taken.has(code);
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            className={`w-10 h-10 rounded-lg border text-xs font-medium ${btnCls(code)}`}
                                            disabled={dis}
                                            onClick={() => onToggle(code)}
                                            title={disabledMap.get(code)?.label ? `${code} (${disabledMap.get(code)?.label})` : code}
                                            aria-label={`Koltuk ${code}${dis ? " (Pasif)" : selected.includes(code) ? " (Seçili)" : ""}`}
                                        >
                                            {code}
                                            <Ribbon code={code}/>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-indigo-900/60">
                Dolu, arızalı ve kapalı koltuklar seçilemez.
            </div>
        </div>
    );
}
