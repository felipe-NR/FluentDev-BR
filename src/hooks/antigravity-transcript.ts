import { open } from "node:fs/promises";
import { z } from "zod";

// The Antigravity CLI hook payloads carry no turn id and, in agy 1.4.7, no
// final model output on Stop. Both come from the conversation transcript that
// every payload names in `transcriptPath` (S8, docs/compatibility.md). The
// reader scans the transcript from the end and keeps nothing but the step index
// of the last user input and the model text written after it.

const CHUNK_BYTES = 64 * 1024;
const MAX_TAIL_BYTES = 16 * 1024 * 1024;

const TranscriptStep = z.looseObject({
  step_index: z.number().int().nonnegative(),
  type: z.string(),
  content: z.string().optional(),
});

export interface TranscriptTurn {
  // Step index of the user input that opened the current turn.
  readonly userInputStep: number;
  // Text of every model response after that input, oldest first.
  readonly assistantText: string;
}

export async function readCurrentTurn(path: string): Promise<TranscriptTurn | undefined> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    let position = size;
    let tail = Buffer.alloc(0);
    while (position > 0 && size - position < MAX_TAIL_BYTES) {
      const length = Math.min(CHUNK_BYTES, position);
      position -= length;
      const chunk = Buffer.alloc(length);
      await handle.read(chunk, 0, length, position);
      tail = Buffer.concat([chunk, tail]);
      const turn = findCurrentTurn(tail.toString("utf8"), position === 0);
      if (turn !== undefined) {
        return turn;
      }
    }
    return undefined;
  } finally {
    await handle.close();
  }
}

// Walk the lines from the end. When the text does not start at the beginning of
// the file, its first line may be cut, so it is skipped until more is read.
export function findCurrentTurn(text: string, startsAtFileBeginning: boolean): TranscriptTurn | undefined {
  const lines = text.split("\n");
  const first = startsAtFileBeginning ? 0 : 1;
  const responses: string[] = [];
  for (let index = lines.length - 1; index >= first; index -= 1) {
    const step = parseStep(lines[index] ?? "");
    if (step === undefined) {
      continue;
    }
    if (step.type === "USER_INPUT") {
      return { userInputStep: step.step_index, assistantText: responses.reverse().join("\n") };
    }
    if (step.type === "PLANNER_RESPONSE" && step.content !== undefined && step.content !== "") {
      responses.push(step.content);
    }
  }
  return undefined;
}

function parseStep(line: string): z.infer<typeof TranscriptStep> | undefined {
  if (!line.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = TranscriptStep.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
