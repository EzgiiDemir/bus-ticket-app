'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

type User = {
    id:number; name:string; email:string; phone?:string|null;
    role:'passenger'|'personnel'|'admin'; company?:{id:number;name:string;code:string}|null;
};

export default function AccountPage(){
    const { isLoading, token } = myAppHook() as any;
    const [me,setMe]=useState<User|null>(null);
    const [loading,setLoading]=useState(true);
    const [err,setErr]=useState('');

    // forms
    const [profile,setProfile]=useState({ name:'', email:'', phone:'' });
    const [pwd,setPwd]=useState({ current_password:'', password:'', password_confirmation:'' });

    useEffect(()=>{
        if (isLoading) return;
        if (!token) { setLoading(false); return; }
        axios.get<User>('/profile').then(({data})=>{
            setMe(data);
            setProfile({ name:data.name||'', email:data.email||'', phone:(data as any).phone||'' });
        }).catch(e=> setErr(e?.response?.data?.message||'Hata')).finally(()=>setLoading(false));
    },[isLoading, token]);

    const saveProfile=async()=>{
        try{
            await axios.put('/me', profile);
            alert('Profil güncellendi');
        }catch(e:any){
            alert(e?.response?.data?.message||'Kayıt hatası');
        }
    };
    const changePwd=async()=>{
        try{
            await axios.put('/me/password', pwd);
            setPwd({ current_password:'', password:'', password_confirmation:'' });
            alert('Şifre güncellendi');
        }catch(e:any){
            const m = e?.response?.data?.message
                || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join('\n'))
                || 'Şifre güncellenemedi';
            alert(m);
        }
    };

    if (loading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (err) return <div className="p-6 text-red-600">{err}</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold">Hesabım</h1>

            {/* Özet kartı */}
            <div className="rounded-2xl border bg-white p-4 grid sm:grid-cols-2 gap-3">
                <div>
                    <div className="text-xs text-indigo-900/60">Ad Soyad</div>
                    <div className="font-semibold">{me?.name}</div>
                </div>
                <div>
                    <div className="text-xs text-indigo-900/60">E-posta</div>
                    <div className="font-semibold">{me?.email}</div>
                </div>
                <div>
                    <div className="text-xs text-indigo-900/60">Rol</div>
                    <div className="font-semibold capitalize">{me?.role}</div>
                </div>
                <div>
                    <div className="text-xs text-indigo-900/60">Şirket</div>
                    <div className="font-semibold">{me?.company ? `${me.company.name} (${me.company.code})` : '-'}</div>
                </div>
            </div>

        </div>
    );
}

function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){
    return (
        <div>
            <label className="block text-sm text-indigo-900/70 mb-1">{label}</label>
            <input className="w-full rounded-xl border px-3 py-2" type={type} value={value} onChange={e=>onChange(e.target.value)} />
        </div>
    );
}
