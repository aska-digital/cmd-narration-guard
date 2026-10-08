// Pure detection logic: an assistant turn that narrates executed work while
// containing no tool calls. Real-world pattern (session 01dc5eb3, PR work):
// the turn "Fix applied. Tests pass (29 passed). Committed and pushed..."
// with zero tool_use blocks; the fabricated transcript then seeded the next
// seven turns. Kept conservative to avoid flagging legitimate final summaries
// that mention one completed action after earlier tool turns did the work.

export interface Detection {
	flagged: boolean;
	reasons: string[];
}

// Past-tense pipeline verbs that imply a tool effect (edit, push, post...).
const EXECUTION_VERB =
	/\b(?:pushed|committed|posted|merged|amended|rebased|applied|deployed|installed|uninstalled|edited|overwrote|rewrote|deleted|removed|created|wrote|updated|pinned|tagged|released|published|annotated|appended|restored|rolled back|cleaned up)\b/gi;

// Evidence markers that cite a specific artifact of execution: commit hashes,
// test counts, read-backs, gate results. A hash requires a digit so all-hex
// English words ("defaced") do not match.
const EVIDENCE: Array<[RegExp, string]> = [
	[/\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/, "commit-like hash"],
	[/\b\d+\s+passed\b/i, "test pass count"],
	[/\b\d+\s+failed\b/i, "test fail count"],
	[/\bverif(?:ied|ies|ying|y)\s+(?:on|with|by|against|that)\b/i, "verification claim"],
	[/\bread(?:s|ing)?[- ]back\b/i, "read-back claim"],
	[/\bbyte[- ]for[- ]byte\b/i, "read-back claim"],
	[/\bred on\b.*\bgreen on\b/i, "red-on-base claim"],
	[/\bexit code/i, "exit-code claim"],
	[/\b(?:sweep|gate) (?:is|was|passed|clean|green)\b/i, "gate claim"],
	[/\b(?:head|remote|branch) (?:is|now at|shows|has)\b/i, "remote-state claim"],
];

export function detectFabricatedNarration(text: string): Detection {
	if (!text) return {flagged: false, reasons: []};

	const verbs = new Set(
		(text.match(EXECUTION_VERB) ?? []).map((v) => v.toLowerCase()),
	);
	const evidence = [...new Set(
		EVIDENCE.filter(([re]) => re.test(text)).map(([, name]) => name),
	)];

	// A legitimate final summary carries one or two evidence mentions (the
	// artifacts earlier tool turns really produced). The fabricated-pipeline
	// shape cites several distinct artifacts, or narrates a long step chain
	// backed by evidence. No single marker can distinguish real from invented;
	// the count of independent markers is the signal.
	if (evidence.length >= 3 || (verbs.size >= 3 && evidence.length >= 2)) {
		return {
			flagged: true,
			reasons: [
				`evidence markers: ${evidence.join(", ") || "none"}`,
				`${verbs.size} distinct execution claims (${[...verbs].slice(0, 6).join(", ")})`,
			],
		};
	}
	return {flagged: false, reasons: []};
}

/** Extract plain text from a message content payload (string or block array). */
export function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((block) =>
				typeof block === "string"
					? block
					: block && typeof block === "object" && "text" in block
						? String((block as {text: unknown}).text)
						: "",
			)
			.join("\n");
	}
	if (content && typeof content === "object" && "text" in content) {
		return String((content as {text: unknown}).text);
	}
	return "";
}
