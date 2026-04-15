"use client";
import React, { useRef, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Share, Download, Copy, Building2 } from "lucide-react";
import { toPng } from "html-to-image";
import { getMeetingAction } from "@/app/actions";

function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return count;
}

export default function AccountPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const targetDues = Number(meeting?.upfront_dues || 0);
  const animatedDues = useCountUp(targetDues, 1200);

  useEffect(() => {
    async function load() {
      try {
        const mtg = await getMeetingAction(params.meetingToken);
        if (!mtg) {
          router.push("/home");
          return;
        }
        setMeeting(mtg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.meetingToken]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const image = await toPng(cardRef.current, { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.href = image;
      link.download = `${meeting?.meeting_name}_계좌안내.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("이미지 저장에 실패했습니다.");
    }
  };

  const handleCopyText = () => {
    if (!meeting) return;
    const text = `[${meeting.meeting_name}] 모임 계좌 안내\n\n은행: ${meeting.account_bank}\n계좌번호: ${meeting.account_number}\n예금주: ${meeting.account_holder}\n\n사전 회비: ${Number(meeting.upfront_dues || 0).toLocaleString()}원\n\n회비를 미리 보내주시면 정산이 훨씬 수월해집니다!`;
    navigator.clipboard.writeText(text).then(() => {
      alert("계좌 정보가 클립보드에 복사되었습니다.");
    }).catch(err => {
      console.error(err);
      alert("복사에 실패했습니다.");
    });
  };

  const handleShare = async () => {
    if (!meeting) return;
    const text = `[${meeting.meeting_name}] 모임 계좌 안내\n\n은행: ${meeting.account_bank}\n계좌번호: ${meeting.account_number}\n예금주: ${meeting.account_holder}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '모임 정산 안내',
          text: text,
        });
      } catch (err) {
        console.error("Shared cancelled or failed", err);
      }
    } else {
      alert("이 브라우저에서는 공유 기능을 지원하지 않습니다. 텍스트 복사를 이용해주세요.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col flex-1 bg-gray-100 relative min-h-screen">
      <header className="p-4 flex items-center bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 absolute left-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="flex-1 text-center font-bold text-lg text-toss-text px-10 truncate">계좌 정보</div>
      </header>

      <div className="p-6 pb-32 flex flex-col items-center">
        {/* 명세서 카드 구역 */}
        <div 
          ref={cardRef}
          className="bg-white w-full max-w-[400px] rounded-3xl p-8 shadow-xl relative overflow-hidden mb-6 border border-gray-50"
        >
          {/* 상단 장식 */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-toss-blue"></div>
          
          <div className="text-center mb-8 mt-2">
            <h2 className="text-2xl font-extrabold text-toss-text mb-2 break-keep">{meeting.meeting_name}</h2>
            <p className="text-sm font-semibold text-toss-text-secondary bg-gray-50 inline-block px-3 py-1 rounded-full">모임 회비 입금 계좌</p>
          </div>

          <div className="bg-blue-50/50 rounded-2xl p-5 mb-6 border border-blue-100">
             <div className="flex items-center justify-center text-toss-blue mb-3 font-semibold w-full">
               <Building2 className="w-5 h-5 mr-2" />
               은행 정보
             </div>
             <div className="font-extrabold text-xl text-toss-text mb-1 tracking-tight text-center">{meeting.account_bank}</div>
             <div className="font-medium text-lg text-gray-600 font-mono tracking-wider text-center">{meeting.account_number}</div>
             <div className="font-semibold text-gray-500 mt-2 text-sm text-center">예금주: <span className="text-toss-text">{meeting.account_holder}</span></div>
          </div>

          {Number(meeting.upfront_dues) > 0 && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-4 border border-gray-100 text-center">
               <span className="text-sm font-semibold text-gray-400 block mb-1">1인당 납부해야 할 사전 회비</span>
               <span className="font-extrabold text-2xl text-toss-text tracking-tight">{animatedDues.toLocaleString()}원</span>
            </div>
          )}
          
          <div className="text-center mt-6 text-xs text-gray-400 font-medium">
            쉽고 빠른 정산앱
          </div>
        </div>

        <p className="text-sm text-gray-500 font-medium mb-6 text-center">아래 버튼으로 정보를 공유해보세요!</p>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[400px]">
           <button 
             onClick={handleCopyText}
             className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all text-toss-text hover:bg-gray-50"
           >
             <Copy className="w-5 h-5 mb-1.5 text-gray-600" />
             <span className="font-bold text-xs">텍스트 복사</span>
           </button>
           <button 
             onClick={handleDownload}
             className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all text-toss-text hover:bg-gray-50"
           >
             <Download className="w-5 h-5 mb-1.5 text-gray-600" />
             <span className="font-bold text-xs">이미지 저장</span>
           </button>
           <button 
             onClick={handleShare}
             className="flex flex-col items-center justify-center p-3 bg-toss-blue rounded-2xl shadow-sm active:scale-95 transition-all text-white hover:bg-blue-600"
           >
             <Share className="w-5 h-5 mb-1.5" />
             <span className="font-bold text-xs">공유하기</span>
           </button>
        </div>
      </div>
    </div>
  );
}
