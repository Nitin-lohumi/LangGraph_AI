const HF_API_URL =
  "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";
const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN!;

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace embedding error: ${err}`);
  }

  const data = await res.json();
  if (Array.isArray(data[0])) {
    return data[0] as number[];
  }
  return data as number[];
}

export const embeddings = {
  embedQuery: (text: string) => embedText(text),
  embedDocuments: (texts: string[]) => Promise.all(texts.map(embedText)),
};
