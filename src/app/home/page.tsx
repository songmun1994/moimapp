"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Plus, History, ChevronRight, Bell, X, Check } from "lucide-react";
import { getDueMeetingsAction, approveMeetingDuesAction } from "@/app/actions";

export default function Home() {
  const router = useRouter();
  const [recentMeetings, setRecentMeetings] = useState<{ id: string; name: string; cover?: string }[]>([]);
  const [dueMeetings, setDueMeetings] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("recent_meetings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setRecentMeetings(parsed);
      
      if (parsed.length > 0) {
        getDueMeetingsAction(parsed.map((m: any) => m.id)).then(dues => {
          const todayStr = new Date().toDateString();
          const filtered = dues.filter((d: any) => {
            return localStorage.getItem(`due_${d.public_token}_${todayStr}`) !== "true";
          });
          setDueMeetings(filtered);
        });
      }
    }
  }, []);

  const handleDismiss = (meeting: any) => {
    const todayStr = new Date().toDateString();
    localStorage.setItem(`due_${meeting.public_token}_${todayStr}`, "true");
    setDueMeetings(prev => prev.filter(m => m.id !== meeting.id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-toss-bg relative">
      <header className="px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-toss-text mb-8 leading-snug">어떤 모임을<br />정산할까요?</h1>
      </header>

      {/* 토스트 영역 */}
      {dueMeetings.length > 0 && (
        <div className="px-6 mb-4 flex flex-col gap-3 z-50">
          {dueMeetings.map(m => (
            <div key={m.id} className="bg-toss-blue text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="flex items-center gap-3">
                <Bell className="w-6 h-6 shrink-0 text-blue-200" />
                <div>
                  <p className="font-bold text-sm tracking-tight">{m.meeting_name}</p>
                  <p className="text-xs text-blue-100 font-medium">오늘 정기 회비 납부일입니다!</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push(`/${m.public_token}/dues-check`)} className="bg-white text-toss-blue p-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform whitespace-nowrap"><Check className="w-4 h-4 inline mr-1" />확인</button>
                <button onClick={() => handleDismiss(m)} className="p-2 text-blue-200 hover:text-white transition-colors active:scale-95"><X className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-6 flex-1 flex flex-col">

        <div
          onClick={() => router.push("/create")}
          className="toss-card flex items-center cursor-pointer mb-8 transform transition hover:scale-[1.02]"
        >
          <div className="bg-blue-50 p-4 rounded-2xl mr-4 flex-shrink-0">
            <Plus className="text-toss-blue w-8 h-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-toss-text">새 모임 만들기</h2>
            <p className="text-sm text-toss-text-secondary mt-1">여행, 회식, 스터디 정산 시작</p>
          </div>
          <ChevronRight className="text-gray-300 w-6 h-6" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-toss-text-secondary mb-4 flex items-center">
            <History className="w-4 h-4 mr-1" /> 최근 모임
          </h3>
          {recentMeetings.length > 0 ? (
            <div className="space-y-3">
              {recentMeetings.map((mtg, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/${mtg.id}/expenses`)}
                  className="bg-white p-5 rounded-2xl shadow-sm flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all relative"
                >
                  <div className="flex items-center gap-4">
                    {mtg.cover ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-gray-100 flex-shrink-0 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mtg.cover} alt="Cover" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 flex-shrink-0">
                        <Receipt className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <span className="font-semibold text-toss-text text-lg">{mtg.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-toss-blue text-sm font-bold bg-blue-50 px-3 py-1.5 rounded-lg">
                      내역 보기
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-toss-text-secondary text-sm">최근 진행한 정산이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
