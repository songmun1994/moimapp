"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Wallet, Trash2, Calendar, CheckCircle2, Circle } from "lucide-react";
import { getFundPaymentsAction, addFundPaymentAction, deleteFundPaymentAction, getMeetingAction } from "@/app/actions";

export default function FundsLedgerPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [mtg, fundLogs] = await Promise.all([
        getMeetingAction(params.meetingToken),
        getFundPaymentsAction(params.meetingToken)
      ]);
      if (!mtg) {
        alert("모임을 찾을 수 없습니다.");
        router.push("/home");
        return;
      }
      setMeeting(mtg);
      setPayments(fundLogs);
      if (mtg.members?.length > 0) {
        setSelectedMemberId(mtg.members[0].id.toString());
      }
      if (mtg.upfront_dues > 0) {
        setAmountStr(Number(mtg.upfront_dues).toLocaleString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.meetingToken]);

  const handleAddPayment = async () => {
    const amt = Number(amountStr.replace(/,/g, ''));
    if (!amt || amt <= 0) {
      alert("올바른 금액을 입력해주세요.");
      return;
    }
    try {
      setLoading(true);
      await addFundPaymentAction(params.meetingToken, selectedMemberId, amt, memo);
      setShowAddForm(false);
      setAmountStr(meeting?.upfront_dues ? Number(meeting.upfront_dues).toLocaleString() : "");
      setMemo("");
      await loadData();
    } catch (e) {
      console.error(e);
      alert("기록 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 납부 기록을 삭제하시겠습니까?")) return;
    try {
      setLoading(true);
      await deleteFundPaymentAction(params.meetingToken, id);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  if (loading && !meeting) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">불러오는 중...</div>;
  }

  const totalPot = payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  // Calculate per member
  const memberSums = meeting?.members?.reduce((acc: any, m: any) => {
    acc[m.id.toString()] = {
      name: m.name,
      total: 0
    };
    return acc;
  }, {});

  payments.forEach((p: any) => {
    const mId = p.member_id.toString();
    if (memberSums[mId]) {
      memberSums[mId].total += Number(p.amount);
    }
  });

  return (
    <div className="flex flex-col flex-1 bg-gray-50 relative min-h-screen pb-24">
      <header className="p-4 flex items-center bg-white shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => router.push(`/${params.meetingToken}/expenses`)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="flex-1 text-center font-bold text-toss-text text-lg pr-4">
          공금 회비 장부
        </div>
      </header>

      <div className="p-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="text-gray-400 font-bold mb-1 text-sm">실제 모인 총액</p>
          <div className="text-3xl font-extrabold text-toss-blue">{totalPot.toLocaleString()}원</div>
        </div>

        <h3 className="font-bold text-toss-text-secondary mb-3 flex items-center">
          <Wallet className="w-4 h-4 mr-1" /> 멤버별 납부 현황
        </h3>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {Object.entries(memberSums || {}).map(([id, data]: any, idx: number, arr: any[]) => (
            <div key={id} className={`p-4 flex items-center justify-between ${idx !== arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-toss-blue font-bold flex items-center justify-center mr-3">{data.name.substring(0,1)}</div>
                <span className="font-bold text-toss-text">{data.name}</span>
              </div>
              <div className="flex items-center">
                <span className={`font-bold ${data.total > 0 ? 'text-toss-text' : 'text-gray-300'}`}>
                  {data.total.toLocaleString()}원
                </span>
                {data.total > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-toss-blue ml-2" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-200 ml-2" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-toss-text-secondary flex items-center">
            <Calendar className="w-4 h-4 mr-1" /> 전체 납부 내역
          </h3>
          <button onClick={() => setShowAddForm(true)} className="flex items-center text-sm font-bold text-toss-blue bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
            <Plus className="w-4 h-4 mr-1" /> 수동 추가
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            납부된 기록이 없습니다.<br/>위에서 수동 추가를 눌러보세요.
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center mb-1">
                    <span className="font-bold text-toss-text mr-2">{p.members?.name}</span>
                    <span className="text-xs text-gray-400 font-medium">{new Date(p.payment_date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-500">{p.memo || "공금 납부"}</div>
                </div>
                <div className="flex items-center">
                  <span className="font-bold text-toss-blue mr-3">+{Number(p.amount).toLocaleString()}원</span>
                  <button onClick={() => handleDelete(p.id.toString())} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl p-6 pb-10 sm:pb-6 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold text-toss-text mb-6">새로운 납부 기록</h2>
            
            <label className="text-xs font-bold text-gray-400 mb-2 block">누가 냈나요?</label>
            <select 
              value={selectedMemberId} 
              onChange={e => setSelectedMemberId(e.target.value)}
              className="toss-input !py-3 font-semibold mb-4 border-gray-200"
            >
              {meeting?.members?.map((m: any) => (
                <option key={m.id} value={m.id.toString()}>{m.name}</option>
              ))}
            </select>

            <label className="text-xs font-bold text-gray-400 mb-2 block">금액</label>
            <input 
              type="text" inputMode="numeric"
              value={amountStr} 
              onChange={e => {
                const val = e.target.value.replace(/,/g, '');
                if (val === '') setAmountStr('');
                else if (!isNaN(Number(val))) setAmountStr(Number(val).toLocaleString());
              }}
              className="toss-input !py-3 font-semibold mb-4 border-gray-200"
              placeholder="예: 30,000"
            />

            <label className="text-xs font-bold text-gray-400 mb-2 block">메모 (선택)</label>
            <input 
              type="text" 
              value={memo} 
              onChange={e => setMemo(e.target.value)}
              className="toss-input !py-3 font-semibold mb-6 border-gray-200"
              placeholder="1월 정기 회비"
            />

            <div className="flex space-x-3">
              <button onClick={() => setShowAddForm(false)} className="flex-1 py-4 font-bold text-gray-500 bg-gray-100 rounded-xl active:bg-gray-200 transition-colors">취소</button>
              <button onClick={handleAddPayment} className="flex-1 py-4 font-bold text-white bg-toss-blue rounded-xl active:bg-blue-600 transition-colors">기록하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
