'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const userId = searchParams.get('user_id');

    if (userId) {
      // Fetch user info and store
      authApi.getUser(userId)
        .then((user) => {
          setUser(user);
          router.push('/repos');
        })
        .catch((error) => {
          console.error('Failed to fetch user:', error);
          router.push('/?error=auth_failed');
        });
    } else {
      router.push('/?error=no_user_id');
    }
  }, [searchParams, setUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
