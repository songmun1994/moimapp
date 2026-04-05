"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Share2, Copy } from "lucide-react";
import * as htmlToImage from "html-to-image";

export default function ReceiptPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(`settle_${params.meetingToken}`);
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    } else {
      alert("정산 데이터가 없습니다. 다시 정산해주세요.");
      router.push(`/${params.meetingToken}/settle`);
    }
  }, [params.meetingToken, router]);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await htmlToImage.toPng(receiptRef.current, { cacheBust: true, pixelRatio: 2 });
      
      const link = document.createElement('a');
      link.download = `정산내역_${data.meetingName || '모임'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert("영수증 이미지 생성에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = async () => {
    if (!data) return;
    
    let text = `[${data.meetingName} 정산 안내]\n\n`;
    
    const sendingMembers = data.memberStates.filter((m: any) => (m.base + m.adjusted - m.paid) > 0);
    const refundMembers = data.memberStates.filter((m: any) => (m.base + m.adjusted - m.paid) < 0);
    
    text += `💰 지출 총액: ${data.totalAmount.toLocaleString()}원\n\n`;

    if (sendingMembers.length > 0) {
      text += `[보내주실 분]\n`;
      sendingMembers.forEach((m: any) => {
        text += `- ${m.name}: ${(m.base + m.adjusted - m.paid).toLocaleString()}원\n`;
      });
      text += `\n`;
    }
    
    if (refundMembers.length > 0) {
      text += `[돌려받으실 분]\n`;
      refundMembers.forEach((m: any) => {
        text += `- ${m.name}: ${Math.abs(m.base + m.adjusted - m.paid).toLocaleString()}원\n`;
      });
      text += `\n`;
    }

    if (data.bankInfo?.account) {
      text += `🏦 정산 계좌\n`;
      text += `${data.bankInfo.bank} ${data.bankInfo.account} (${data.bankInfo.holder})`;
    }

    try {
      await navigator.clipboard.writeText(text);
      alert("정산 텍스트가 클립보드에 복사되었습니다. 카카오톡 등에 붙여넣기 하세요!");
    } catch(e) {
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  if (!data) return <div className="flex h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col flex-1 bg-[#F9FAFB] relative min-h-screen">
      <header className="p-4 flex items-center bg-white border-b border-gray-100 justify-between sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="text-center font-bold text-lg text-toss-text">정산 영수증 공유</div>
        <div className="w-10"></div>
      </header>

      <div className="p-6 pb-32 flex flex-col items-center">
        {/* Receipt Container */}
        <div 
          ref={receiptRef}
          className="bg-white w-full max-w-[400px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-8 relative overflow-hidden"
          style={{
            // CSS for receipt border
            borderRadius: '4px',
            borderTop: '2px dashed #E5E7EB',
            borderBottom: '2px dashed #E5E7EB'
          }}
        >
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">{data.meetingName}</h1>
            <p className="text-gray-500 font-medium text-sm">정산 영수증</p>
            <p className="text-gray-400 text-xs mt-1">{today}</p>
          </div>

          {/* Totals */}
          <div className="space-y-3 mb-8">
            <div className="flex justify-between font-bold text-gray-600">
              <span>총 모인 금액</span>
              <span>{Math.max(data.totalPot, 0).toLocaleString()} 원</span>
            </div>
            <div className="flex justify-between font-bold text-gray-600">
              <span>총 지출 금액</span>
              <span>{data.totalAmount.toLocaleString()} 원</span>
            </div>
            <div className="flex justify-between text-lg font-extrabold text-gray-900 pt-3 border-t border-gray-100">
              <span>남은 공금</span>
              <span className={data.remainingPot > 0 ? 'text-toss-blue' : ''}>{data.remainingPot.toLocaleString()} 원</span>
            </div>
          </div>

          {/* Individual Breakdowns */}
          <div className="mb-8 relative space-y-4">
            <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-gray-200 -z-10" />
            
            <h3 className="font-extrabold text-gray-900 bg-white inline-block pr-4">멤버별 상세 정산</h3>
            
            <div className="space-y-3 pt-2">
              {data.memberStates.map((m: any, i: number) => {
                const finalAmt = m.base + m.adjusted - m.paid;
                return (
                  <div key={i} className="flex justify-between items-center text-sm font-semibold text-gray-700 bg-gray-50/50 p-2 rounded-lg">
                    <div className="flex items-center">
                      <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs mr-2">{m.name.substring(0,1)}</span>
                      <span>{m.name}</span>
                    </div>
                    {finalAmt > 0 ? (
                       <span className="text-red-500 font-bold tracking-tight">추가 송금 +{finalAmt.toLocaleString()}원</span>
                    ) : finalAmt < 0 ? (
                       <span className="text-toss-blue font-bold tracking-tight">환급받기 {Math.abs(finalAmt).toLocaleString()}원</span>
                    ) : (
                       <span className="text-gray-400">정산 완료</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Account Info */}
          {data.bankInfo?.account && (
            <div className="bg-gray-100/80 p-4 rounded-xl text-center">
              <span className="block text-xs font-bold text-gray-500 mb-1">총무 계좌번호</span>
              <span className="block font-bold text-gray-900 mb-1">{data.bankInfo.bank} {data.bankInfo.account}</span>
              <span className="block text-sm text-gray-500">예금주: {data.bankInfo.holder}</span>
            </div>
          )}

          {/* Bottom barcode decoration */}
          <div className="mt-8 flex justify-center opacity-20">
             <div className="w-1 h-8 bg-black mx-px"></div>
             <div className="w-2 h-8 bg-black mx-px"></div>
             <div className="w-1 h-8 bg-black mx-px"></div>
             <div className="w-3 h-8 bg-black mx-px"></div>
             <div className="w-1 h-8 bg-black mx-px"></div>
             <div className="w-4 h-8 bg-black mx-px"></div>
             <div className="w-2 h-8 bg-black mx-px"></div>
             <div className="w-1 h-8 bg-black mx-px"></div>
             <div className="w-2 h-8 bg-black mx-px"></div>
             <div className="w-1 h-8 bg-black mx-px"></div>
             <div className="w-3 h-8 bg-black mx-px"></div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4 pb-6 bg-white border-t border-gray-100 flex gap-3 z-20">
        <button 
          onClick={handleCopyText}
          className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200 transition-colors flex items-center justify-center"
        >
          <Copy className="w-5 h-5 mr-2" /> 텍스트 복사
        </button>
        <button 
          disabled={isExporting}
          onClick={handleDownload}
          className="flex-[2] py-4 bg-toss-blue text-white font-bold rounded-xl active:bg-blue-600 transition-colors flex items-center justify-center shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          {isExporting ? "생성 중..." : (
            <><Download className="w-5 h-5 mr-2" /> 이미지 다운로드</>
          )}
        </button>
      </div>
    </div>
  );
}
