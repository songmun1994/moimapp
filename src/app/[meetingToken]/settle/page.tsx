"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, AlertCircle, RotateCcw, Home, Sparkles } from "lucide-react";
import { getMeetingAction, getExpensesAction, getFundPaymentsAction } from "@/app/actions";

export default function SettlePage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [memberStates, setMemberStates] = useState<any[]>([]);
  const [fundsPayments, setFundsPayments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [mtg, exps, funds] = await Promise.all([
          getMeetingAction(params.meetingToken),
          getExpensesAction(params.meetingToken),
          getFundPaymentsAction(params.meetingToken)
        ]);
        if (!mtg) {
           router.push("/home");
           return;
        }
        
        setMeeting(mtg);
        setFundsPayments(funds);
        const sum = exps.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
        setTotalAmount(sum);
        
        // n빵 세팅
        if (mtg.members.length > 0) {
           const newBase = Math.floor(sum / mtg.members.length);
           setMemberStates(mtg.members.map((m: any) => {
             const paid = funds.filter((f: any) => f.member_id.toString() === m.id.toString()).reduce((a: number, b: any) => a + Number(b.amount), 0);
             return { id: m.id.toString(), name: m.name, base: newBase, adjusted: 0, paid };
           }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.meetingToken]);

  const handleDivideN = () => {
    if (memberStates.length === 0) return;
    const newBase = Math.floor(totalAmount / memberStates.length);
    setMemberStates(memberStates.map(m => ({ ...m, base: newBase, adjusted: 0 })));
  };

  const totalAllocated = memberStates.reduce((acc, curr) => acc + curr.base + curr.adjusted, 0);
  const balance = totalAmount - totalAllocated;
  const totalPot = fundsPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const remainingPot = totalPot - totalAmount;

  const handleAdjust = (idx: number, diff: number) => {
    const newMembers = [...memberStates];
    if (newMembers[idx].base + newMembers[idx].adjusted + diff < 0) return;
    newMembers[idx].adjusted += diff;
    setMemberStates(newMembers);
  };

  const handleAutoBalance = () => {
    if (balance === 0 || memberStates.length <= 1) return;
    const newMembers = [...memberStates];
    
    // Distribute balance evenly among all members (or those who didn't trigger the unbalance)
    // To keep it simple: just distribute the remainder (balance) evenly to everyone except the one who has biggest adjustment?
    // Actually, just distribute Math.floor(balance / count) to everyone
    
    // Instead, let's distribute the balance iteratively to lowest allocated people
    let remainder = balance;
    let iterations = 0;
    while(remainder !== 0 && iterations < 1000) {
      const step = remainder > 0 ? 1 : -1;
      // find member with lowest allocated if positive remainder, else highest if negative
      let targetIdx = 0;
      let targetVal = step > 0 ? Infinity : -Infinity;
      
      for(let i=0; i<newMembers.length; i++) {
        const val = newMembers[i].base + newMembers[i].adjusted;
        if ((step > 0 && val < targetVal) || (step < 0 && val > targetVal)) {
          // If we need to subtract, ensure we don't go below 0
          if (step < 0 && val <= 0) continue; 
          targetVal = val;
          targetIdx = i;
        }
      }
      
      newMembers[targetIdx].adjusted += step;
      remainder -= step;
      iterations++;
    }
    setMemberStates(newMembers);
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col flex-1 bg-toss-bg relative min-h-screen">
      <header className="p-4 flex items-center bg-white border-b border-gray-100 justify-between">
        <button onClick={() => router.back()} className="p-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="text-center font-bold text-lg text-toss-text">{meeting?.meeting_name || "정산 상세 조정"}</div>
        <button onClick={() => router.push("/home")} className="p-2">
          <Home className="w-5 h-5 text-toss-text" />
        </button>
      </header>

      <div className="p-6 flex flex-col flex-1 pb-32">
        <div className="text-center mb-6 mt-2">
          {totalPot > 0 ? (
            <>
               <p className="text-toss-text-secondary font-semibold text-sm">우리의 예산 현황</p>
               <div className="text-4xl font-extrabold mt-1 text-toss-text tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                   {remainingPot > 0 ? `+${remainingPot.toLocaleString()}` : remainingPot.toLocaleString()}원
               </div>
               <p className="text-xs text-gray-400 mt-2 font-medium">모인 회비({totalPot.toLocaleString()}원) - 지출({totalAmount.toLocaleString()}원)</p>
            </>
          ) : (
            <>
               <p className="text-toss-text-secondary font-semibold text-sm">확정할 총 지출 정산 금액</p>
               <div className="text-4xl font-extrabold mt-1 text-toss-text tracking-tight">{totalAmount.toLocaleString()}원</div>
            </>
          )}
        </div>

        <div className={`rounded-2xl p-5 mb-6 flex justify-between items-center bg-white shadow-sm border-2 transition-colors ${balance === 0 ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
          <div>
            <span className="text-sm font-bold text-gray-500 block mb-1">지출 분할 오차 (1/N 잔액)</span>
            <span className={`text-2xl font-extrabold ${balance === 0 ? 'text-green-500' : 'text-red-500'}`}>
              {balance > 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString()}원
            </span>
          </div>
          {balance === 0 ? (
            <div className="bg-green-100 p-2.5 rounded-full text-green-500 shadow-sm"><Check className="w-7 h-7" /></div>
          ) : (
            <div className="bg-red-100 p-2.5 rounded-full text-red-500 shadow-sm"><AlertCircle className="w-7 h-7" /></div>
          )}
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h3 className="font-bold text-toss-text text-lg">개인별 금액 조정</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleAutoBalance} 
                className="px-3 py-1.5 bg-blue-50 text-toss-blue font-bold rounded-lg text-sm flex items-center transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" /> 자동 분배
              </button>
              <button 
                onClick={handleDivideN} 
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-sm flex items-center transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> 리셋
              </button>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 font-medium mb-6 bg-gray-100 p-3 rounded-xl leading-relaxed">
            덜 먹은 멤버나 추가 결제자를 위해 금액을 개별적으로 (+/-) 조정하세요. 남은 금액이 0원이 되어야 확정할 수 있어요.
          </p>
          
          {memberStates.map((m, idx) => (
            <div key={idx} className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-white mb-3">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg text-toss-text">{m.name}</span>
                <span className={`font-extrabold text-2xl tracking-tight ${(m.base + m.adjusted - m.paid) > 0 ? 'text-red-500' : (m.base + m.adjusted - m.paid) < 0 ? 'text-toss-blue' : 'text-gray-400'}`}>
                  {(m.base + m.adjusted - m.paid) > 0 
                    ? `송금 ${(m.base + m.adjusted - m.paid).toLocaleString()}원` 
                    : (m.base + m.adjusted - m.paid) < 0 
                      ? `환급 ${Math.abs(m.base + m.adjusted - m.paid).toLocaleString()}원` 
                      : `정산 완료`}
                </span>
              </div>
              <div className="flex flex-col mt-2 pt-4 border-t border-gray-50">
                <div className="flex justify-between mb-2 text-sm text-gray-500 font-semibold px-1">
                  <span>사용 금액 (기본 1/N)</span>
                  <span>{(m.base + m.adjusted).toLocaleString()}원</span>
                </div>
                {m.paid > 0 && (
                  <div className="flex justify-between mb-3 text-sm text-toss-blue font-semibold px-1">
                    <span>납부 내역 (공금/회비)</span>
                    <span>- {m.paid.toLocaleString()}원</span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                   <button onClick={() => handleAdjust(idx, -1000)} className="py-2 bg-gray-50 text-gray-600 rounded-lg font-bold text-xs border border-gray-200 hover:bg-gray-100">-1천</button>
                   <button onClick={() => handleAdjust(idx, -10000)} className="py-2 bg-gray-50 text-gray-600 rounded-lg font-bold text-xs border border-gray-200 hover:bg-gray-100">-1만</button>
                   <button onClick={() => handleAdjust(idx, -50000)} className="py-2 bg-gray-50 text-gray-600 rounded-lg font-bold text-xs border border-gray-200 hover:bg-gray-100">-5만</button>
                   <button onClick={() => handleAdjust(idx, -100000)} className="py-2 bg-gray-50 text-gray-600 rounded-lg font-bold text-xs border border-gray-200 hover:bg-gray-100">-10만</button>
                   
                   <button onClick={() => handleAdjust(idx, 1000)} className="py-2 bg-blue-50 text-toss-blue rounded-lg font-bold text-xs hover:bg-blue-100">+1천</button>
                   <button onClick={() => handleAdjust(idx, 10000)} className="py-2 bg-blue-50 text-toss-blue rounded-lg font-bold text-xs hover:bg-blue-100">+1만</button>
                   <button onClick={() => handleAdjust(idx, 50000)} className="py-2 bg-blue-50 text-toss-blue rounded-lg font-bold text-xs hover:bg-blue-100">+5만</button>
                   <button onClick={() => handleAdjust(idx, 100000)} className="py-2 bg-blue-50 text-toss-blue rounded-lg font-bold text-xs hover:bg-blue-100">+10만</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-6 left-6 right-6 max-w-[432px] mx-auto z-10">
          <button 
            disabled={balance !== 0}
            onClick={() => {
              // Serialize member data to localStorage to be printed into image on next page
              localStorage.setItem(`settle_${params.meetingToken}`, JSON.stringify({
                totalPot,
                remainingPot,
                totalAmount,
                memberStates,
                meetingName: meeting.meeting_name,
                bankInfo: {
                  bank: meeting.account_bank,
                  account: meeting.account_number,
                  holder: meeting.account_holder
                }
              }));
              router.push(`/${params.meetingToken}/receipt`);
            }}
            className="toss-button py-5 text-lg w-full tracking-wide disabled:bg-gray-200 disabled:text-gray-400 shadow-xl inline-flex items-center justify-center font-bold"
          >
            {balance === 0 ? "정산 영수증 만들기" : "잔액을 0원으로 맞춰주세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
