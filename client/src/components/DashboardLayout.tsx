import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  Camera,
  ChevronDown,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings2,
  WalletCards,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Scan", path: "/scan", icon: Camera },
  { label: "Transaksi", path: "/transaksi", icon: ReceiptText },
  { label: "Pengaturan", path: "/pengaturan", icon: Settings2 },
] as const;

function isCurrentPath(path: string, location: string) {
  return path === "/" ? location === "/" : location.startsWith(path);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="ai-shell grid min-h-screen place-items-center bg-[#f7f5ef] text-[#163d32]">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#e85d48]" />
          Menyiapkan ruang keuangan Anda…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="ai-shell relative grid min-h-screen place-items-center overflow-hidden bg-[#f7f5ef] px-5 py-10 text-[#163d32]">
        <div className="absolute -right-20 top-[-5rem] h-72 w-72 rounded-full bg-[#d9efdf] blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-[#f9c8ac]/60 blur-3xl" />
        <section className="ai-login-card relative w-full max-w-md rounded-[2rem] border border-[#e8e2d7] bg-white/80 p-8 shadow-[0_24px_70px_rgba(27,54,44,0.12)] backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#163d32] text-white shadow-lg shadow-[#163d32]/20">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">LensaKeuangan</p>
              <p className="text-xs text-[#6d756e]">Catat lebih jernih, kendalikan lebih tenang.</p>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e85d48]">Ruang keuangan pribadi</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">Semua pengeluaran Anda, tersusun dari satu foto struk.</h1>
          <p className="mt-4 text-sm leading-6 text-[#68736c]">Masuk untuk memindai struk, memeriksa hasil AI, dan menjaga transaksi Anda tetap privat.</p>
          <Button onClick={() => startLogin()} className="ai-primary mt-8 h-12 w-full rounded-xl bg-[#163d32] text-sm font-bold hover:bg-[#245143]">
            Masuk ke LensaKeuangan
          </Button>
        </section>
      </main>
    );
  }

  return <AuthenticatedDashboard userName={user.name || "Pengguna"}>{children}</AuthenticatedDashboard>;
}

function AuthenticatedDashboard({ children, userName }: { children: React.ReactNode; userName: string }) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="ai-shell min-h-screen bg-[#f7f5ef] text-[#163d32]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-[#dfe5dc] bg-[#fbfaf6] px-4 py-5 lg:flex">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 px-3 text-left" aria-label="Buka Dashboard">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#163d32] text-white shadow-[0_10px_24px_rgba(22,61,50,0.2)]">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight">LensaKeuangan</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#e85d48]">Personal finance</p>
          </div>
        </button>

        <nav className="mt-10 space-y-1" aria-label="Navigasi utama">
          {navigation.map((item) => {
            const active = isCurrentPath(item.path, location);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${
                  active ? "ai-nav-active bg-[#163d32] text-white shadow-[0_8px_20px_rgba(22,61,50,0.16)]" : "text-[#617068] hover:bg-[#eaf1e8] hover:text-[#163d32]"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-[#f5be73]" : "text-[#799087] group-hover:text-[#e85d48]"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#e5ebe3] bg-[#f1f5ee] p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9efdf] text-[#163d32]">
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{userName}</p>
              <p className="text-xs text-[#6d756e]">Ruang pribadi</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#6d756e]" />
          </div>
          <button onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-[#6d756e] transition hover:bg-white hover:text-[#e85d48]">
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="min-h-screen pb-24 lg:pl-[264px] lg:pb-0">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e5e8e2]/80 bg-[#f7f5ef]/90 px-5 backdrop-blur lg:px-10">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 lg:hidden" aria-label="Buka Dashboard">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#163d32] text-white"><WalletCards className="h-4 w-4" /></div>
            <span className="font-display text-sm font-bold">LensaKeuangan</span>
          </button>
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#89948c]">Ruang pribadi</p>
            <p className="mt-1 font-display text-sm font-bold">Catat, pahami, dan lanjutkan.</p>
          </div>
          <button onClick={() => setLocation("/scan")} className="ai-primary inline-flex h-10 items-center gap-2 rounded-xl bg-[#e85d48] px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(232,93,72,0.22)] transition hover:bg-[#d74f3a] active:scale-[0.97]">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan struk</span>
            <span className="sm:hidden">Scan</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[76px] items-center justify-around border-t border-[#dfe5dc] bg-[#fbfaf6]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigasi mobile">
        {navigation.map((item) => {
          const active = isCurrentPath(item.path, location);
          const Icon = item.icon;
          return (
            <button key={item.path} onClick={() => setLocation(item.path)} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition ${active ? "text-[#163d32]" : "text-[#8a958d]"}`}>
              <span className={`grid h-7 w-10 place-items-center rounded-xl ${active ? "bg-[#d9efdf]" : ""}`}><Icon className="h-[18px] w-[18px]" /></span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
