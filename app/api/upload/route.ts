import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { qdrant, ensureCollection } from "@/lib/Qdrantdb_config";
import { embeddings } from "@/lib/embeddings";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files allowed" },
        { status: 400 },
      );
    }

    console.log(`📄 Processing: ${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);

    if (!parsed.text?.trim()) {
      return NextResponse.json(
        { error: "PDF has no readable text" },
        { status: 400 },
      );
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const docs = await splitter.createDocuments([parsed.text]);
    console.log(`Created ${docs.length} chunks`);

    const vectors = await embeddings.embedDocuments(
      docs.map((d) => d.pageContent),
    );

    await ensureCollection();

    const points = vectors.map((vec, i) => ({
      id: uuid(),
      vector: vec,
      payload: {
        text: docs[i].pageContent,
        source: file.name,
        chunkIndex: i,
      },
    }));

    await qdrant.upsert("pdf_docs", {
      wait: true,
      points,
    });

    console.log(`✅ Upserted ${points.length} vectors for: ${file.name}`);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      chunks: points.length,
      pages: parsed.numpages,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 },
    );
  }
}
