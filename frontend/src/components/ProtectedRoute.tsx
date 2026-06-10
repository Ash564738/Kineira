import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import PageState from './ui/PageState';
import { useToast } from './ui/ToastProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      showToast('Please log in to continue.', 'info');
      router.replace(`${redirectTo}?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [user, loading, redirectTo, router, showToast]);

  if (loading) {
    return <PageState type="loading" message="Checking your session..." />;
  }

  if (!user) return null;

  if (requireAdmin && !user.is_admin) {
    return (
      <PageState
        type="forbidden"
        title="Admin area"
        message="Data collection and model training are reserved for admins."
        actionHref="/"
        actionLabel="Back to home"
      />
    );
  }

  return <>{children}</>;
}
