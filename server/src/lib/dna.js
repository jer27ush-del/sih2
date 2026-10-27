import { CONFIG } from './config.js';
// Complaint DNA engine: rule-based similarity between complaints of the same institution.
// Pure functions with no database access, so the rules can be tested directly.

export const DNA_WINDOW_DAYS = CONFIG.dna.windowDays;
export const MAX_MATCHES = CONFIG.dna.maxMatches;

const STOPWORDS = new Set([
  'about', 'against', 'also', 'any', 'appropriate', 'action', 'across', 'been', 'being', 'both', 'but',
  'could', 'data', 'does', 'each', 'from', 'have', 'here', 'into', 'kindly', 'matter', 'more', 'most',
  'must', 'only', 'other', 'over', 'please', 'request', 'shall', 'should', 'some', 'such', 'than', 'thank',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'under', 'very', 'were',
  'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'your', 'taken', 'thanks',
]);

export function keywordsOf(text = '') {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}

// Share of distinct key terms the two descriptions have in common (0 to 1).
export function similarityOf(textA, textB) {
  const a = keywordsOf(textA);
  const b = keywordsOf(textB);
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };
  const shared = [...a].filter((word) => b.has(word));
  const union = new Set([...a, ...b]).size;
  return { score: shared.length / union, shared };
}

export function labelFor(score, sameCategory) {
  if (sameCategory && score >= CONFIG.dna.duplicateScore) return 'DUPLICATE';
  if (score >= CONFIG.dna.relatedScore) return 'RELATED';
  return 'NEW_ISSUE';
}

// candidates: existing complaints for the same institution within the time window.
export function findSimilar(candidates, incoming) {
  return candidates
    .map((c) => {
      const { score, shared } = similarityOf(incoming.description, c.description);
      return {
        id: c.id,
        caseId: c.caseId,
        status: c.status,
        leadBureau: c.leadBureau ?? null,
        score: Math.round(score * 100) / 100,
        label: labelFor(score, c.category === incoming.category),
        sharedKeywords: shared.slice(0, 8),
      };
    })
    .filter((m) => m.label !== 'NEW_ISSUE')
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}

// The new complaint takes the strongest label among its matches.
export function dnaLabelFor(matches) {
  if (matches.some((m) => m.label === 'DUPLICATE')) return 'DUPLICATE';
  if (matches.some((m) => m.label === 'RELATED')) return 'RELATED';
  return 'NEW_ISSUE';
}

// Overlap: a related or duplicate case is being handled by a different cell.
export function hasOverlap(bureauCode, relatedCases) {
  if (!bureauCode) return false;
  return relatedCases.some((r) => r.leadBureau && r.leadBureau.code !== bureauCode);
}
