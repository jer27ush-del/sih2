// Every tunable rule lives here. Defaults match the prototype.
// Change values in server/.env (where marked) after review with AICTE, then restart the server.
const env = process.env;
const number = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));

export const CONFIG = {
  dna: {
    // Days back to compare a new complaint with the same institution's complaints. (DNA_WINDOW_DAYS)
    windowDays: number(env.DNA_WINDOW_DAYS, 180),
    // Share of key terms in common needed for a Duplicate, when the category also matches. (DNA_DUPLICATE_SCORE)
    duplicateScore: number(env.DNA_DUPLICATE_SCORE, 0.5),
    // Share of key terms in common needed for a Related link. (DNA_RELATED_SCORE)
    relatedScore: number(env.DNA_RELATED_SCORE, 0.2),
    maxMatches: 5,
  },
  priority: {
    // Keyword fallback, used when the AI check is off or fails.
    highKeywords: ['safety', 'fire', 'unsafe', 'injury', 'death', 'harassment', 'fraud', 'collapse', 'closure'],
    lowKeywords: ['minor', 'suggestion', 'clarification', 'query'],
  },
  // Days allowed from submission to expected disposal. (SLA_HIGH_DAYS, SLA_MEDIUM_DAYS, SLA_LOW_DAYS)
  sla: {
    HIGH: number(env.SLA_HIGH_DAYS, 15),
    MEDIUM: number(env.SLA_MEDIUM_DAYS, 30),
    LOW: number(env.SLA_LOW_DAYS, 45),
  },
  // Which cell leads each category.
  bureauByCategory: {
    Academic: 'ASC',
    Examination: 'ASC',
    Faculty: 'ASC',
    Infrastructure: 'RB',
    Fees: 'RB',
    Other: 'PGRC',
  },
  monitor: {
    // Warn this many days before a deadline. (DUE_SOON_DAYS)
    dueSoonDays: number(env.DUE_SOON_DAYS, 3),
    // Warn when a transfer is unacknowledged for this many hours. (HANDOFF_STALE_HOURS)
    handoffStaleHours: number(env.HANDOFF_STALE_HOURS, 48),
  },
  analytics: {
    lookbackDays: 90,
    windowWeeks: 4,
    // Open cases a cell can handle before it is overloaded. (DEFAULT_CELL_CAPACITY)
    defaultCapacity: number(env.DEFAULT_CELL_CAPACITY, 15),
    mediumRiskLoad: 0.8,
    highRiskLoad: 1,
  },
  access: {
    // true: a cell that transferred a case keeps view-only access. false: it loses sight of the case. (READ_ONLY_AFTER_HANDOFF)
    cellsKeepReadOnlyAfterHandoff: env.READ_ONLY_AFTER_HANDOFF !== 'false',
  },
};
