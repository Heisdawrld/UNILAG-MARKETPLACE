'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.png" alt="UNILAG Marketplace" className="w-14 h-14 rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold">Join UNILAG Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">Create an account to start trading on campus</p>
        </div>

        {/* Clerk Sign-Up */}
        <div className="flex justify-center">
          <SignUp
            appearance={{
              elements: {
                rootBox: 'w-full',
                cardBox: 'w-full shadow-none',
                card: 'w-full shadow-sm border rounded-2xl',
                headerTitle: 'text-lg',
                formButtonPrimary: 'bg-[#6B1D2A] hover:bg-[#5a1824] text-white',
                footerActionLink: 'text-[#6B1D2A] hover:text-[#5a1824]',
              },
            }}
            forceRedirectUrl="/"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to the UNILAG Marketplace Terms of Service
        </p>
      </div>
    </div>
  );
}
