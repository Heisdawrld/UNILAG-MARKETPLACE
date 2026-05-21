'use client';
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf4 100%)', padding: '1rem' }}>
      <img src="/logo.png" alt="UNILAG" style={{ width: 56, height: 56, borderRadius: 16, marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
      <h1 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>UNILAG Marketplace</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Sign in to buy, sell &amp; run errands on campus</p>
      <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" />
      <p style={{ fontSize: 11, color: '#999', marginTop: 16 }}>By signing in, you agree to the UNILAG Marketplace Terms of Service</p>
    </div>
  );
}
