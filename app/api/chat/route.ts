import { ChatOpenAI } from "@langchain/openai";

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1-mini";

export async function GET() {
  if (!token) {
    return Response.json(
      { error: "Missing GITHUB_TOKEN in environment." },
      { status: 500 },
    );
  }

  try {
    const client = new ChatOpenAI({
      apiKey: token,
      model,
      temperature: 1.0,
      configuration: {
        baseURL: endpoint,
      },
    });

    const response = await client.invoke([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is the capital of France?" },
    ]);

    return Response.json({ answer: response.text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return Response.json(
      { error: "The sample encountered an error.", details: message },
      { status: 500 },
    );
  }
}
