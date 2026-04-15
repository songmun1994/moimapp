"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMeetingAction, updateMeetingAction, addMemberAction, removeMemberAction } from "@/app/actions";
import { ChevronLeft, UserPlus, Trash2, Save, Users, CreditCard } from "lucide-react";

export default function MeetingSettings() {
  const { meetingToken } = useParams() as { meetingToken: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [isCreator, setIsCreator] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  
  // Dues Settings
  const [upfrontDues, setUpfrontDues] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<string>("none");
  const [scheduleDay, setScheduleDay] = useState<number>(1);
  const [recurringAmount, setRecurringAmount] = useState<string>("");

  const [newMemberName, setNewMemberName] = useState("");

  const loadData = async () => {
    try {
      const data = await getMeetingAction(meetingToken);
      if (!data) {
        alert("존재하지 않는 모임입니다.");
        router.push("/home");
        return;
      }
      setMeeting(data);
      setName(data.meeting_name || "");
      setDescription(data.description || "");
      setBank(data.account_bank || "");
      setAccount(data.account_number || "");
      setHolder(data.account_holder || "");
      
      setUpfrontDues(data.upfront_dues ? Number(data.upfront_dues).toLocaleString() : "");
      if (data.meeting_schedules) {
        setScheduleType(data.meeting_schedules.recurring_type || "none");
        setScheduleDay(data.meeting_schedules.recurring_day_of_month || data.meeting_schedules.recurring_day_of_week || 1);
        setRecurringAmount(data.meeting_schedules.recurring_amount ? Number(data.meeting_schedules.recurring_amount).toLocaleString() : "");
      }
    } catch (e) {
      console.error(e);
      alert("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check ownership using localStorage
    const saved = JSON.parse(localStorage.getItem("recent_meetings") || "[]");
    const found = saved.find((s: any) => s.id === meetingToken);
    
    if (!found) {
      alert("모임 설정은 모임을 생성한 기기에서만 접근할 수 있습니다.");
      router.push(`/${meetingToken}/expenses`);
      return;
    }
    
    setIsCreator(true);
    loadData();
  }, [meetingToken, router]);

  const handleUpdateInfo = async () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("bankInfo.bank", bank);
    formData.append("bankInfo.account", account);
    formData.append("bankInfo.holder", holder);
    
    formData.append("upfrontDues", upfrontDues.replace(/,/g, '') || "0");
    formData.append("scheduleType", scheduleType);
    if (scheduleType !== "none") {
      formData.append("scheduleDay", scheduleDay.toString());
      formData.append("recurringAmount", recurringAmount.replace(/,/g, '') || "0");
    }

    try {
      await updateMeetingAction(meetingToken, formData);
      alert("모임 정보가 수정되었습니다.");
      loadData();
    } catch (e) {
      console.error(e);
      alert("수정 중 오류가 발생했습니다.");
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      await addMemberAction(meetingToken, newMemberName.trim());
      setNewMemberName("");
      loadData();
    } catch (e) {
      console.error(e);
      alert("멤버 추가 중 오류가 발생했습니다.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("이 멤버를 삭제하시겠습니까?")) return;
    try {
      const res = await removeMemberAction(meetingToken, memberId);
      if (!res.success) {
        alert(res.error);
        return;
      }
      loadData();
    } catch (e) {
      console.error(e);
      alert("멤버 삭제 중 오류가 발생했습니다.");
    }
  };

  if (!isCreator || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-50 relative min-h-screen pb-20">
      <header className="px-4 h-14 flex items-center justify-between bg-white shadow-sm sticky top-0 z-20">
        <button onClick={() => router.push(`/${meetingToken}/expenses`)} className="p-2 -ml-2 relative z-10 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-bold text-toss-text text-lg text-center w-full px-20 truncate">
            모임 설정
          </div>
         </div>
         <div className="w-10 relative z-10"></div>
      </header>

      <div className="p-5 space-y-6">
        
        {/* 모임 기본 정보 섹션 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="flex items-center justify-center text-lg font-bold text-toss-text mb-4 w-full">
            <span className="bg-blue-50 text-toss-blue p-1.5 rounded-lg mr-2">⚙️</span>
            기본 정보 수정
          </h2>
          
          <label className="text-xs font-bold text-gray-400 mb-1 block">모임 이름</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="toss-input !py-3 font-semibold mb-4 bg-gray-50 border-gray-200"
          />
          
          <label className="text-xs font-bold text-gray-400 mb-1 block">간단한 설명</label>
          <input 
            type="text" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            className="toss-input !py-3 font-semibold mb-4 bg-gray-50 border-gray-200"
          />
          
          <h3 className="flex items-center justify-center text-sm font-bold text-gray-600 mb-3 mt-6 w-full">
            <CreditCard className="w-4 h-4 mr-1.5" /> 정산 계좌 정보
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs font-bold text-gray-400 mb-1 block">은행</label>
              <input type="text" value={bank} onChange={e => setBank(e.target.value)} className="toss-input !py-3 font-semibold bg-gray-50 border-gray-200" placeholder="토스뱅크" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 mb-1 block">예금주</label>
              <input type="text" value={holder} onChange={e => setHolder(e.target.value)} className="toss-input !py-3 font-semibold bg-gray-50 border-gray-200" placeholder="홍길동" />
            </div>
          </div>
          <label className="text-xs font-bold text-gray-400 mb-1 block">계좌 번호</label>
          <input type="text" value={account} onChange={e => setAccount(e.target.value)} className="toss-input !py-3 font-mono font-medium mb-4 bg-gray-50 border-gray-200" placeholder="1000-1111-2222" />
          
          <h3 className="flex items-center justify-center text-sm font-bold text-gray-600 mb-3 mt-8 w-full">
            <span className="mr-1">💰</span> 회비 납부 설정
          </h3>
          
          <label className="text-xs font-bold text-gray-400 mb-1 block">초기 회비 (생성 시 걷는 금액)</label>
          <input 
            type="text" inputMode="numeric"
            value={upfrontDues} 
            onChange={e => {
              const val = e.target.value.replace(/,/g, '');
              if (val === '') setUpfrontDues('');
              else if (!isNaN(Number(val))) setUpfrontDues(Number(val).toLocaleString());
            }} 
            className="toss-input !py-3 font-semibold mb-4 bg-gray-50 border-gray-200" 
            placeholder="예: 30,000" 
          />

          <label className="text-xs font-bold text-gray-400 mb-2 block">정기 모금 여부</label>
          <div className="flex space-x-2 mb-4">
            <button onClick={() => setScheduleType('none')} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'none' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}>해당없음</button>
            <button onClick={() => setScheduleType('weekly')} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'weekly' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}>매주</button>
            <button onClick={() => setScheduleType('monthly')} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'monthly' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}>매월</button>
          </div>
          
          {scheduleType !== 'none' && (
            <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <label className="text-xs font-bold text-gray-400 mb-1 block">
                {scheduleType === 'weekly' ? '매주 며칠(월=1~일=7)' : '매월 며칠'}에 걷을까요?
              </label>
              <input type="number" value={scheduleDay || ''} onChange={e => setScheduleDay(Number(e.target.value) || 1)} className="toss-input !py-3 font-semibold mb-3 border-gray-200" placeholder="1" />
              
              <label className="text-xs font-bold text-gray-400 mb-1 block">정기 회비 (액수)</label>
              <input 
                type="text" inputMode="numeric"
                value={recurringAmount} 
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '');
                  if (val === '') setRecurringAmount('');
                  else if (!isNaN(Number(val))) setRecurringAmount(Number(val).toLocaleString());
                }} 
                className="toss-input !py-3 font-semibold border-gray-200" 
                placeholder="예: 10,000" 
              />
            </div>
          )}

          <button onClick={handleUpdateInfo} className="w-full flex items-center justify-center py-4 bg-toss-text text-white rounded-xl font-bold active:scale-95 transition-transform mt-6">
            <Save className="w-5 h-5 mr-2" /> 모임 정보 저장하기
          </button>
        </div>

        {/* 멤버 관리 섹션 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <h2 className="flex items-center justify-center text-lg font-bold text-toss-text mb-4 w-full">
            <span className="bg-green-50 text-green-600 p-1.5 rounded-lg mr-2"><Users className="w-5 h-5"/></span>
            참여 인원 관리 ({meeting?.members?.length || 0}명)
          </h2>

          <div className="flex space-x-2 mb-6">
            <input 
              type="text" 
              value={newMemberName} 
              onChange={e => setNewMemberName(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              className="toss-input !py-3 font-semibold flex-1 border-gray-200"
              placeholder="새 멤버 이름"
            />
            <button onClick={handleAddMember} className="px-5 bg-toss-blue text-white rounded-xl font-bold flex items-center justify-center active:scale-95 transition-transform">
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {meeting?.members?.map((m: any, idx: number) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-toss-blue flex items-center justify-center font-bold text-sm mr-3">
                    {m.name.substring(0, 1)}
                  </div>
                  <span className="font-bold text-toss-text">{m.name}</span>
                  {idx === 0 && <span className="ml-2 text-xs font-bold text-toss-blue bg-blue-50 px-2 py-0.5 rounded-full">방장</span>}
                </div>
                {idx !== 0 && ( /* 방장(첫번째멤버)은 삭제 불가 */
                  <button onClick={() => handleRemoveMember(m.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
        </div>

      </div>
    </div>
  );
}
