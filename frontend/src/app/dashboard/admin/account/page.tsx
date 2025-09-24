'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

type Role = 'admin'|'personnel'|'passenger';
type User = {
    id:number;
    name:string;
    email:string;
    role:Role;
    role_status?: 'pending'|'active'|'rejected';
    company_id?: number|null;
};

type ProfileForm = { name:string; email:string };
type PwdForm = { current:string; password:string; password_confirmation:string };
type ProfileErrors = Partial<Record<keyof ProfileForm|'base', string>>;
type PwdErrors = Partial<Record<keyof PwdForm|'base', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PWD_RE   = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\S]{8,}$/;

export default function AdminAccountPage(){
    const { isLoading } = myAppHook() as any;

    const [me,setMe] = useState<User|null>(null);
    const [loading,setLoading] = useState(true);

    const [form,setForm] = useState<ProfileForm>({ name:'', email:'' });
    const [pfSaving,setPfSaving] = useState(false);
    const [pfErrs,setPfErrs] = useState<ProfileErrors>({});

    const [pwd,setPwd] = useState<PwdForm>({ current:'', password:'', password_confirmation:'' });
    const [pwSaving,setPwSaving] = useState(false);
    const [pwErrs,setPwErrs] = useState<PwdErrors>({});

    const canSaveProfile = useMemo(()=>{
        return form.name.trim().length>=2 && EMAIL_RE.test(form.email.trim());
    },[form]);

    const canSavePwd = useMemo(()=>{
        return !!pwd.current &&
            PWD_RE.test(pwd.password) &&
            pwd.password === pwd.password_confirmation;
    },[pwd]);

    const fieldCls = (hasErr:boolean) =>
        `w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 ${hasErr?'border-red-500':'border-gray-300'}`;

    const load = async ()=>{
        setLoading(true);
        setPfErrs({});
        setPwErrs({});
        try{
            const { data } = await axios.get<User>('/profile');
            setMe(data);
            setForm({ name: data.name || '', email: (data.email || '').toLowerCase() });
        }catch(e:any){
            setPfErrs({ base: e?.response?.data?.message || 'Profil alınamadı.' });
        }finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(!isLoading) load(); },[isLoading]);

    const saveProfile = async ()=>{
        // istemci doğrulama
        const errs: ProfileErrors = {};
        if (form.name.trim().length < 2) errs.name = 'Ad Soyad en az 2 karakter olmalı.';
        if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Geçerli e-posta girin.';
        setPfErrs(errs);
        if (Object.keys(errs).length) return;

        setPfSaving(true);
        try{
            await axios.put('/profile', { name: form.name.trim(), email: form.email.trim().toLowerCase() });
            setPfErrs({ base: 'Profil güncellendi.' });
            await load();
        }catch(e:any){
            const payload = e?.response?.data;
            const server: ProfileErrors = {};
            if (e?.response?.status===422 && payload?.errors) {
                Object.entries(payload.errors).forEach(([k, v])=>{
                    server[k as keyof ProfileForm] = Array.isArray(v) ? v[0] : String(v);
                });
            } else {
                server.base = payload?.message || 'Güncelleme hatası.';
            }
            setPfErrs(server);
        }finally{
            setPfSaving(false);
        }
    };

    const changePwd = async ()=>{
        // istemci doğrulama
        const errs: PwdErrors = {};
        if (!pwd.current) errs.current = 'Mevcut şifre zorunlu.';
        if (!PWD_RE.test(pwd.password)) errs.password = 'En az 8 karakter, harf+rakam içermeli.';
        if (pwd.password !== pwd.password_confirmation) errs.password_confirmation = 'Şifreler eşleşmiyor.';
        setPwErrs(errs);
        if (Object.keys(errs).length) return;

        setPwSaving(true);
        try{
            await axios.put('/password', {
                current_password: pwd.current,
                password: pwd.password,
                password_confirmation: pwd.password_confirmation
            });
            setPwErrs({ base: 'Şifre güncellendi.' });
            setPwd({ current:'', password:'', password_confirmation:'' });
        }catch(e:any){
            const payload = e?.response?.data;
            const server: PwdErrors = {};
            if (e?.response?.status===422 && payload?.errors) {
                Object.entries(payload.errors).forEach(([k, v])=>{
                    // backend alan adları eşlemesi
                    const map: Record<string, keyof PwdForm> = {
                        current_password:'current',
                        password:'password',
                        password_confirmation:'password_confirmation'
                    };
                    const key = map[k] ?? (k as keyof PwdForm);
                    server[key] = Array.isArray(v) ? v[0] : String(v);
                });
            } else {
                server.base = payload?.message || 'Şifre değiştirme hatası.';
            }
            setPwErrs(server);
        }finally{
            setPwSaving(false);
        }
    };

    if (loading) return <div className="p-6">Yükleniyor…</div>;
    if (!me)      return <div className="p-6 text-red-600">{pfErrs.base || 'Kullanıcı bulunamadı.'}</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <div>
                <h1 className="text-2xl font-bold">Hesabım</h1>
                <div className="text-sm text-indigo-900/60">Rol: <b className="text-indigo-900">{me.role}</b></div>
            </div>

            {/* Profil Bilgileri */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Profil Bilgileri</h2>

                {pfErrs.base && <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">{pfErrs.base}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Ad Soyad" error={pfErrs.name}>
                        <input
                            className={fieldCls(!!pfErrs.name)}
                            value={form.name}
                            onChange={e=>{ setForm(s=>({ ...s, name:e.target.value })); if (pfErrs.name) setPfErrs(p=>({ ...p, name: undefined })); }}
                            required
                            minLength={2}
                            aria-invalid={!!pfErrs.name}
                            aria-describedby="name-err"
                        />
                    </Field>

                    <Field label="E-posta" error={pfErrs.email} errId="email-err">
                        <input
                            className={fieldCls(!!pfErrs.email)}
                            value={form.email}
                            onChange={e=>{ setForm(s=>({ ...s, email:e.target.value })); if (pfErrs.email) setPfErrs(p=>({ ...p, email: undefined })); }}
                            required
                            type="email"
                            pattern={EMAIL_RE.source}
                            aria-invalid={!!pfErrs.email}
                            aria-describedby="email-err"
                        />
                    </Field>
                </div>

                <div className="mt-3 flex justify-end">
                    <button
                        onClick={saveProfile}
                        disabled={pfSaving || !canSaveProfile}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {pfSaving? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                </div>
            </section>

            {/* Şifre Değiştir */}
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-3">Şifre Değiştir</h2>

                {pwErrs.base && <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">{pwErrs.base}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Mevcut Şifre" error={pwErrs.current} errId="cur-err">
                        <input
                            type="password"
                            className={fieldCls(!!pwErrs.current)}
                            value={pwd.current}
                            onChange={e=>{ setPwd(s=>({ ...s, current:e.target.value })); if (pwErrs.current) setPwErrs(p=>({ ...p, current: undefined })); }}
                            required
                            aria-invalid={!!pwErrs.current}
                            aria-describedby="cur-err"
                        />
                    </Field>
                    <Field label="Yeni Şifre" error={pwErrs.password} errId="pwd-err">
                        <input
                            type="password"
                            className={fieldCls(!!pwErrs.password)}
                            value={pwd.password}
                            onChange={e=>{ setPwd(s=>({ ...s, password:e.target.value })); if (pwErrs.password) setPwErrs(p=>({ ...p, password: undefined })); }}
                            required
                            pattern={PWD_RE.source}
                            aria-invalid={!!pwErrs.password}
                            aria-describedby="pwd-err"
                            placeholder="En az 8 karakter, harf+rakam"
                        />
                    </Field>
                    <Field label="Yeni Şifre (Tekrar)" error={pwErrs.password_confirmation} errId="pwd2-err">
                        <input
                            type="password"
                            className={fieldCls(!!pwErrs.password_confirmation)}
                            value={pwd.password_confirmation}
                            onChange={e=>{ setPwd(s=>({ ...s, password_confirmation:e.target.value })); if (pwErrs.password_confirmation) setPwErrs(p=>({ ...p, password_confirmation: undefined })); }}
                            required
                            aria-invalid={!!pwErrs.password_confirmation}
                            aria-describedby="pwd2-err"
                        />
                    </Field>
                </div>

                <div className="mt-3 flex justify-end">
                    <button
                        onClick={changePwd}
                        disabled={pwSaving || !canSavePwd}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {pwSaving? 'Gönderiliyor…' : 'Şifreyi Güncelle'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function Field({
                   label, children, error, errId
               }:{label:string; children:React.ReactNode; error?:string; errId?:string}){
    return (
        <div>
            <label className="block text-sm font-medium text-indigo-900 mb-1">{label}</label>
            {children}
            {error && <p id={errId} className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
