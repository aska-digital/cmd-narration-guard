import type {ModApi} from '@commandcode/harness';
import {contentToText, detectFabricatedNarration, type Detection} from './detect';

// Narration guard: warns when a turn narrates executed work (commit hashes,
// test counts, read-backs) while containing zero tool calls. Such turns are
// usually fabricated, and once the fabricated transcript is in context later
// turns copy the pattern (observed as a 7-turn doom loop). The guard fires on
// the FIRST occurrence so the turn can be rewound before it seeds the loop.
// Observers only: this mod never blocks or rewrites anything.

interface FlaggedTurn {
	turnNumber: number;
	reasons: string[];
	snippet: string;
}

export default function (cmd: ModApi): void {
	const flaggedTurns: FlaggedTurn[] = [];
	let turnText = '';
	let currentTurn = 0;
	let toolsThisTurn = 0;

	cmd.addFlag('narration-guard', {
		type: 'boolean',
		default: true,
		description: 'Warn when a turn claims executed work without tool calls.',
	});

	cmd.on('turn_start', ({turnNumber}: {turnNumber?: number}) => {
		currentTurn = turnNumber ?? 0;
		turnText = '';
		toolsThisTurn = 0;
	});

	cmd.on('tool_completed', () => {
		toolsThisTurn += 1;
	});

	cmd.on('message_end', ({content}: {content?: unknown}) => {
		turnText += (turnText ? '\n' : '') + contentToText(content);
	});

	cmd.on('turn_end', ({turnNumber, hadToolCalls}: {turnNumber?: number; hadToolCalls?: boolean}) => {
		if (process.env.NARRATION_GUARD_DEBUG) {
			process.stderr.write(
				`[narration-guard] turn_end turn=${turnNumber} hadToolCalls=${hadToolCalls} toolsThisTurn=${toolsThisTurn} textChars=${turnText.length}\n`);
		}
		if (cmd.getFlag('narration-guard') === false) return;
		if (hadToolCalls || toolsThisTurn > 0) return;
		const detection: Detection = detectFabricatedNarration(turnText);
		if (process.env.NARRATION_GUARD_DEBUG) {
			process.stderr.write(`[narration-guard] detection flagged=${detection.flagged} ${detection.reasons.join(' | ')}\n`);
		}
		if (!detection.flagged) return;

		const turn = turnNumber ?? currentTurn;
		const record: FlaggedTurn = {
			turnNumber: turn,
			reasons: detection.reasons,
			snippet: turnText.replace(/\s+/g, ' ').slice(0, 160),
		};
		flaggedTurns.push(record);

		const repeat = flaggedTurns.length > 1;
		cmd.ui.notify(
			`narration-guard: turn ${turn} describes executed work but made no tool calls` +
				` (${detection.reasons.join('; ')}).` +
				' The claims may be fabricated. Rewind to before this turn or start a fresh session for the task' +
				(repeat ? ` — ${flaggedTurns.length} flagged turns this session, the pattern is reinforcing` : '') +
				'.',
		);
		cmd.events.emit('narration-guard:flagged', record);
	});

	cmd.addCommand({
		name: 'narration-report',
		handler: () => {
			if (flaggedTurns.length === 0) return {message: 'narration-guard: no flagged turns this session.'};
			const lines = flaggedTurns.map(
				(f) => `turn ${f.turnNumber}: ${f.reasons.join('; ')} — "${f.snippet}..."`,
			);
			return {message: `narration-guard: ${flaggedTurns.length} flagged turn(s)\n${lines.join('\n')}`};
		},
	});
}
