"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, ReceiptText, Users, Calculator, Camera, Trash2, Home, Search, MapPin, Settings, Wallet } from "lucide-react";
import { getExpensesAction, addExpenseAction, editExpenseAction, getMeetingAction, deleteMeetingAction, getFundPaymentsAction } from "@/app/actions";

export default function ExpensesPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fundsPayments, setFundsPayments] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  
  const [newExpense, setNewExpense] = useState({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const searchPlaces = (text: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?query=${encodeURIComponent(text)}`);
        const data = await res.json();
        if(data.documents) setSearchResults(data.documents);
      } catch(e) {}
    }, 400);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBaseData = async () => {
    try {
      const recent = JSON.parse(localStorage.getItem("recent_meetings") || "[]");
      setIsCreator(recent.some((m: any) => m.id === params.meetingToken));

      const mtg = await getMeetingAction(params.meetingToken);
      if (!mtg) {
        const filtered = recent.filter((m: any) => m.id !== params.meetingToken);
        localStorage.setItem("recent_meetings", JSON.stringify(filtered));
        
        alert("데이터가 만료삭제되었거나 찾을 수 없는 모임입니다.");
        router.push("/home");
        return;
      }
      setMeeting(mtg);
      setSelectedMembers(mtg.members.map((m: any) => m.name));
      
      const [exp, funds] = await Promise.all([
        getExpensesAction(params.meetingToken),
        getFundPaymentsAction(params.meetingToken)
      ]);
      setExpenses(exp);
      setFundsPayments(funds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, [params.meetingToken]);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 1200;
          let { width, height } = img;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" }));
              } else resolve(file);
            },
            "image/webp",
            0.8
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptPreview(URL.createObjectURL(file));
      
      try {
        const compressed = await compressImage(file);
        setReceiptFile(compressed);
      } catch (err) {
        setReceiptFile(file);
      }
    }
  };

  const openEditModal = (exp: any) => {
    setEditingExpenseId(exp.id.toString());
    const isIncome = Number(exp.amount) < 0;
    let spentDate = new Date().toISOString().substring(0, 10);
    if (exp.spent_date) {
      spentDate = new Date(exp.spent_date).toISOString().substring(0, 10);
    } else if (exp.created_at) {
      spentDate = new Date(exp.created_at).toISOString().substring(0, 10);
    }
    setNewExpense({
      place: exp.place_name,
      merchant: exp.merchant_name || "",
      merchant_address: exp.merchant_address || "",
      amount: Math.abs(Number(exp.amount)).toLocaleString(),
      memo: exp.memo || "",
      type: isIncome ? "income" : "expense",
      spent_date: spentDate,
      manual_merchant: !exp.merchant_address && !!exp.merchant_name
    });
    setSelectedMembers(exp.expense_members.map((em: any) => em.members.name));
    setReceiptPreview(exp.receipt_url || null);
    setReceiptFile(null);
    setShowAddForm(true);
  };

  const handleAdd = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("place_name", newExpense.place);
      const pureAmount = newExpense.amount.replace(/,/g, '');
      formData.append("amount", pureAmount);
      if (newExpense.merchant) formData.append("merchant_name", newExpense.merchant);
      if (newExpense.merchant_address && !newExpense.manual_merchant) formData.append("merchant_address", newExpense.merchant_address);
      if (newExpense.spent_date) formData.append("spent_date", newExpense.spent_date);
      formData.append("selectedMembers", JSON.stringify(selectedMembers));
      formData.append("expenseType", newExpense.type);
      if (receiptFile) formData.append("receiptImage", receiptFile);

      if (editingExpenseId) {
        await editExpenseAction(params.meetingToken, editingExpenseId, formData);
      } else {
        await addExpenseAction(params.meetingToken, formData);
      }
      
      setShowAddForm(false);
      setEditingExpenseId(null);
      setNewExpense({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
      setSearchResults([]);
      setReceiptFile(null);
      setReceiptPreview(null);
      
      await fetchBaseData();
    } catch (err) {
      console.error(err);
      alert("지출 추가 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !meeting) {
    return <div className="flex h-screen items-center justify-center font-bold text-gray-400">Loading...</div>;
  }

  const handleDeleteMeeting = async () => {
    if (confirm("정말 이 모임을 삭제할까요?\n등록된 모든 지출 내역과 영수증 사진이 영구적으로 함께 삭제됩니다.")) {
      try {
        setLoading(true);
        await deleteMeetingAction(params.meetingToken);
        
        const recent = JSON.parse(localStorage.getItem("recent_meetings") || "[]");
        const filtered = recent.filter((m: any) => m.id !== params.meetingToken);
        localStorage.setItem("recent_meetings", JSON.stringify(filtered));
        
        alert("모임이 삭제되었습니다.");
        router.push("/home");
      } catch (err) {
        console.error(err);
        alert("모임 삭제 중 오류가 발생했습니다.");
        setLoading(false);
      }
    }
  };

  const totalPot = fundsPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  // Create month options
  const monthSet = new Set<string>();
  expenses.forEach(e => {
    const d = e.spent_date ? new Date(e.spent_date) : new Date(e.created_at);
    monthSet.add(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  const monthOptions = Array.from(monthSet).sort().reverse();
  
  // Filter expenses
  const filteredExpenses = filterMonth === 'all' 
    ? expenses 
    : expenses.filter(e => {
        const d = e.spent_date ? new Date(e.spent_date) : new Date(e.created_at);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}` === filterMonth;
      });

  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const remainingPot = totalPot - totalAmount;

  return (
    <div className="flex flex-col flex-1 bg-toss-bg relative min-h-screen">
      <header className="p-4 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <button onClick={() => router.push("/home")} className="p-2">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="font-bold text-lg text-toss-text truncate flex-1 text-center px-2">{meeting?.meeting_name || "지출 내역"}</div>
        <div className="flex items-center">
          {isCreator && (
            <button onClick={() => router.push(`/${params.meetingToken}/settings`)} className="p-2 text-toss-text-secondary hover:text-toss-blue transition-colors">
              <Settings className="w-6 h-6" />
            </button>
          )}
          <button onClick={() => router.push("/home")} className="p-2 text-toss-text-secondary hover:text-toss-blue transition-colors">
            <Home className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="p-6 pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-toss-text">결제 상세</h2>
          <button 
            onClick={() => router.push(`/${params.meetingToken}/account`)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-toss-text-secondary font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            총무 계좌 보기
          </button>
        </div>

        <div className="bg-toss-blue text-white p-6 rounded-[24px] shadow-lg shadow-blue-500/20 mb-8 relative overflow-hidden">
          {totalPot > 0 || meeting?.duration_type === 'long_term' ? (
            <>
              <div className="flex items-center justify-between mb-1 relative z-10">
                <p className="text-blue-100 font-medium">남은 공금 (모인 회비 - 지출)</p>
                <button 
                  onClick={() => router.push(`/${params.meetingToken}/funds`)} 
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm backdrop-blur-sm"
                >
                  <Wallet className="w-4 h-4 mr-1" /> 회비(장부) 관리
                </button>
              </div>
              <div className="text-4xl font-extrabold mb-4 relative z-10">{remainingPot > 0 ? `+${remainingPot.toLocaleString()}` : remainingPot.toLocaleString()}원</div>
              <div className="flex bg-white/20 p-3 rounded-xl mb-5 text-sm font-semibold justify-between backdrop-blur-sm relative z-10 gap-2">
                <span className="flex-1 text-center bg-black/10 p-2 rounded-lg truncate">모인 돈: {totalPot.toLocaleString()}</span>
                <span className="flex-1 text-center bg-black/10 p-2 rounded-lg truncate">쓴 돈: {totalAmount.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-blue-100 font-medium mb-1 relative z-10">총 지출 금액</p>
              <div className="text-4xl font-extrabold mb-5 relative z-10">{totalAmount.toLocaleString()}원</div>
            </>
          )}
          <button 
            disabled={expenses.length === 0}
            onClick={() => router.push(`/${params.meetingToken}/settle`)}
            className="w-full bg-white text-toss-blue font-bold py-4 rounded-xl flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 relative z-10"
          >
            <Calculator className="w-5 h-5 mr-2" /> 인원별 정산하기
          </button>
        </div>

        <div className="flex justify-between items-end mb-4 px-1">
          <h3 className="font-bold text-toss-text-secondary">상세 내역</h3>
          {monthOptions.length > 0 && (
            <select 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              className="bg-gray-100 text-toss-text-secondary text-sm font-bold py-1.5 px-3 rounded-lg border-0 outline-none"
            >
              <option value="all">전체 기간</option>
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
            <ReceiptText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">등록된 항목이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExpenses.map((exp: any) => (
              <div 
                key={exp.id.toString()} 
                onClick={() => openEditModal(exp)}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 flex gap-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {exp.receipt_url && (
                    <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-gray-100 overflow-hidden border border-gray-200">
                       <img src={exp.receipt_url} alt="receipt" className="w-full h-full object-cover opacity-90" />
                    </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold text-lg text-toss-text">{exp.place_name}</div>
                    <span className={`font-extrabold text-lg tracking-tight ${Number(exp.amount) < 0 ? 'text-toss-blue' : 'text-toss-text'}`}>
                      {Number(exp.amount) < 0 
                        ? `+ ${Math.abs(Number(exp.amount)).toLocaleString()}원` 
                        : `${Number(exp.amount).toLocaleString()}원`
                      }
                    </span>
                  </div>
                  {exp.merchant_name && (
                    <div className="flex items-center text-xs text-gray-500 mb-2 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      <span className="truncate">{exp.merchant_name} {exp.merchant_address ? `(${exp.merchant_address})` : ''}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-toss-text-secondary bg-gray-50 p-2.5 rounded-xl mt-2 border border-gray-100">
                    <div className="flex flex-col items-center mr-4 w-12 flex-shrink-0 pt-0.5">
                      <div className="text-toss-text font-bold text-base mb-0.5">
                        {exp.spent_date ? new Date(exp.spent_date).getDate() : new Date(exp.created_at).getDate()}일
                      </div>
                      <div className="text-xs text-gray-400 font-medium">
                        {exp.spent_date ? new Date(exp.spent_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date(exp.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">
                      {exp.expense_members.map((em: any) => em.members.name).join(", ")}
                    </span>
                    <span className="ml-auto font-semibold flex-shrink-0">{exp.expense_members.length}명</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-8 left-0 right-0 max-w-[480px] mx-auto pointer-events-none z-20">
        <button 
          onClick={handleDeleteMeeting}
          className="absolute left-6 bottom-0 w-14 h-14 bg-white border-2 border-red-100 text-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/10 hover:bg-red-50 active:scale-95 transition-all pointer-events-auto"
        >
          <Trash2 className="w-6 h-6" />
        </button>
        <button 
          onClick={() => {
            setEditingExpenseId(null);
            setNewExpense({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
            setSelectedMembers(meeting?.members.map((m: any) => m.name) || []);
            setReceiptPreview(null);
            setReceiptFile(null);
            setShowAddForm(true);
          }}
          className="absolute right-6 bottom-0 w-14 h-14 bg-toss-blue text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 hover:bg-blue-600 active:scale-95 transition-all pointer-events-auto"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-200" style={{maxWidth: '480px', left: '50%', transform: 'translateX(-50%)'}}>
          <div className="bg-white rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom-full duration-300 transform-gpu overflow-y-auto max-h-[85vh]">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold mb-6 text-toss-text">{editingExpenseId ? "지출 내역 수정" : "새 지출 등록"}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">항목 이름</label>
              <input 
                type="text" 
                value={newExpense.place} 
                onChange={e => setNewExpense({...newExpense, place: e.target.value})}
                className="toss-input" placeholder="어떤 항목인가요? (ex. 1차 식사)" 
              />
            </div>
            
            <div className="mb-4 relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-700">매장명 검색 (선택)</label>
                <button 
                  type="button"
                  onClick={() => {
                    setNewExpense({...newExpense, manual_merchant: !newExpense.manual_merchant, merchant_address: ""});
                    setSearchResults([]);
                  }}
                  className="text-xs font-bold text-toss-blue bg-blue-50 px-2.5 py-1 rounded-md"
                >
                  {newExpense.manual_merchant ? "지도 검색 사용" : "직접 입력하기"}
                </button>
              </div>
              
              {newExpense.manual_merchant ? (
                <input 
                  type="text" 
                  value={newExpense.merchant} 
                  onChange={e => setNewExpense({...newExpense, merchant: e.target.value})}
                  className="toss-input" 
                  placeholder="매장/장소 이름을 자유롭게 입력하세요" 
                />
              ) : (
                <div className="relative">
                  <input 
                    type="text" 
                    value={newExpense.merchant} 
                    onChange={e => {
                       setNewExpense({...newExpense, merchant: e.target.value});
                       searchPlaces(e.target.value);
                    }}
                    className="toss-input" 
                    style={{ paddingLeft: '44px' }}
                    placeholder="영수증 매장명 검색 (자동완성)" 
                  />
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              )}
              
              {!newExpense.manual_merchant && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[220px] overflow-y-auto">
                  {searchResults.map((res: any, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setNewExpense({...newExpense, merchant: res.place_name, merchant_address: res.road_address_name || res.address_name});
                        setSearchResults([]);
                      }}
                      className="p-4 hover:bg-gray-50 border-b border-gray-50 cursor-pointer transition-colors active:bg-gray-100"
                    >
                      <div className="font-bold text-[#191F28]">{res.place_name}</div>
                      <div className="text-xs text-gray-400 mt-1.5">{res.road_address_name || res.address_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">결제 일자</label>
              <input 
                type="date"
                value={newExpense.spent_date}
                onChange={e => setNewExpense({...newExpense, spent_date: e.target.value})}
                className="toss-input"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">유형</label>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setNewExpense({...newExpense, type: 'expense'})}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${newExpense.type === 'expense' ? 'bg-red-50 text-red-500 border-2 border-red-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}
                >지출(-)</button>
                <button 
                  type="button"
                  onClick={() => setNewExpense({...newExpense, type: 'income'})}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${newExpense.type === 'income' ? 'bg-blue-50 text-toss-blue border-2 border-blue-200 shadow-sm' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}
                >수입(+)</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">금액</label>
              <input 
                type="text" inputMode="numeric"
                value={newExpense.amount} 
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '');
                  if (val === '') setNewExpense({...newExpense, amount: ''});
                  else if (!isNaN(Number(val))) setNewExpense({...newExpense, amount: Number(val).toLocaleString()});
                }}
                className="toss-input" placeholder={newExpense.type === 'expense' ? "예: 10,000" : "예: 10,000"} 
              />
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold text-toss-text-secondary mb-3 block">참여자 선택</label>
              <div className="flex flex-wrap gap-2">
                {meeting?.members.map((m: any) => (
                  <button 
                    key={m.id}
                    onClick={() => {
                      if (selectedMembers.includes(m.name)) setSelectedMembers(selectedMembers.filter(x => x !== m.name));
                      else setSelectedMembers([...selectedMembers, m.name]);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${selectedMembers.includes(m.name) ? 'bg-toss-blue text-white border-toss-blue' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
               <label className="text-sm font-bold text-toss-text-secondary mb-3 block">영수증 첨부 (선택)</label>
               <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImagePick} />
               {receiptPreview ? (
                 <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-gray-200 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={receiptPreview} alt="Receipt preview" className="w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                      <span className="text-white font-bold bg-black/50 px-3 py-1 rounded-full text-sm">터치하여 변경</span>
                   </div>
                 </div>
               ) : (
                 <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-gray-50 border-2 border-dashed border-gray-200 hover:bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 font-bold transition-all">
                    <Camera className="w-7 h-7 mb-2 text-gray-300" />
                    <span>영수증 촬영 또는 앨범</span>
                 </button>
               )}
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  if (newExpense.place !== "" || newExpense.amount !== "" || receiptFile !== null) {
                    if (confirm("작성 중인 내용이 모두 지워집니다. 정말 취소할까요?")) {
                      setShowAddForm(false);
                      setEditingExpenseId(null);
                      setNewExpense({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
                      setSearchResults([]);
                      setReceiptFile(null);
                      setReceiptPreview(null);
                      setSelectedMembers(meeting?.members.map((m: any) => m.name) || []);
                    }
                  } else {
                    setShowAddForm(false);
                  }
                }} 
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:bg-gray-200"
              >취소</button>
              <button 
                disabled={loading || !newExpense.place || !newExpense.amount || selectedMembers.length === 0}
                onClick={handleAdd}
                className="flex-[2.5] bg-toss-blue text-white py-4 font-bold text-lg rounded-2xl shadow-lg shadow-blue-500/30 disabled:bg-gray-300 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                {loading ? "처리 중..." : (editingExpenseId ? "수정 완료" : "등록 완료")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
