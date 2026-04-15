"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, ReceiptText, Users, Calculator, Camera, Trash2, Home, Search, MapPin, Settings, Wallet, X } from "lucide-react";
import { getExpensesAction, addExpenseAction, editExpenseAction, deleteExpenseAction, getMeetingAction, deleteMeetingAction, getFundPaymentsAction } from "@/app/actions";

export default function ExpensesPage(props: { params: Promise<{ meetingToken: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fundsPayments, setFundsPayments] = useState<any[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  
  const [newExpense, setNewExpense] = useState({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);

  const getYYYYMMDD = (dStr: string | Date | null) => {
    if (!dStr) return "";
    const d = new Date(dStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  useEffect(() => {
    // 기본 디폴트 일자: 이번 달 1일 ~ 말일
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFilterStartDate(getYYYYMMDD(firstDay));
    setFilterEndDate(getYYYYMMDD(lastDay));
  }, []);

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

  const handleDeleteExpense = async () => {
    if (!editingExpenseId) return;
    if (confirm("이 지출 내역을 정말 삭제할까요?")) {
      try {
        setLoading(true);
        await deleteExpenseAction(params.meetingToken, editingExpenseId);
        
        setShowAddForm(false);
        setEditingExpenseId(null);
        setNewExpense({ place: "", merchant: "", merchant_address: "", amount: "", memo: "", type: "expense", spent_date: new Date().toISOString().substring(0, 10), manual_merchant: false });
        setSearchResults([]);
        setReceiptFile(null);
        setReceiptPreview(null);
        
        await fetchBaseData();
      } catch (err) {
        console.error(err);
        alert("지출 삭제 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
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

  // 리스트용 월별 필터링
  const filteredExpenses = expenses.filter(e => {
    const dStr = getYYYYMMDD(e.spent_date || e.created_at);
    if (filterStartDate && dStr < filterStartDate) return false;
    if (filterEndDate && dStr > filterEndDate) return false;
    return true;
  });

  // 상단 잔액 카드는 전체 기간 기준으로 표시 (기간을 바꿔도 공금/잔액은 변경되지 않도록 고정)
  const allTimeTotalAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const remainingPot = totalPot - allTimeTotalAmount;
  const allTimeAmountForDisplay = expenses.reduce((acc, curr) => acc - Number(curr.amount), 0);
  const balancePrefix = allTimeAmountForDisplay > 0 ? "+" : "";

  // 현재 필터된 항목들 날짜별로 그룹화
  const sortedFilteredExpenses = [...filteredExpenses].sort((a, b) => {
    const dStrA = getYYYYMMDD(a.spent_date || a.created_at);
    const dStrB = getYYYYMMDD(b.spent_date || b.created_at);
    if (dStrA > dStrB) return -1;
    if (dStrA < dStrB) return 1;
    return b.id - a.id; 
  });

  const groupedExpenses: { [dateStr: string]: any[] } = {};
  sortedFilteredExpenses.forEach(exp => {
    const dStr = getYYYYMMDD(exp.spent_date || exp.created_at);
    if (!groupedExpenses[dStr]) groupedExpenses[dStr] = [];
    groupedExpenses[dStr].push(exp);
  });

  const shiftMonth = (offset: number) => {
    let d = new Date();
    if (filterStartDate && filterEndDate) {
       d = new Date(filterStartDate);
    }
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFilterStartDate(getYYYYMMDD(firstDay));
    setFilterEndDate(getYYYYMMDD(lastDay));
  };

  const getDisplayDuration = () => {
    if (!filterStartDate && !filterEndDate) return "전체 기간";
    if (filterStartDate && filterEndDate) {
       const d1 = new Date(filterStartDate);
       const d2 = new Date(filterEndDate);
       const lastDayOfD1M = new Date(d1.getFullYear(), d1.getMonth() + 1, 0);
       
       if (d1.getDate() === 1 && d2.getTime() === lastDayOfD1M.getTime()) {
           return `${d1.getFullYear()}년 ${d1.getMonth() + 1}월`;
       }
       return `${filterStartDate.replace(/-/g, '.')} ~ ${filterEndDate.replace(/-/g, '.')}`;
    }
    return `${filterStartDate || filterEndDate} 기준`;
  };

  return (
    <div className="flex flex-col flex-1 bg-toss-bg relative min-h-screen">
      <header className="px-4 h-14 flex items-center justify-between bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <button onClick={() => router.push("/home")} className="p-2 -ml-2 relative z-10">
          <ChevronLeft className="w-6 h-6 text-toss-text" />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-bold text-lg text-toss-text truncate px-20 text-center w-full">{meeting?.meeting_name || "지출 내역"}</div>
        </div>
        <div className="flex items-center justify-end space-x-1 -mr-2 relative z-10">
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
        <div className="flex items-center justify-center mb-6 relative">
          <h2 className="text-xl font-extrabold text-toss-text text-center w-full">결제 상세</h2>
          <button 
            onClick={() => router.push(`/${params.meetingToken}/account`)}
            className="absolute right-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-toss-text-secondary font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            총무 계좌 보기
          </button>
        </div>

        <div className="bg-toss-blue text-white p-6 rounded-[24px] shadow-lg shadow-blue-500/20 mb-8 relative overflow-hidden">
          {totalPot > 0 || meeting?.duration_type === 'long_term' ? (
            <>
              <div className="flex items-center justify-between mb-1 relative z-10">
                <p className="text-blue-100 font-medium">남은 공금</p>
                <button 
                  onClick={() => router.push(`/${params.meetingToken}/funds`)} 
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm backdrop-blur-sm"
                >
                  <Wallet className="w-4 h-4 mr-1" /> 회비(장부) 관리
                </button>
              </div>
              <div className="text-4xl font-extrabold mb-4 relative z-10">{remainingPot > 0 ? `+${remainingPot.toLocaleString()}` : remainingPot.toLocaleString()}원</div>
            </>
          ) : (
            <>
              <p className="text-blue-100 font-medium mb-1 relative z-10">현재 잔액</p>
              <div className="text-4xl font-extrabold mb-5 relative z-10">{balancePrefix}{allTimeAmountForDisplay.toLocaleString()}원</div>
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

        <div className="flex items-center justify-between mb-4 mt-6">
          <button onClick={() => shiftMonth(-1)} className="p-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full transition-colors flex-shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setShowFilterModal(true)}
            className="text-[19px] font-bold text-toss-text hover:bg-gray-100 py-2 px-4 rounded-xl transition-colors active:scale-95"
          >
            {getDisplayDuration()}
          </button>
          
          <button onClick={() => shiftMonth(1)} className="p-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full transition-colors flex-shrink-0">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="flex justify-between items-end mb-6 px-1">
          <h3 className="font-bold text-toss-text-secondary">상세 내역</h3>
          <span className="text-sm font-semibold text-toss-text-secondary bg-gray-100 px-3 py-1 rounded-lg">
            {filteredExpenses.length}건
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
            <ReceiptText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">해당 월에 등록된 지출/수입이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a)).map(dateStr => {
              const d = new Date(dateStr);
              const dayStr = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
              
              return (
                <div key={dateStr}>
                  {/* 날짜 헤더 */}
                  <h4 className="font-extrabold text-toss-text text-lg mb-4 ml-1 flex items-baseline">
                    <span className="text-xl">{d.getMonth() + 1}월 {d.getDate()}일</span>
                    <span className="text-gray-400 text-sm ml-2 font-semibold bg-gray-100 px-2.5 py-0.5 rounded-md">{dayStr}요일</span>
                  </h4>
                  
                  <div className="space-y-3">
                    {groupedExpenses[dateStr].map(exp => (
                      <div 
                        key={exp.id.toString()} 
                        onClick={() => openEditModal(exp)}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex gap-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        {exp.receipt_url ? (
                          <div 
                            className="w-14 h-14 rounded-2xl flex-shrink-0 bg-gray-100 overflow-hidden border border-gray-200 shadow-inner group relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage(exp.receipt_url);
                            }}
                          >
                            <img src={exp.receipt_url} alt="receipt" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <Plus className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-2xl flex-shrink-0 bg-blue-50 flex items-center justify-center text-toss-blue">
                             <ReceiptText className="w-6 h-6 opacity-60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex justify-between items-start gap-2 mb-0.5">
                            <div className="font-bold text-[17px] text-toss-text truncate flex-1 min-w-0 tracking-tight">{exp.place_name}</div>
                            <span className={`font-extrabold text-[17px] tracking-tight flex-shrink-0 ${Number(exp.amount) < 0 ? 'text-toss-blue' : 'text-red-500'}`}>
                              {Number(exp.amount) < 0 
                                ? `+ ${Math.abs(Number(exp.amount)).toLocaleString()}원` 
                                : `- ${Number(exp.amount).toLocaleString()}원`
                              }
                            </span>
                          </div>
                          
                          {exp.merchant_name && (
                            <div className="flex items-center text-xs text-gray-500 mb-2 mt-0.5">
                              <MapPin className="w-3 h-3 mr-1 flex-shrink-0 opacity-60" />
                              <span className="truncate">{exp.merchant_name} {exp.merchant_address ? `(${exp.merchant_address})` : ''}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center text-[13px] text-toss-text-secondary bg-gray-50/80 px-2.5 py-1.5 rounded-xl w-fit font-medium border border-gray-100">
                            <Users className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            <span className="max-w-[150px] truncate">{exp.expense_members.map((em: any) => em.members.name).join(", ")}</span>
                            <span className="text-gray-400 ml-1 font-semibold flex-shrink-0">외 {exp.expense_members.length > 1 ? exp.expense_members.length - 1 : 0}명 참여</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-200" style={{maxWidth: '480px', left: '50%', transform: 'translateX(-50%)'}}>
          <div className="bg-white rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom-full duration-300 transform-gpu shadow-2xl">
            <div className="flex items-center justify-center mb-6 relative">
              <h3 className="text-xl font-bold text-toss-text text-center w-full">기간 조회</h3>
              <button onClick={() => setShowFilterModal(false)} className="absolute right-0 text-gray-400 font-bold p-2 z-10">닫기</button>
            </div>
            
            <div className="flex items-center gap-2 mb-6">
              <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="toss-input flex-1 min-w-0" />
              <span className="font-bold text-gray-400">~</span>
              <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="toss-input flex-1 min-w-0" />
            </div>

            <div className="grid grid-cols-4 gap-2 mb-8">
              {[1, 3, 6, 12].map(m => (
                <button 
                  key={m}
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(start.getMonth() - m);
                    setFilterStartDate(getYYYYMMDD(start));
                    setFilterEndDate(getYYYYMMDD(end));
                  }}
                  className="py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors text-xs"
                >
                  {m === 12 ? '1년' : `${m}개월`}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setShowFilterModal(false);
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
              >
                초기화
              </button>
              <button 
                onClick={() => {
                  if (filterStartDate && filterEndDate) {
                    const d1 = new Date(filterStartDate);
                    const d2 = new Date(filterEndDate);
                    const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24);
                    if (d1 > d2) return alert("시작일이 종료일보다 클 수 없습니다.");
                    if (diffDays > 366) return alert("최대 1년 단위로만 조회 가능합니다.");
                  }
                  setShowFilterModal(false);
                }}
                className="flex-[2] py-4 bg-toss-blue text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all"
              >
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-200" style={{maxWidth: '480px', left: '50%', transform: 'translateX(-50%)'}}>
          <div className="bg-white rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom-full duration-300 transform-gpu overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-center mb-6 relative">
              <h3 className="text-xl font-bold text-toss-text text-center w-full">{editingExpenseId ? "지출 내역 수정" : "새 지출 등록"}</h3>
              {editingExpenseId && (
                <button
                  type="button"
                  onClick={handleDeleteExpense}
                  className="absolute right-0 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center z-10"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              )}
            </div>
            
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
      
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white p-2 rounded-full bg-black/50 hover:bg-black/80 transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={lightboxImage} 
            alt="Receipt Fullscreen" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing
          />
        </div>
      )}
    </div>
  );
}
