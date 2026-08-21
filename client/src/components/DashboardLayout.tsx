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
      <div className="ai-shell grid min-h-screen place-items-center bg-[var(--ai-ink)] text-[var(--ai-text)]">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--ai-text)]" />
          Menyiapkan ruang keuangan Anda…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="ai-shell relative grid min-h-screen place-items-center overflow-hidden bg-[var(--ai-ink)] px-5 py-10 text-[var(--ai-text)]">
        <div className="absolute -right-20 top-[-5rem] h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <section className="ai-login-card relative w-full max-w-md rounded-[2rem] border border-white/20 bg-[var(--ai-panel)] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--ai-text)] text-[var(--ai-ink)] shadow-lg shadow-black/30">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">LensaKeuangan</p>
              <p className="text-xs text-[var(--ai-muted)]">Catat lebih jernih, kendalikan lebih tenang.</p>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ai-muted)]">Ruang keuangan pribadi</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight">Semua pengeluaran Anda, tersusun dari satu foto struk.</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--ai-muted)]">Masuk untuk memindai struk, memeriksa hasil AI, dan menjaga transaksi Anda tetap privat.</p>
          <Button onClick={() => startLogin()} className="ai-primary mt-8 h-12 w-full rounded-xl text-sm font-bold">
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
    <div className="ai-shell min-h-screen bg-[var(--ai-ink)] text-[var(--ai-text)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/15 bg-[var(--ai-deep)] px-4 py-5 lg:flex">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 px-3 text-left" aria-label="Buka Dashboard">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--ai-text)] text-[var(--ai-ink)] shadow-[0_10px_24px_rgba(0,0,0,0.4)]">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight">LensaKeuangan</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ai-muted)]">Personal finance</p>
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
                  active ? "ai-nav-active text-white" : "text-[var(--ai-muted)] hover:bg-white/10 hover:text-[var(--ai-text)]"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : "text-[var(--ai-muted)] group-hover:text-white"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/15 bg-white/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[var(--ai-text)]">
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{userName}</p>
              <p className="text-xs text-[var(--ai-muted)]">Ruang pribadi</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[var(--ai-muted)]" />
          </div>
          <button onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-[var(--ai-muted)] transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="min-h-screen pb-24 lg:pl-[264px] lg:pb-0">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/15 bg-[var(--ai-ink)]/90 px-5 backdrop-blur lg:px-10">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 lg:hidden" aria-label="Buka Dashboard">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ai-text)] text-[var(--ai-ink)]"><WalletCards className="h-4 w-4" /></div>
            <span className="font-display text-sm font-bold">LensaKeuangan</span>
          </button>
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ai-muted)]">Ruang pribadi</p>
            <p className="mt-1 font-display text-sm font-bold">Catat, pahami, dan lanjutkan.</p>
          </div>
          <button onClick={() => setLocation("/scan")} className="ai-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[0.97]">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Scan struk</span>
            <span className="sm:hidden">Scan</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[76px] items-center justify-around border-t border-white/15 bg-[var(--ai-deep)]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigasi mobile">
        {navigation.map((item) => {
          const active = isCurrentPath(item.path, location);
          const Icon = item.icon;
          return (
            <button key={item.path} onClick={() => setLocation(item.path)} className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition ${active ? "text-white" : "text-[var(--ai-muted)]"}`}>
              <span className={`grid h-7 w-10 place-items-center rounded-xl ${active ? "bg-white/15" : ""}`}><Icon className="h-[18px] w-[18px]" /></span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
