'use client';

import { myAppHook } from '../../../../../context/AppProvider';
import {Users } from 'lucide-react';

export default function AdminAdminsPage() {
    const { token, isLoading, user } = myAppHook() as any;


    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role !== 'admin') return <div className="p-6">Yetkisiz.</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <div className="flex items-center gap-3">
                <Users size={20} />
                <h1 className="text-2xl font-bold">Yöneticiler & Yönetim Paneli</h1>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold">Oturum Açan Yönetici</h2>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                        <div className="text-xs text-indigo-900/60">ID</div>
                        <div>{user.id}</div>
                    </div>
                    <div>
                        <div className="text-xs text-indigo-900/60">Ad</div>
                        <div>{user.name}</div>
                    </div>
                    <div>
                        <div className="text-xs text-indigo-900/60">E-posta</div>
                        <div>{user.email}</div>
                    </div>
                    <div>
                        <div className="text-xs text-indigo-900/60">Rol</div>
                        <div>{String(user.role)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-indigo-900/60">Durum</div>
                        <div>{user.role_status ?? '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-indigo-900/60">Firma</div>
                        <div>{user.company?.name ?? '-'}</div>
                    </div>
                </div>
            </div>

        </div>
    );
}
