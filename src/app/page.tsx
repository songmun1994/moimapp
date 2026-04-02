"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

export default function GatePage() {
  const router = useRouter();

  useEffect(() => {
    // 1.5초 딜레이 후 메인으로 자동 전환 (뒤로가기 방지를 위해 replace 사용)
    const timer = setTimeout(() => {
      router.replace("/home");
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center">
      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <div className="w-20 h-20 bg-toss-blue rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30">
          <Receipt className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-toss-text tracking-tight">쉽고 빠른 정산앱</h1>
        <p className="text-toss-text-secondary mt-3 font-medium">총무의 짐을 덜어드립니다</p>
      </div>
    </div>
  );
}
