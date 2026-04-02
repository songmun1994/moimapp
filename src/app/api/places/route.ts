import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ documents: [] });
  }

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_KEY) {
    console.error("KAKAO_REST_API_KEY is not set in .env");
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_KEY}`,
      },
    });
    
    if (!res.ok) {
        throw new Error("Failed to fetch from Kakao API");
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
  }
}
