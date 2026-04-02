"use client";
import React, { useRef, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Share, Download, CheckCircle2 } from "lucide-react";
import { toPng } from "html-to-image";
import { getMeetingAction, getExpensesAction } from "@/app/actions";

export default function InvoicePage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const [meeting, setMeeting] = useState<any>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const mtg = await getMeetingAction(params.meetingToken);
        const exps = await getExpensesAction(params.meetingToken);
        if (!mtg) {
          router.push("/home");
          return;
        }
        setMeeting(mtg);
        const sum = exps.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
        setTotalAmount(sum);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.meetingToken]);

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    try {
      const image = await toPng(invoiceRef.current, { backgroundColor: '#ffffff', pixelRatio: 3, cacheBust: true });
      const link = document.createElement("a");
      link.href = image;
      link.download = `정산서_${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("이미지 저장 중 오류가 발생했습니다.");
    }
  };

  const handleShareText = async () => {
    if (!meeting) return;
    const textToShare = `[${meeting.meeting_name} 정산 알림]\n\n💰 정산 부탁드립니다!\n- 예금주: ${meeting.account_holder}\n- 송금계좌: ${meeting.account_bank} ${meeting.account_number}\n\n잔액 확인하시고 입금 부탁드립니다!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '정산 공유',
          text: textToShare,
        });
      } catch (err) {
        console.log("공유를 취소했거나 지원하지 않는 브라우저입니다.", err);
      }
    } else {
      navigator.clipboard.writeText(textToShare);
      alert("정산 정보가 클립보드에 복사되었습니다! 카카오톡에 붙여넣기 하세요.");
    }
  };

  if (loading || !meeting) return <div className="flex bg-toss-bg w-full h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;

  const membersCount = meeting.members?.length || 1;
  const mockBase = Math.floor(totalAmount / membersCount);

  return (
    <div className="flex flex-col flex-1 bg-toss-bg min-h-screen pb-10 relative">
      <header className="p-4 flex items-center bg-transparent">
        <button onClick={() => router.push("/home")} className="p-2 absolute left-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="flex-1 text-center font-bold text-lg text-toss-text">청구서 발급</div>
      </header>

      <div className="p-6 flex flex-col items-center flex-1">
        <div className="flex flex-col items-center mb-8">
          <CheckCircle2 className="w-12 h-12 text-toss-blue mb-3" />
          <h2 className="text-xl font-bold text-toss-text">정산이 로컬 DB에 확정되었어요!</h2>
          <p className="text-toss-text-secondary text-sm font-medium mt-1">단톡방에 공유해서 입금을 요청해보세요.</p>
        </div>
        
        {/* Invoice Card to Capture */}
        <div 
          ref={invoiceRef} 
          className="bg-white rounded-[24px] shadow-lg shadow-gray-200/50 w-full max-w-sm p-8 pb-10 relative overflow-hidden ring-1 ring-gray-100"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-toss-blue"></div>
          
          <div className="text-center mt-4 mb-8">
            <h3 className="text-2xl font-extrabold text-toss-text tracking-tight break-words">{meeting.meeting_name}</h3>
            <p className="text-gray-400 font-bold text-sm mt-2">{new Date().toLocaleDateString('ko-KR')} 정산 완료 ({meeting.members.length}명)</p>
          </div>

          <div className="space-y-3.5 border-t border-dashed border-gray-200 pt-7">
            {meeting.members.map((member: any, index: number) => (
              <div key={member.id.toString()} className={`flex justify-between items-center p-4 rounded-xl ${index === 0 ? 'bg-blue-50/50 border border-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold ${index === 0 ? 'text-toss-blue' : 'text-gray-700'}`}>{member.name} {index === 0 && "(총무)"}</span>
                <span className={`font-extrabold tracking-tight text-lg ${index === 0 ? 'text-toss-blue' : 'text-toss-text'}`}>
                  {mockBase.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-gray-100 p-5 rounded-2xl text-center">
             <div className="inline-block bg-white text-gray-600 font-bold text-[11px] px-2.5 py-1 rounded mb-2 border border-gray-200 shadow-sm">
                송금 계좌
             </div>
            <p className="text-toss-blue font-extrabold text-xl tracking-tight mt-1">{meeting.account_bank} {meeting.account_number}</p>
            <p className="text-toss-text-secondary font-bold text-sm mt-1.5">예금주: {meeting.account_holder}</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3 w-full max-w-sm">
          <button 
            onClick={handleDownload}
            className="flex-1 py-4.5 bg-gray-800 text-white rounded-2xl font-bold flex items-center justify-center transition-transform active:scale-95 shadow-md text-[15px]"
          >
            <Download className="w-5 h-5 mr-1.5" /> 이미지 저장
          </button>
          <button 
             onClick={handleShareText}
            className="flex-[1.2] py-4.5 bg-[#FEE500] text-[#000000] rounded-2xl font-bold flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-yellow-500/20 text-[15px]"
          >
            <Share className="w-5 h-5 mr-1.5" /> 텍스트로 알리기
          </button>
        </div>
      </div>
    </div>
  );
}
