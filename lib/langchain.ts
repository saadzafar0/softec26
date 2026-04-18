import { ChatOpenAI } from "@langchain/openai";

const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1-mini";

export function createChatModel() {
  return new ChatOpenAI({
    apiKey: process.env["GITHUB_TOKEN"],
    model,
    temperature: 1.0,
    configuration: {
      baseURL: endpoint,
    },
  });
}
