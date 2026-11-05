'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { role, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) return;

    switch (role) {
      case 'FRONT_DESK':
        router.push('/front-desk/check-in');
        break;
      case 'MECHANIC':
        router.push('/mechanic/diagnostics');
        break;
      case 'WAREHOUSE':
        router.push('/warehouse/inventory');
        break;
      case 'SALES':
        router.push('/sales/counter');
        break;
      case 'MANAGER':
        router.push('/admin/dashboard');
        break;
      default:
        router.push('/login');
        break;
    }
  }, [role, isInitialized, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium">กำลังเข้าสู่ระบบและนำทางสู่พอร์ทัล...</p>
    </div>
  );
}
