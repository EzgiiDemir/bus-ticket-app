// app/dashboard/Company/account/page.tsx
'use client';
import { myAppHook } from '../../../../../../context/AppProvider';

export default function CompanyAccount(){
    const { user } = myAppHook() as any;
    return (
        <div className="space-y-4 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Hesabım</h1>
            <div className="rounded-2xl border bg-white p-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-4">
                    <div><div className="text-indigo-900/60">Ad</div><div className="font-medium">{user?.name}</div></div>
                    <div><div className="text-indigo-900/60">E-posta</div><div className="font-medium">{user?.email}</div></div>
                    <div><div className="text-indigo-900/60">Rol</div><div className="font-medium">{user?.role}</div></div>
                    <div><div className="text-indigo-900/60">Firma</div><div className="font-medium">{user?.company?.name}</div></div>
                </div>
            </div>
        </div>
    );
}
