"use client";

export default function Footer(){
    return (
        <footer className="bg-neutral-900 text-neutral-200 mt-12">
            <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
                <div>
                    <div className="text-xl font-semibold">BusX</div>
                    <p className="text-sm text-neutral-400 mt-2">Türkiye genelinde otobüs bileti.</p>
                </div>
                <div>
                    <div className="font-semibold">İletişim</div>
                    <ul className="text-sm text-neutral-300 mt-2 space-y-1">
                        <li>Adres: Girne, Kıbrıs</li>
                        <li>Tel: +90 5xx xxx xx xx</li>
                        <li>E-posta: support@busx.app</li>
                    </ul>
                </div>
                <div>
                    <div className="font-semibold">Hızlı Linkler</div>
                    <ul className="text-sm text-neutral-300 mt-2 space-y-1">
                        <li><a href="/auth">Giriş / Kayıt</a></li>
                        <li><a href="/dashboard/passenger">Yolcu Paneli</a></li>
                        <li><a href="/dashboard/personnel">Personel Paneli</a></li>
                    </ul>
                </div>
                <div>
                    <div className="font-semibold">Yasal</div>
                    <ul className="text-sm text-neutral-300 mt-2 space-y-1">
                        <li><a href="/kvkk">KVKK</a></li>
                        <li><a href="/terms">Kullanım Şartları</a></li>
                        <li><a href="/privacy">Gizlilik</a></li>
                    </ul>
                </div>
            </div>
            <div className="text-center text-neutral-400 text-sm py-4 border-t border-neutral-800">
                © {new Date().getFullYear()} BusX. Tüm hakları saklıdır.
            </div>
        </footer>
    );
}
