export type IntentTag = "ACTION_ITEM" | "DECISION" | "OPEN_QUESTION" | "REFERENCE";

/**
 * AI Intent Classifier — rule-based fallback used by the backend.
 */
export class AIClassifierService {
  classifyText(text: string): IntentTag {
    const normalized = text.trim().toLowerCase();

    if (!normalized) {
      return "REFERENCE";
    }

    if (
      normalized.startsWith("todo") ||
      normalized.startsWith("to-do") ||
      normalized.startsWith("action:") ||
      normalized.startsWith("next step") ||
      /\b(todo|action item|follow up|follow-up|ship|implement|fix|assign|complete)\b/.test(
        normalized
      )
    ) {
      return "ACTION_ITEM";
    }

    if (
      normalized.startsWith("decided") ||
      normalized.startsWith("decision") ||
      /\b(decided|decision|approved|finalized|we will|agreed)\b/.test(normalized)
    ) {
      return "DECISION";
    }

    if (
      normalized.includes("?") ||
      normalized.startsWith("how") ||
      normalized.startsWith("why") ||
      normalized.startsWith("what") ||
      normalized.startsWith("when") ||
      normalized.startsWith("who")
    ) {
      return "OPEN_QUESTION";
    }

    return "REFERENCE";
  }
}
