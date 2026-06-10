import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '../styles/globals.css';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../components/ui/ToastProvider';

export default function MyApp({ Component, pageProps }: AppProps) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <ToastProvider>
            <Component {...pageProps} />
          </ToastProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
}