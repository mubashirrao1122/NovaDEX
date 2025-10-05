import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  // Navigation items
  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Swap', href: '/swap' },
    { name: 'Pools', href: '/pool' },
    { name: 'Trade', href: '/trading' },
  ];

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        {/* Modern header with Jupiter-inspired design */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg group-hover:scale-105 transition-transform">
                    <span className="text-lg font-bold text-black">N</span>
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    NovaDex
                  </span>
                </Link>
                <nav className="hidden md:flex">
                  <ul className="flex gap-1">
                    {navItems.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-accent/50',
                            router.pathname === item.href
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <button className="btn-primary text-sm shadow-lg hover:shadow-xl hover:shadow-primary/25">
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content with improved spacing */}
        <main className="container mx-auto px-6 py-8 min-h-[calc(100vh-200px)]">
          {children}
        </main>
        
        {/* Modern footer */}
        <footer className="border-t border-border/50 bg-card/50">
          <div className="container mx-auto px-6 py-12">
            <div className="grid gap-8 md:grid-cols-4">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg">
                    <span className="text-lg font-bold text-black">N</span>
                  </div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    NovaDex
                  </span>
                </div>
                <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
                  The next-generation DEX on Solana. Trade with confidence using advanced perpetuals, 
                  lightning-fast swaps, and capital-efficient liquidity pools.
                </p>
                <p className="text-xs text-muted-foreground">
                  &copy; {new Date().getFullYear()} NovaDex. All rights reserved.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Products</h4>
                <div className="space-y-3">
                  <Link href="/swap" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Swap</Link>
                  <Link href="/pool" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Liquidity</Link>
                  <Link href="/trading" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Perpetuals</Link>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Resources</h4>
                <div className="space-y-3">
                  <Link href="#" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Documentation</Link>
                  <Link href="#" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Terms</Link>
                  <Link href="#" className="block text-sm text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
