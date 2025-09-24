'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Company = { id:number; name:string; code:string };
type User = {
    id:number; name:string; email:string; phone?:string|null;
    role:'passenger'|'personnel'|'admin';
    company?: Company|null;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---------- Sayfa ---------- */
export default function AccountPage(){
    const { isLoading, token, user: ctxUser } = (myAppHook() as any) || {};

    const [me,setMe]=useState<User|null>(null);
    const [loading,setLoading]=useState(true);
    const [err,setErr]=useState('');

    // banners
    const [banner,setBanner]=useState('');

    // forms
    const [profile,setProfile]=useState({ name:'', email:'', phone:'' });
    const [pwd,setPwd]=useState({ current_password:'', password:'', password_confirmation:'' });

    const emailOk = useMemo(()=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email||''),[profile.email]);
    const phoneOk = useMemo(()=>!profile.phone || /^[0-9+\-\s]{7,20}$/.test(profile.phone||''),[profile.phone]);
    const nameOk  = useMemo(()=>profile.name.trim().length>=2,[profile.name]);

    const pwdLenOk = useMemo(()=>pwd.password.length>=8,[pwd.password]);
    const pwdMatch = useMemo(()=>pwd.password && pwd.password===pwd.password_confirmation,[pwd.password,pwd.password_confirmation]);
    const hasCurrent = useMemo(()=>pwd.current_password.length>=6,[pwd.current_password]);

    const canSaveProfile = nameOk && emailOk && phoneOk;
    const canChangePwd  = hasCurrent && pwdLenOk && pwdMatch;

    const refresh = async ()=>{
        if (!token) { setLoading(false); return; }
        setLoading(true); setErr(''); setBanner('');
        try{
            const { data } = await axios.get<User>('/profile', { headers:{ Accept:'application/json' } });
            setMe(data);
            setProfile({ name:data.name||'', email:data.email||'', phone:(data as any).phone||'' });
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Profil alınamadı.');
            setMe(null);
        }finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(!isLoading) void refresh(); },[isLoading, token]);

    const saveProfile=async()=>{
        if(!canSaveProfile) return;
        setErr(''); setBanner('');
        try{
            await axios.put('/me', profile, { headers:{ Accept:'application/json' } });
            setBanner('Profil güncellendi.');
            await refresh();
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            const m = p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Kayıt hatası.';
            setErr(m);
        }
    };

    const changePwd=async()=>{
        if(!canChangePwd) return;
        setErr(''); setBanner('');
        try{
            await axios.put('/me/password', pwd, { headers:{ Accept:'application/json' } });
            setPwd({ current_password:'', password:'', password_confirmation:'' });
            setBanner('Şifre güncellendi.');
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            const m = p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Şifre güncellenemedi.';
            setErr(m);
        }
    };

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;
    if (loading)   return <div className="p-6">Yükleniyor…</div>;
    if (err && !me) return <div className="p-6 text-red-600 whitespace-pre-line">{err}</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold">Hesabım</h1>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            {/* Özet */}
            <div className="rounded-2xl border bg-white p-4 grid sm:grid-cols-2 gap-3">
                <Info label="Ad Soyad" value={me?.name}/>
                <Info label="E-posta"  value={me?.email}/>
                <Info label="Rol"      value={ctxUser?.role || me?.role}/>
                <Info label="Şirket"   value={me?.company ? `${me.company.name} (${me.company.code})` : '-'}/>
            </div>

            {/* Profil güncelle */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Profil Bilgileri</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="Ad Soyad" value={profile.name} onChange={v=>setProfile(s=>({...s, name:v}))}
                           required minLength={2} ariaInvalid={!nameOk}/>
                    <Input label="E-posta" type="email" value={profile.email} onChange={v=>setProfile(s=>({...s, email:v}))}
                           required pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$" ariaInvalid={!emailOk}/>
                    <Input label="Telefon" type="tel" value={profile.phone} onChange={v=>setProfile(s=>({...s, phone:v}))}
                           placeholder="+90 5XX XXX XX XX" pattern="^[0-9+\-\s]{7,20}$" ariaInvalid={!phoneOk}/>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={saveProfile}
                        disabled={!canSaveProfile}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        Kaydet
                    </button>
                </div>
            </section>

            {/* Şifre değiştir */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Şifre Değiştir</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="Mevcut Şifre" type="password" value={pwd.current_password}
                           onChange={v=>setPwd(s=>({...s, current_password:v}))}
                           required minLength={6} ariaInvalid={!hasCurrent}/>
                    <Input label="Yeni Şifre" type="password" value={pwd.password}
                           onChange={v=>setPwd(s=>({...s, password:v}))}
                           required minLength={8} ariaInvalid={!pwdLenOk}/>
                    <Input label="Yeni Şifre (Tekrar)" type="password" value={pwd.password_confirmation}
                           onChange={v=>setPwd(s=>({...s, password_confirmation:v}))}
                           required minLength={8} ariaInvalid={!pwdMatch}/>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={changePwd}
                        disabled={!canChangePwd}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        Şifreyi Güncelle
                    </button>
                </div>
                {/* Yardım ipuçları */}
                <ul className="mt-3 text-xs text-indigo-900/60 list-disc ml-5">
                    <li>E-posta geçerli bir biçimde olmalı.</li>
                    <li>Telefon isteğe bağlıdır. En az 7 rakam.</li>
                    <li>Yeni şifre en az 8 karakter ve tekrar ile aynı olmalı.</li>
                </ul>
            </section>
        </div>
    );
}

/* ---------- Parçalar ---------- */
function Info({label, value}:{label:string; value:any}){
    return (
        <div>
            <div className="text-xs text-indigo-900/60">{label}</div>
            <div className="font-semibold">{value ?? '-'}</div>
        </div>
    );
}

function Input({
                   label, value, onChange, type='text', required=false, placeholder='', pattern, minLength, ariaInvalid
               }:{
    label:string; value:string; onChange:(v:string)=>void; type?:React.HTMLInputTypeAttribute;
    required?:boolean; placeholder?:string; pattern?:string; minLength?:number; ariaInvalid?:boolean;
}){
    return (
        <div>
            <label className="block text-sm text-indigo-900/70 mb-1">
                {label}{required && <span className="text-red-600"> *</span>}
            </label>
            <input
                className={`w-full rounded-xl border px-3 py-2 ${ariaInvalid ? 'border-red-300' : ''}`}
                type={type}
                value={value}
                onChange={e=>onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                pattern={pattern}
                minLength={minLength}
                aria-invalid={ariaInvalid || undefined}
            />
        </div>
    );
}
