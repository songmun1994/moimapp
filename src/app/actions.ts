"use server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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
  
  const uploadDir = path.join(process.cwd(), "public/uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  
  return `/uploads/${fileName}`; // 브라우저가 읽을 경로
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
  
  const coverImageUrl = await saveFile(coverImageFile);
  const publicToken = crypto.randomUUID();

  const scheduleData = scheduleType ? {
    create: {
      recurring_type: scheduleType,
      recurring_day_of_week: scheduleType === 'weekly' ? scheduleDay : null,
      recurring_day_of_month: (scheduleType === 'monthly' || scheduleType === 'yearly') ? scheduleDay : null,
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
      account_number: account,
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
      receipt_url: receiptUrl,
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

  let updateData: any = {
    place_name: placeName,
    merchant_name: merchantName,
    merchant_address: merchantAddress,
    amount: amount,
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

