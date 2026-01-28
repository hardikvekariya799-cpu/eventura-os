// app/finance/layout.tsx
import React from "react";

export const metadata = {
  title: "Finance • Eventura OS",
  description: "Eventura OS Finance",
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen bg-[#070707] text-white">
      {/* Finance-only layout wrapper */}
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4">
        {children}
      </div>
    </section>
  );
}