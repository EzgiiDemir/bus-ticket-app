'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { fmtTR } from '@/app/lib/datetime';

type Company = { id:number; name:string; code:string };
type User = {
    id:number; name:string; email:string; role:string; role_status?:string;
    company?: Company|null; created_at?:string; updated_at?:string;
};

export default function PassengerProfile() {
    const [user, setUser] = useState<User|null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/profile').then(r => setUser(r.data)).finally(()=>setLoading(false));
    }, []);

    if (loading) return <div>Yükleniyor…</div>;
    if (!user) return <div>Profil bulunamadı</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Profilim</h1>

            <div className="rounded-2xl border bg-white p-4 space-y-3">
                <Row label="Ad Soyad" value={user.name}/>
                <Row label="E-posta" value={user.email}/>
                <Row label="Rol" value={user.role}/>
                {user.company && (
                    <Row label="Şirket" value={`${user.company.name} (${user.company.code})`}/>
                )}
                {user.role_status && <Row label="Durum" value={user.role_status}/>}
                {user.created_at && <Row label="Kayıt Tarihi" value={fmtTR(user.created_at)}/>}
            </div>
        </div>
    );
}

function Row({label,value}:{label:string;value?:any}) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b last:border-0 py-2">
            <div className="text-sm text-indigo-900/60">{label}</div>
            <div className="text-sm font-medium text-indigo-900">{value ?? '-'}</div>
        </div>
    );
}
