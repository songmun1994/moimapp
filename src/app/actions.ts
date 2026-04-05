"use server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encryptData, decryptData } from "@/lib/crypto";

const prisma = new PrismaClient();

// JSON 변환시 BigInt 및 Decimal(Prisma) 직렬화 처리 헬퍼
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// 파일 업로드 처리 헬퍼 (로컬 환경 기준)
async function saveFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const uploadDir = path.join(process.cwd(), "public/moim/uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  
  return `/moim/uploads/${fileName}`; // 브라우저가 읽을 경로
}

// 1. 모임 생성 액션
export async function createMeetingAction(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const durationType = formData.get("duration_type") as "short_term" | "long_term";
  const upfrontDues = Number(formData.get("upfrontDues") || 0);
  const bank = formData.get("bankInfo.bank") as string;
  const account = formData.get("bankInfo.account") as string;
  const holder = formData.get("bankInfo.holder") as string;
  
  const membersData = JSON.parse(formData.get("members") as string) as string[];
  const coverImageFile = formData.get("coverImage") as File | null;
  const scheduleType = formData.get("scheduleType") as "weekly" | "monthly" | "yearly" | null;
  const scheduleDay = formData.get("scheduleDay") ? parseInt(formData.get("scheduleDay") as string) : null;
  const recurringAmount = formData.get("recurringAmount") ? Number(formData.get("recurringAmount")) : 0;
  
  const coverImageUrl = await saveFile(coverImageFile);
  const publicToken = crypto.randomUUID();

  const scheduleData = scheduleType ? {
    create: {
      recurring_type: scheduleType,
      recurring_day_of_week: scheduleType === 'weekly' ? scheduleDay : null,
      recurring_day_of_month: (scheduleType === 'monthly' || scheduleType === 'yearly') ? scheduleDay : null,
      recurring_amount: recurringAmount
    }
  } : undefined;

  // DB에 모임 및 구성원 동시 생성
  const meeting = await prisma.meetings.create({
    data: {
      meeting_name: name,
      description: description,
      duration_type: durationType,
      public_token: publicToken,
      upfront_dues: upfrontDues,
      member_count: membersData.length,
      account_bank: bank,
      account_number: account ? encryptData(account) : null,
      account_holder: holder,
      cover_image_url: coverImageUrl,
      members: {
        create: membersData.map((m, i) => ({
          name: m,
          sort_order: i
        }))
      },
      meeting_schedules: scheduleData
    }
  });

  return serializeBigInt({ token: publicToken });
}

// 2. 단일 모임 정보 호출
export async function getMeetingAction(token: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    include: { members: { orderBy: { sort_order: 'asc' } } }
  });
  
  if (meeting && meeting.account_number) {
    meeting.account_number = decryptData(meeting.account_number);
  }
  
  return serializeBigInt(meeting);
}

// 3. 지출 내역 호출
export async function getExpensesAction(token: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    select: { id: true }
  });
  if (!meeting) return [];
  
  const expenses = await prisma.expenses.findMany({
    where: { meeting_id: meeting.id },
    include: {
      expense_members: {
        include: { members: true }
      }
    },
    orderBy: { created_at: 'asc' }
  });
  return serializeBigInt(expenses);
}

// 4. 지출 추가
export async function addExpenseAction(token: string, formData: FormData) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    include: { members: true }
  });
  if (!meeting) throw new Error("Not found");
  
  const placeName = formData.get("place_name") as string;
  const merchantName = formData.get("merchant_name") as string | null;
  const merchantAddress = formData.get("merchant_address") as string | null;
  
  let amount = Number(formData.get("amount"));
  const expenseType = formData.get("expenseType") as string;
  if (expenseType === "income") {
    amount = -Math.abs(amount);
  }
  
  const spentDateStr = formData.get("spent_date") as string | null;
  const spentDate = spentDateStr ? new Date(spentDateStr) : new Date();

  const receiptFile = formData.get("receiptImage") as File | null;
  const selectedMemberNames = JSON.parse(formData.get("selectedMembers") as string) as string[];
  
  const receiptUrl = await saveFile(receiptFile);
  
  const validMemberIds = meeting.members
    .filter(m => selectedMemberNames.includes(m.name))
    .map(m => m.id);

  const expense = await prisma.expenses.create({
    data: {
      meeting_id: meeting.id,
      place_name: placeName,
      merchant_name: merchantName,
      merchant_address: merchantAddress,
      amount: amount,
      ...(spentDateStr && { spent_date: new Date(spentDateStr) }),
      ...(receiptUrl && { receipt_url: receiptUrl }),
      expense_members: {
        create: validMemberIds.map(memberId => ({
          member_id: memberId
        }))
      }
    }
  });
  
  return serializeBigInt({ success: true });
}

export async function editExpenseAction(token: string, expenseIdStr: string, formData: FormData) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    include: { members: true }
  });
  if (!meeting) throw new Error("Not found");
  
  const placeName = formData.get("place_name") as string;
  const merchantName = formData.get("merchant_name") as string | null;
  const merchantAddress = formData.get("merchant_address") as string | null;
  
  let amount = Number(formData.get("amount"));
  const expenseType = formData.get("expenseType") as string;
  if (expenseType === "income") {
    amount = -Math.abs(amount);
  }
  const receiptFile = formData.get("receiptImage") as File | null;
  const selectedMemberNames = JSON.parse(formData.get("selectedMembers") as string) as string[];
  
  const validMemberIds = meeting.members
    .filter(m => selectedMemberNames.includes(m.name))
    .map(m => m.id);

  const spentDateStr = formData.get("spent_date") as string | null;

  let updateData: any = {
    place_name: placeName,
    merchant_name: merchantName,
    merchant_address: merchantAddress,
    amount: amount,
    ...(spentDateStr && { spent_date: new Date(spentDateStr) })
  };

  if (receiptFile && receiptFile.size > 0) {
    const receiptUrl = await saveFile(receiptFile);
    if (receiptUrl) updateData.receipt_url = receiptUrl;
  }

  await prisma.$transaction([
    prisma.expense_members.deleteMany({
      where: { expense_id: BigInt(expenseIdStr) }
    }),
    prisma.expenses.update({
      where: { id: BigInt(expenseIdStr) },
      data: {
        ...updateData,
        expense_members: {
          create: validMemberIds.map(memberId => ({
            member_id: memberId
          }))
        }
      }
    })
  ]);
  
  return serializeBigInt({ success: true });
}

// 5. 모임 삭제
export async function deleteMeetingAction(token: string) {
  await prisma.meetings.delete({
    where: { public_token: token }
  });
  return { success: true };
}

// 6. 도래한 정기 회비 모임 조회
export async function getDueMeetingsAction(tokens: string[]) {
  if (tokens.length === 0) return [];
  
  const meetings = await prisma.meetings.findMany({
    where: { public_token: { in: tokens } },
    include: { meeting_schedules: true }
  });
  
  const today = new Date();
  const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon...7=Sun
  const currentDayOfMonth = today.getDate();
  
  const dueMeetings = meetings.filter(m => {
    if (m.duration_type !== 'long_term' || !m.meeting_schedules) return false;
    const sch = m.meeting_schedules;
    if (sch.recurring_type === 'weekly' && sch.recurring_day_of_week === currentDayOfWeek) return true;
    if ((sch.recurring_type === 'monthly' || sch.recurring_type === 'yearly') && sch.recurring_day_of_month === currentDayOfMonth) return true;
    return false;
  });
  
  return serializeBigInt(dueMeetings);
}

// 7. 정기 회비 승인 (기본 회비만큼 누적, 혹은 체크된 인원 수만큼 부분 수납 지원)
export async function approveMeetingDuesAction(token: string, checkedCount?: number) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    include: { members: true }
  });
  if (!meeting) throw new Error("Not found");
  
  const count = checkedCount !== undefined ? checkedCount : meeting.members.length;
  if (count <= 0) return { success: true };
  
  // 회비 정기 납부를 "수입(+)" 항목으로 타임라인에 삽입
  const totalDue = Number(meeting.upfront_dues) * count;
  if (totalDue > 0) {
    await prisma.expenses.create({
      data: {
        meeting_id: meeting.id,
        place_name: `정기 회비 납부 (${count}명 수납 완료)`,
        amount: -totalDue,
        expense_members: {
          create: meeting.members.slice(0, count).map(m => ({ member_id: m.id }))
        }
      }
    });
  }
}

// 8. 모임 기본 정보 수정
export async function updateMeetingAction(token: string, formData: FormData) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token }
  });
  if (!meeting) throw new Error("Meeting not found");

  const name = formData.get("name") as string | null;
  const description = formData.get("description") as string | null;
  const accountBank = formData.get("bankInfo.bank") as string | null;
  const accountHolder = formData.get("bankInfo.holder") as string | null;
  const accountRaw = formData.get("bankInfo.account") as string | null;
  const upfrontDues = formData.get("upfrontDues");
  const scheduleType = formData.get("scheduleType") as string | null;
  const scheduleDay = formData.get("scheduleDay");
  const recurringAmount = formData.get("recurringAmount");

  const dataToUpdate: any = {};
  if (name) dataToUpdate.meeting_name = name;
  if (description !== null) dataToUpdate.description = description;
  if (upfrontDues !== null) dataToUpdate.upfront_dues = Number(upfrontDues);

  if (accountBank !== null) dataToUpdate.account_bank = accountBank;
  if (accountHolder !== null) dataToUpdate.account_holder = accountHolder;
  // If the account number is empty string, we clear it. If filled, we encrypt it.
  if (accountRaw !== null) {
    dataToUpdate.account_number = accountRaw ? encryptData(accountRaw) : null;
  }

  await prisma.meetings.update({
    where: { public_token: token },
    data: dataToUpdate
  });

  if (scheduleType && scheduleType !== 'none') {
    await prisma.meeting_schedules.upsert({
      where: { meeting_id: meeting.id },
      create: {
        meeting_id: meeting.id,
        recurring_type: scheduleType as any,
        recurring_day_of_week: scheduleType === 'weekly' ? Number(scheduleDay) : null,
        recurring_day_of_month: (scheduleType === 'monthly' || scheduleType === 'yearly') ? Number(scheduleDay) : null,
        recurring_amount: Number(recurringAmount)
      },
      update: {
        recurring_type: scheduleType as any,
        recurring_day_of_week: scheduleType === 'weekly' ? Number(scheduleDay) : null,
        recurring_day_of_month: (scheduleType === 'monthly' || scheduleType === 'yearly') ? Number(scheduleDay) : null,
        recurring_amount: Number(recurringAmount)
      }
    });
  } else if (scheduleType === 'none') {
    // If they switched to 'none', we should delete the existing schedule if it exists
    try {
       await prisma.meeting_schedules.delete({
         where: { meeting_id: meeting.id }
       });
    } catch(e) {}
  }

  return serializeBigInt({ success: true });
}

// 9. 멤버 수동 추가
export async function addMemberAction(token: string, newName: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token },
    include: { members: true }
  });
  if (!meeting) throw new Error("Meeting not found");

  const nextSortOrder = meeting.members.length;
  
  await prisma.members.create({
    data: {
      meeting_id: meeting.id,
      name: newName,
      sort_order: nextSortOrder
    }
  });

  await prisma.meetings.update({
    where: { id: meeting.id },
    data: { member_count: meeting.member_count + 1 }
  });

  return serializeBigInt({ success: true });
}

// 10. 멤버 수동 삭제 (지출 내역 없을 시)
export async function removeMemberAction(token: string, memberIdStr: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token }
  });
  if (!meeting) throw new Error("Meeting not found");

  const memberId = BigInt(memberIdStr);

  const usageCount = await prisma.expense_members.count({
    where: { member_id: memberId }
  });

  if (usageCount > 0) {
    return serializeBigInt({ success: false, error: "이 멤버가 참여한 지출 내역이 존재하여 삭제할 수 없습니다." });
  }

  await prisma.members.delete({
    where: { id: memberId }
  });

  await prisma.meetings.update({
    where: { id: meeting.id },
    data: { member_count: { decrement: 1 } }
  });

  return serializeBigInt({ success: true });
}

// 11. 공금(회비) 납부 내역 조회
export async function getFundPaymentsAction(token: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token }
  });
  if (!meeting) return [];

  const payments = await prisma.funds_payments.findMany({
    where: { meeting_id: meeting.id },
    include: {
      members: { select: { name: true, sort_order: true } }
    },
    orderBy: { payment_date: 'desc' }
  });

  return serializeBigInt(payments);
}

// 12. 공금 납부 기록 추가
export async function addFundPaymentAction(token: string, memberIdStr: string, amount: number, memo?: string, paymentDateStr?: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token }
  });
  if (!meeting) throw new Error("Meeting not found");

  const paymentDate = paymentDateStr ? new Date(paymentDateStr) : new Date();

  await prisma.funds_payments.create({
    data: {
      meeting_id: meeting.id,
      member_id: BigInt(memberIdStr),
      amount: amount,
      payment_date: paymentDate,
      memo: memo || ""
    }
  });

  return serializeBigInt({ success: true });
}

// 13. 공금 납부 기록 삭제
export async function deleteFundPaymentAction(token: string, paymentIdStr: string) {
  const meeting = await prisma.meetings.findUnique({
    where: { public_token: token }
  });
  if (!meeting) throw new Error("Meeting not found");

  const payment = await prisma.funds_payments.findFirst({
    where: { id: BigInt(paymentIdStr), meeting_id: meeting.id }
  });

  if (!payment) throw new Error("Payment record not found for this meeting");

  await prisma.funds_payments.delete({
    where: { id: BigInt(paymentIdStr) }
  });

  return serializeBigInt({ success: true });
}
