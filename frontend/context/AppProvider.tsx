"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";

type Role = "passenger" | "personnel" | "admin";
type User = {
    id: number;
    name: string;
    email: string;
    role: Role;
    role_status?: "pending" | "active" | "rejected";
    company_id?: number | null;
};
type AuthResp = { status?: boolean; message?: string; token?: string; user?: User };

interface AppProviderType {
    isLoading: boolean;
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string,
        password_confirmation: string,
        role: Role
    ) => Promise<void>;
    logout: () => void;
}

const AppContext = createContext<AppProviderType | undefined>(undefined);


axios.defaults.baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/,'');

export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    const setAuthHeader = (t?: string) => {
        if (t) axios.defaults.headers.common["Authorization"] = `Bearer ${t}`;
        else delete axios.defaults.headers.common["Authorization"];
    };

    const goByRole = (role: Role) => {
        if (role === "admin") router.push("/dashboard/admin");
        else if (role === "personnel") router.push("/dashboard/personnel");
        else router.push("/dashboard/passenger");
    };
    useEffect(()=>{
        axios.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL;
        if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        else delete axios.defaults.headers.common['Authorization'];
    }, [token]);

    useEffect(() => {
        const id = axios.interceptors.response.use(
            (r) => r,
            (err) => {
                if (err?.response?.status === 401) {
                    Cookies.remove("authToken");
                    Cookies.remove("authUser");
                    setToken(null);
                    setUser(null);
                    setAuthHeader(undefined);
                    if (!location.pathname.startsWith("/auth")) router.push("/auth");
                }
                return Promise.reject(err);
            }
        );
        return () => axios.interceptors.response.eject(id);
    }, [router]);

    useEffect(() => {
        (async () => {
            const t = Cookies.get("authToken");
            const u = Cookies.get("authUser");
            if (!t) {
                setIsLoading(false);
                return;
            }
            setToken(t);
            setAuthHeader(t);

            if (u) {
                try {
                    setUser(JSON.parse(u) as User);
                } catch {
                    Cookies.remove("authUser");
                }
            }

            try {
                const { data } = await axios.get<User>("/profile");
                setUser(data);
                Cookies.set("authUser", JSON.stringify(data), { expires: 7, sameSite: "lax" });
            } catch {
                Cookies.remove("authToken");
                Cookies.remove("authUser");
                setToken(null);
                setUser(null);
                setAuthHeader(undefined);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            Cookies.remove("authToken");
            Cookies.remove("authUser");
            setAuthHeader(undefined);

            const { data } = await axios.post<AuthResp>("/login", { email, password }, { headers: { Accept: "application/json" } });
            if (!data?.token || !data?.user) {
                toast.error(data?.message || "Giriş başarısız");
                return;
            }

            setToken(data.token);
            setUser(data.user);
            setAuthHeader(data.token);
            Cookies.set("authToken", data.token, { expires: 7, sameSite: "lax" });
            Cookies.set("authUser", JSON.stringify(data.user), { expires: 7, sameSite: "lax" });
            toast.success("Giriş başarılı");
            goByRole(data.user.role);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Giriş hatası");
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (
        name: string,
        email: string,
        password: string,
        password_confirmation: string,
        role: Role,
        company_id?: number
    ) => {
        setIsLoading(true);
        try {
            await axios.post("/register", {
                name,
                email,
                password,
                password_confirmation,
                role,
                company_id,
            });
            toast.success(
                role === "personnel"
                    ? "Kayıt alındı. Personel onayı bekleniyor."
                    : "Kayıt başarılı. Lütfen giriş yapın."
            );
            router.push("/auth?mode=login");
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            if (err?.response?.status === 403 && msg?.includes("Personel")) {
                toast.error(
                    "Personel başvurunuz onay bekliyor. Admin onayından sonra giriş yapın."
                );
                router.push("/auth?mode=login");
                return;
            }
            toast.error(msg || "Kayıt hatası");
        } finally {
            setIsLoading(false);
        }
    };


    const logout = () => {
        setToken(null);
        setUser(null);
        Cookies.remove("authToken");
        Cookies.remove("authUser");
        setAuthHeader(undefined);
        axios.get("/logout").catch(() => {});
        toast.success("Çıkış yapıldı");
        router.push("/auth");
    };

    return (
        <AppContext.Provider value={{ isLoading, user, token, login, register, logout }}>
            {children}
            {isLoading && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
            )}
        </AppContext.Provider>
    );
}

export const myAppHook = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used within <AppProvider>");
    return ctx;
};
