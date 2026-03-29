import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";

function resolveEnvVars(value) {
  return String(value).replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

const OFFICIAL_MODEL_ALIASES = {
  "gpt-4o-mini": "gpt-4o-mini-2024-07-18",
  "gpt-4o": "gpt-4o-2024-08-06",
};

function getAnscheckPrompt(task, question, answer, response, abstention = false) {
  if (!abstention) {
    if (task === "single-session-user" || task === "single-session-assistant" || task === "multi-session") {
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;
    }
    if (task === "temporal-reasoning") {
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;
    }
    if (task === "knowledge-update") {
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.\n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;
    }
    if (task === "single-session-preference") {
      return `I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.\n\nQuestion: ${question}\n\nRubric: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;
    }
    throw new Error(`Unsupported LongMemEval task for compatible evaluator: ${task}`);
  }

  return `I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.\n\nQuestion: ${question}\n\nExplanation: ${answer}\n\nModel Response: ${response}\n\nDoes the model correctly identify the question as unanswerable? Answer yes or no only.`;
}

function resolveCompatibleModel(config) {
  if (config?.model) {
    return config.model;
  }
  return OFFICIAL_MODEL_ALIASES[config.metricModel] || config.metricModel;
}

async function requestEvalLabel(client, model, prompt) {
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    n: 1,
    temperature: 0,
    max_tokens: 10,
  });
  const response = completion.choices?.[0]?.message?.content?.trim() || "";
  return response.toLowerCase().includes("yes");
}

export async function runCompatibleEvaluator(evaluatorConfig, metricModel, hypothesesPath, referencePath) {
  const apiKey = resolveEnvVars(evaluatorConfig.apiKey);
  const client = new OpenAI({
    apiKey,
    baseURL: evaluatorConfig.baseURL,
    defaultHeaders: evaluatorConfig.headers,
    timeout: evaluatorConfig.timeoutMs ?? 30_000,
  });
  const model = resolveCompatibleModel({
    ...evaluatorConfig,
    metricModel,
  });

  const hypotheses = (await readFile(hypothesesPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const references = JSON.parse(await readFile(referencePath, "utf8"));
  const qidToReference = new Map(references.map((entry) => [String(entry.question_id), entry]));
  const resultFile = `${hypothesesPath}.eval-results-${metricModel}`;
  const logs = [];

  for (const entry of hypotheses) {
    const reference = qidToReference.get(String(entry.question_id));
    if (!reference) {
      continue;
    }
    const prompt = getAnscheckPrompt(
      reference.question_type,
      reference.question,
      reference.answer,
      entry.hypothesis,
      String(entry.question_id).includes("_abs"),
    );
    const label = await requestEvalLabel(client, model, prompt);
    logs.push({
      question_id: entry.question_id,
      hypothesis: entry.hypothesis,
      autoeval_label: {
        model,
        label,
      },
    });
  }

  await writeFile(
    resultFile,
    `${logs.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );

  return {
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: "",
    officialEvalPath: resultFile,
  };
}
