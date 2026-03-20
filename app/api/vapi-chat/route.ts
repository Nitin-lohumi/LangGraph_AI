import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const res = await fetch("https://api.vapi.ai/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      input: message,
    }),
  });

  const data = await res.json();
  console.log("Vapi response:", JSON.stringify(data));
  const reply = data?.output?.[0]?.content || "No response";

  return NextResponse.json({ reply });
}
