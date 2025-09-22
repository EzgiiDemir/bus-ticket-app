'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

type User = {
    id:number;
    name:string;
    email:string;
    role:'admin'|'personnel'|'passenger';
    role_status?: 'pending'|'active'|'rejected';
    company_id?: number|null;
};

export default function AdminAccountPage(){
    const { isLoading } = myAppHook() as any;

    const [me,setMe] = useState<User|null>(null);
    const [loading,setLoading] = useState(true);
    const [saving,setSaving] = useState(false);
    const [pwdSaving,setPwdSaving] = useState(false);
    const [err,setErr] = useState('');

    const [form,setForm] = useState<{name:string; email:string}>({ name:'', email:'' });
    const [pwd,setPwd] = useState<{current:string; password:string; password_confirmation:string}>({
        current:'', password:'', password_confirmation:''
    });

    const load = async ()=>{
        setLoading(true);
        try{
            const { data } = await axios.get<User>('/profile');
            setMe(data);
            setForm({ name: data.name || '', email: data.email || '' });
            setErr('');
        }catch(e:any){
            setErr(e?.response?.data?.message || 'Profil alınamadı');
        }finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(!isLoading) load(); },[isLoading]);

    const saveProfile = async ()=>{
        setSaving(true);
        try{
            await axios.put('/profile', { name: form.name, email: form.email });
            alert('Profil güncellendi');
            await load();
        }catch(e:any){
            const m = e?.response?.data?.message
                || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join('\n'))
                || 'Güncelleme hatası';
            alert(m);
        }finally{ setSaving(false); }
    };

    const changePwd = async ()=>{
        if(!pwd.current || !pwd.password || pwd.password !== pwd.password_confirmation){
            alert('Şifre alanlarını kontrol edin'); return;
        }
        setPwdSaving(true);
        try{
            await axios.put('/password', {
                current_password: pwd.current,
                password: pwd.password,
                password_confirmation: pwd.password_confirmation
            });
            alert('Şifre güncellendi');
            setPwd({ current:'', password:'', password_confirmation:'' });
        }catch(e:any){
            const m = e?.response?.data?.message
                || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join('\n'))
                || 'Şifre değiştirme hatası';
            alert(m);
        }finally{ setPwdSaving(false); }
    };

    if (loading) return <div className="p-6">Yükleniyor…</div>;
    if (err)      return <div className="p-6 text-red-600">{err}</div>;
    if (!me)      return <div className="p-6">Kullanıcı bulunamadı.</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <div>
                <h1 className="text-2xl font-bold">Hesabım</h1>
                <div className="text-sm text-indigo-900/60">Rol: <b className="text-indigo-900">{me.role}</b></div>
            </div>

            {/* Profil Bilgileri */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Profil Bilgileri</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Ad Soyad">
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            value={form.name}
                            onChange={e=>setForm(s=>({ ...s, name:e.target.value }))}
                        />
                    </Field>
                    <Field label="E-posta">
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            value={form.email}
                            onChange={e=>setForm(s=>({ ...s, email:e.target.value }))}
                        />
                    </Field>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {saving? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                </div>
            </section>

            {/* Şifre Değiştir */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Şifre Değiştir</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Mevcut Şifre">
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            value={pwd.current}
                            onChange={e=>setPwd(s=>({ ...s, current:e.target.value }))}
                        />
                    </Field>
                    <Field label="Yeni Şifre">
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            value={pwd.password}
                            onChange={e=>setPwd(s=>({ ...s, password:e.target.value }))}
                        />
                    </Field>
                    <Field label="Yeni Şifre (Tekrar)">
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            value={pwd.password_confirmation}
                            onChange={e=>setPwd(s=>({ ...s, password_confirmation:e.target.value }))}
                        />
                    </Field>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={changePwd}
                        disabled={pwdSaving}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {pwdSaving? 'Gönderiliyor…' : 'Şifreyi Güncelle'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function Field({label, children}:{label:string; children:React.ReactNode}){
    return (
        <div>
            <label className="block text-sm font-medium text-indigo-900 mb-1">{label}</label>
            {children}
        </div>
    );
}
