"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckCircle2, Circle, Home } from "lucide-react";
import { getMeetingAction, approveMeetingDuesAction } from "@/app/actions";

export default function DuesCheckPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const mtg = await getMeetingAction(params.meetingToken);
        if (!mtg) {
          router.push("/home");
          return;
        }
        setMeeting(mtg);
        // Initialize all as unchecked
        const initial: Record<string, boolean> = {};
        mtg.members.forEach((m: any) => {
          initial[m.id] = false;
        });
        setChecked(initial);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.meetingToken, router]);

  const handleToggle = (id: string) => {
    const nextState = { ...checked, [id]: !checked[id] };
    setChecked(nextState);

    // 모두 체크되었는지 비동기 평가 (nextState 기준)
    const allChecked = meeting.members.every((m: any) => nextState[m.id]);
    if (allChecked) {
      setTimeout(() => {
        if (confirm("모든 멤버가 입금했습니다. 완료 처리 하겠습니까?")) {
          submit(nextState);
        }
      }, 100);
    }
  };

  const submit = async (stateObj: Record<string, boolean>) => {
    if (submitting) return;
    setSubmitting(true);
    
    const checkedCount = meeting.members.filter((m: any) => stateObj[m.id]).length;
    
    // 만약 한 명도 체크되지 않은 상태에서 버튼을 강제로 열었다면 예외처리
    if (checkedCount === 0) {
      alert("입금한 멤버가 없습니다.");
      setSubmitting(false);
      return;
    }

    try {
      await approveMeetingDuesAction(params.meetingToken, checkedCount);
      
      // 알림 다시 안 뜨게 일일 로컬 스토리지 무효화 처리
      const todayStr = new Date().toDateString();
      localStorage.setItem(`due_${params.meetingToken}_${todayStr}`, "true");
      
      alert(`완료처리 되었습니다. (+${(Number(meeting.upfront_dues) * checkedCount).toLocaleString()}원 누적)`);
      router.replace(`/${params.meetingToken}/expenses`);
    } catch (e) {
      console.error(e);
      alert("처리 중 에러가 발생했습니다.");
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;

  const duesPerPerson = Number(meeting?.upfront_dues || 0);
  const checkedMembersCount = Object.values(checked).filter(Boolean).length;
  const totalMembersCount = meeting?.members?.length || 0;

  return (
    <div className="flex flex-col flex-1 bg-toss-bg relative min-h-screen pb-32">
      <header className="p-4 flex items-center bg-white border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 absolute left-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="flex-1 text-center font-bold text-lg text-toss-text">정기 회비 입금 체크</div>
        <button onClick={() => router.push('/home')} className="p-2 absolute right-2">
          <Home className="w-5 h-5 text-toss-text-secondary" />
        </button>
      </header>

      <div className="p-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center mb-8">
          <span className="text-gray-500 font-bold mb-2">1인당 입금해야 할 회비</span>
          <span className="text-3xl font-extrabold text-toss-blue tracking-tight">{duesPerPerson.toLocaleString()}원</span>
        </div>

        <h3 className="font-bold text-toss-text text-lg mb-4 ml-1">구성원 목록 <span className="text-gray-400 text-sm font-medium ml-2">({checkedMembersCount}/{totalMembersCount})</span></h3>
        
        <div className="flex flex-col gap-3">
          {meeting?.members.map((m: any) => (
            <div 
              key={m.id}
              onClick={() => handleToggle(m.id)}
              className={`flex items-center justify-between bg-white px-5 py-4 rounded-2xl shadow-sm border-2 transition-all cursor-pointer active:scale-[0.98] ${checked[m.id] ? 'border-toss-blue bg-blue-50/10' : 'border-transparent'}`}
            >
              <span className={`font-bold text-lg ${checked[m.id] ? 'text-toss-blue' : 'text-toss-text'}`}>{m.name}</span>
              {checked[m.id] ? (
                <CheckCircle2 className="w-7 h-7 text-toss-blue" />
              ) : (
                <Circle className="w-7 h-7 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-white via-white to-transparent pt-10">
        <button 
          disabled={checkedMembersCount === 0 || submitting}
          onClick={() => submit(checked)} 
          className="w-full py-4.5 bg-toss-blue text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 disabled:bg-gray-300 disabled:shadow-none transition-all active:scale-[0.98] active:bg-blue-600 text-lg"
        >
          {submitting ? "처리 중..." : `${checkedMembersCount}명 완료 처리하기`}
        </button>
      </div>
    </div>
  );
}
