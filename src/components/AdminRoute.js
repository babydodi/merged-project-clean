// src/components/AdminRoute.js
'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    router.push('/unauthorized');
    return null;
  }

  return <>{children}</>;
}
