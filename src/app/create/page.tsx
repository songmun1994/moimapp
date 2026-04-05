"use client";
import { useRouter } from "next/navigation";
import { useMeetingStore } from "@/store/useMeetingStore";
import { ChevronLeft, Users, CalendarDays, History, Camera, ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { createMeetingAction } from "@/app/actions";

export default function CreateMeeting() {
  const router = useRouter();
  const { name, description, duration_type, memberCount, upfrontDues, members, bankInfo, scheduleType, scheduleDay, recurringAmount, setField } = useMeetingStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleNext = async () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("duration_type", duration_type);
        formData.append("upfrontDues", upfrontDues.toString());
        formData.append("bankInfo.bank", bankInfo.bank);
        formData.append("bankInfo.account", bankInfo.account);
        formData.append("bankInfo.holder", bankInfo.holder);
        formData.append("members", JSON.stringify(members));
        if (duration_type === 'long_term' && scheduleType !== 'none') {
          formData.append("scheduleType", scheduleType);
          if (scheduleDay !== null) formData.append("scheduleDay", scheduleDay.toString());
          formData.append("recurringAmount", recurringAmount.toString());
        }
        if (coverFile) formData.append("coverImage", coverFile);

        const res = await createMeetingAction(formData);
        
        // localStorage 내역 기록
        const saved = JSON.parse(localStorage.getItem("recent_meetings") || "[]");
        saved.push({ id: res.token, name, cover: coverPreview || null });
        localStorage.setItem("recent_meetings", JSON.stringify(saved));
        
        router.push(`/${res.token}/expenses`);
      } catch (err) {
        console.error(err);
        alert("모임 생성 중 오류가 발생했습니다.");
        setLoading(false);
      }
    }
  };

  const handleMemberCountChange = (newCount: number) => {
    if (newCount < 1) return;
    const newMembers = [...members];
    if (newCount > members.length) {
      for (let i = members.length; i < newCount; i++) newMembers.push("");
    } else {
      newMembers.length = newCount;
    }
    setField({ memberCount: newCount, members: newMembers });
  };

  const handleMemberNameChange = (index: number, newName: string) => {
    const newMembers = [...members];
    newMembers[index] = newName;
    setField({ members: newMembers });
  };

  return (
    <div className="flex flex-col flex-1 bg-white relative min-h-screen">
      <header className="p-4 flex items-center border-b border-gray-100 relative">
        <button onClick={() => step === 1 ? router.push("/home") : setStep(step - 1)} className="p-2 absolute left-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="flex-1 text-center font-bold text-toss-text text-lg">
          새 모임 만들기 <span className="text-gray-400 text-sm font-semibold ml-1">({step}/5)</span>
        </div>
      </header>

      <div className="p-6 pb-32 flex flex-col flex-1 overflow-y-auto">
        {step === 1 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 fill-mode-both">
            <h2 className="text-2xl font-bold mb-6 leading-snug">모임의 기본 정보를<br/>알려주세요</h2>
            
            <div className="flex flex-col items-center mb-8">
               <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImagePick} />
               <div 
                 className={`w-28 h-28 rounded-3xl mb-3 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${coverPreview ? 'border-none shadow-md' : 'border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                 onClick={() => fileInputRef.current?.click()}
               >
                 {coverPreview ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                 ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                      <span className="text-xs font-bold text-gray-400">대표 이미지</span>
                    </>
                 )}
               </div>
            </div>

            <label className="text-sm font-bold text-toss-text-secondary mb-2 block">모임 이름</label>
            <input 
              type="text" 
              className="toss-input mb-8" 
              placeholder="예: 제주도 우정여행" 
              value={name} 
              onChange={(e) => setField({ name: e.target.value })} 
            />
            <label className="text-sm font-bold text-toss-text-secondary mb-2 block">간단한 설명 (선택)</label>
            <input 
              type="text" 
              className="toss-input mb-8" 
              placeholder="예: 2박 3일 먹방투어" 
              value={description} 
              onChange={(e) => setField({ description: e.target.value })} 
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 fill-mode-both">
            <h2 className="text-2xl font-bold mb-6 leading-snug">몇 명이<br/>함께하나요?</h2>
            <div className="flex flex-col items-center justify-center flex-1 pb-20">
              <div className="flex items-center justify-center space-x-8 mb-6">
                <button 
                  onClick={() => handleMemberCountChange(Math.max(1, memberCount - 1))}
                  className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-4xl font-bold text-gray-500 active:bg-gray-200"
                >-</button>
                <span className="text-6xl font-extrabold text-toss-text w-16 text-center">{memberCount}</span>
                <button 
                  onClick={() => handleMemberCountChange(memberCount + 1)}
                  className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-4xl font-bold text-toss-blue active:bg-blue-100"
                >+</button>
              </div>
              <p className="text-center text-toss-text-secondary flex items-center justify-center font-medium bg-gray-50 px-4 py-2 rounded-lg mt-4">
                <Users className="w-4 h-4 mr-2" /> 본인을 포함한 인원수
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 fill-mode-both">
            <h2 className="text-2xl font-bold mb-6">참여자 등록</h2>
            <div className="space-y-4 pt-2">
              {members.map((m, idx) => (
                <div key={idx} className="relative">
                  <input
                    type="text"
                    className="toss-input font-semibold border-2 focus:border-toss-blue"
                    placeholder={idx === 0 ? "총무 (본인)" : `참여자 ${idx + 1}`}
                    value={m}
                    onChange={(e) => handleMemberNameChange(idx, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 fill-mode-both">
            <h2 className="text-2xl font-bold mb-4">공금(회비)를<br/>미리 걷을 예정인가요?</h2>
            
            <div className="flex space-x-3 mb-8">
               <button 
                 onClick={() => setField({ duration_type: 'short_term', upfrontDues: 0, scheduleType: 'none', recurringAmount: 0 })}
                 className={`flex-1 py-4 border-2 rounded-2xl font-bold transition-all ${duration_type === 'short_term' ? 'bg-blue-50 text-toss-blue border-toss-blue' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
               >
                 아니요,<br/>나중에 정산할게요
               </button>
               <button 
                 onClick={() => setField({ duration_type: 'long_term' })}
                 className={`flex-1 py-4 border-2 rounded-2xl font-bold transition-all ${duration_type === 'long_term' ? 'bg-blue-50 text-toss-blue border-toss-blue' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
               >
                 네,<br/>회비를 걷을게요
               </button>
            </div>
            
            {duration_type === 'long_term' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <label className="text-sm font-bold text-toss-text-secondary mb-3 block">초기 회비 금액</label>
                <div className="flex items-center mb-4 border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 focus-within:border-toss-blue focus-within:bg-white transition-colors">
                  <span className="text-2xl font-bold text-gray-400 mr-2">₩</span>
                  <input 
                    type="text" inputMode="numeric"
                    className="bg-transparent text-2xl font-extrabold text-toss-text w-full outline-none py-3" 
                    value={upfrontDues ? upfrontDues.toLocaleString() : ''} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (val === '') setField({ upfrontDues: 0 });
                      else if (!isNaN(Number(val))) setField({ upfrontDues: Number(val) });
                    }} 
                    placeholder="0"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[10000, 30000, 50000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setField({ upfrontDues: upfrontDues + amt })}
                      className="py-3 bg-blue-50 text-toss-blue rounded-xl font-bold text-sm active:bg-blue-100"
                    >+{amt/10000}만</button>
                  ))}
                  <button
                     onClick={() => setField({ upfrontDues: 0 })}
                     className="col-span-3 mt-1 text-center text-gray-400 font-semibold py-2 text-sm"
                  >초기화 (0원)</button>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
                   <h3 className="font-bold text-toss-text mb-4 text-sm">정기 납부 일정을 설정할까요?</h3>
                   
                   <div className="flex space-x-2 mb-4">
                     <button 
                       onClick={() => setField({ scheduleType: 'none', scheduleDay: null, recurringAmount: 0 })}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'none' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}
                     >해당없음</button>
                     <button 
                       onClick={() => setField({ scheduleType: 'weekly', scheduleDay: 1 })}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'weekly' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}
                     >매주</button>
                     <button 
                       onClick={() => setField({ scheduleType: 'monthly', scheduleDay: 1 })}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-all ${scheduleType === 'monthly' ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-200 bg-white text-gray-400'}`}
                     >매월</button>
                   </div>
                   
                   {scheduleType === 'weekly' && (
                     <div className="flex flex-col mb-4">
                       <label className="text-xs font-bold text-gray-400 mb-2">무슨 요일에 걷을까요?</label>
                       <select 
                         value={scheduleDay || 1} 
                         onChange={(e) => setField({ scheduleDay: Number(e.target.value) })}
                         className="toss-input !py-3 font-semibold text-sm appearance-none cursor-pointer"
                       >
                         <option value={1}>월요일</option>
                         <option value={2}>화요일</option>
                         <option value={3}>수요일</option>
                         <option value={4}>목요일</option>
                         <option value={5}>금요일</option>
                         <option value={6}>토요일</option>
                         <option value={7}>일요일</option>
                       </select>
                     </div>
                   )}
                   
                   {(scheduleType === 'monthly' || scheduleType === 'yearly') && (
                     <div className="flex flex-col mb-4">
                       <label className="text-xs font-bold text-gray-400 mb-2">며칠에 걷을까요?</label>
                       <select 
                         value={scheduleDay || 1} 
                         onChange={(e) => setField({ scheduleDay: Number(e.target.value) })}
                         className="toss-input !py-3 font-semibold text-sm appearance-none cursor-pointer"
                       >
                         {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                           <option key={day} value={day}>{day}일</option>
                         ))}
                       </select>
                     </div>
                   )}
                   
                   {scheduleType !== 'none' && (
                      <div className="flex flex-col">
                        <label className="text-xs font-bold text-gray-400 mb-2">정기 회비 액수 (원)</label>
                        <input 
                          type="number" 
                          value={recurringAmount || ''} 
                          onChange={(e) => setField({ recurringAmount: Number(e.target.value) })}
                          placeholder="매번 얼마씩 걷나요?"
                          className="toss-input !py-3 font-semibold text-sm"
                        />
                      </div>
                   )}
                 </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 fill-mode-both">
            <h2 className="text-2xl font-bold mb-4 leading-snug">정산받을 계좌를<br/>등록해주세요</h2>
            <p className="text-sm font-medium text-toss-text-secondary mb-8 bg-blue-50 p-3 rounded-lg text-toss-blue">
              최종 공유될 청구서 이미지에 계좌번호가 표시됩니다.
            </p>
            
            <label className="text-sm font-bold text-toss-text-secondary mb-2 block">입금 은행명</label>
            <input 
              type="text" 
              className="toss-input mb-6" 
              placeholder="예: 토스뱅크" 
              value={bankInfo.bank} 
              onChange={(e) => setField({ bankInfo: { ...bankInfo, bank: e.target.value } })} 
            />

            <label className="text-sm font-bold text-toss-text-secondary mb-2 block">계좌 번호</label>
            <input 
              type="text" 
              className="toss-input mb-6 font-mono font-medium" 
              placeholder="예: 1000-1111-2222" 
              value={bankInfo.account} 
              onChange={(e) => setField({ bankInfo: { ...bankInfo, account: e.target.value } })} 
            />

            <label className="text-sm font-bold text-toss-text-secondary mb-2 block">예금주</label>
            <input 
              type="text" 
              className="toss-input mb-6" 
              placeholder="예: 홍길동" 
              value={bankInfo.holder} 
              onChange={(e) => setField({ bankInfo: { ...bankInfo, holder: e.target.value } })} 
            />
          </div>
        )}
      </div>
      
      <div className="absolute bottom-6 left-6 right-6 z-10">
        <button 
          disabled={
            loading ||
            (step === 1 && name.trim() === '') || 
            (step === 3 && members.some(m => !m.trim())) || 
            (step === 5 && (!bankInfo.bank || !bankInfo.account || !bankInfo.holder))
          }
          onClick={handleNext} 
          className="toss-button block w-full disabled:bg-gray-200 disabled:text-gray-400"
        >
          {loading ? "생성 중..." : (step === 5 ? "모임 정산 시작하기" : "다음")}
        </button>
      </div>
    </div>
  );
}
