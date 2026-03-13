import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { qdrant, ensureCollection } from "@/lib/Qdrantdb_config";
import { embeddings } from "@/lib/embeddings";
import { model } from "@/lib/Gimine";

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  context: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  question: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  uploadedFiles: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
});

async function retrieveContext(state: typeof GraphState.State) {
  const question = state.question;
  try {
    await ensureCollection();
    const vector = await embeddings.embedQuery(question);
    const results = await qdrant.search("pdf_docs", {
      vector,
      limit: 6,
    });
    const context = results
      .filter((r) => r.score > 0.4)
      .map((r) => {
        const source = r.payload?.source as string;
        const text = r.payload?.text as string;
        return `[Source: ${source}]\n${text}`;
      })
      .join("\n\n---\n\n");

    return { context: context || "" };
  } catch (err) {
    console.error("Qdrant search error:", err);
    return { context: "" };
  }
}

function buildSystemPrompt(
  hasContext: boolean,
  context: string,
  uploadedFiles: string[],
  fileListText: string
): string {
  if (hasContext) {
    return `You are a helpful AI assistant with access to PDF document content.

The user has uploaded the following PDF files in this session:
${fileListText}

Each chunk of retrieved content is tagged with [Source: filename] so you know which PDF it came from.

IMPORTANT RULES:
1. You HAVE read all the uploaded PDFs. Never say you cannot read or access PDFs.
2. Never say "I don't have the capability to view files".
3. Never ask the user to paste or copy text.
4. When answering, mention which PDF the information came from if relevant.
5. If the user asks how many PDFs they sent, answer correctly based on the file list above.
6. If the user asks about a specific PDF, only use chunks from that source.
7. If the PDF content doesn't contain the answer, say "This information is not in the uploaded PDFs."
8. Format your response using markdown — use **bold**, headings, bullet points, numbered lists, and code blocks where appropriate.

RETRIEVED PDF CONTENT:
${context}`;
  }

  return `You are a helpful AI assistant that can also analyze PDF documents when uploaded.

${
  uploadedFiles.length > 0
    ? `The user has uploaded these PDFs in this session:\n${fileListText}\nThe current question did not match relevant content from these PDFs — just answer conversationally or let the user know if they need to rephrase.`
    : ``
}

RULES:
- Answer all questions normally and conversationally.
- Format your response using markdown — use **bold**, headings, bullet points, and code blocks where appropriate.
- Only mention PDFs or the upload button if the user explicitly asks about PDFs, mentions uploading a file, or asks you to read/check a document.
- Do NOT bring up PDFs unprompted.
- Never say you cannot read PDFs.`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      pdfUploaded,
      fileName,
      uploadedFiles = [],
    } = await req.json();

    const question = message?.trim()
      ? pdfUploaded
        ? `[User uploaded PDF: ${fileName}]\n\nUser's question: ${message}`
        : message
      : pdfUploaded
        ? `The user has uploaded a PDF file named "${fileName}". Please analyze it and provide a summary of its contents.`
        : "";

    if (!question) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let context = "";
    try {
      await ensureCollection();
      const vector = await embeddings.embedQuery(question);
      const results = await qdrant.search("pdf_docs", { vector, limit: 6 });
      context = results
        .filter((r) => r.score > 0.4)
        .map((r) => `[Source: ${r.payload?.source}]\n${r.payload?.text}`)
        .join("\n\n---\n\n");
    } catch (err) {
      console.error("Qdrant search error:", err);
    }

    const hasContext = context.trim() !== "";
    const fileListText =
      uploadedFiles.length > 0
        ? uploadedFiles.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")
        : "None";

    const systemPrompt = buildSystemPrompt(hasContext, context, uploadedFiles, fileListText);

    const pastMessages: BaseMessage[] = history.flatMap(
      (h: { role: string; text: string }) =>
        h.role === "user" ? [new HumanMessage(h.text)] : [new AIMessage(h.text)]
    );

    const invokeMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...pastMessages,
      new HumanMessage(question),
    ];

    const stream = await model.stream(invokeMessages);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ contextUsed: hasContext })}\n\n`)
        );

        for await (const chunk of stream) {
          const text = chunk.content as string;
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}