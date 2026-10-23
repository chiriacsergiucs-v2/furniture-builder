/**
 * Research catalog (ADR-0043): research papers turned into traceable records, and features that can be picked for
 * later work. Research records are read-only data; the user's decisions live apart from them (`ResearchMark`), so
 * importing a paper again can never overwrite a decision.
 *
 * Traceability: document → section → finding (line range in the document) → feature / supporting record.
 */

export const RESEARCH_FORMAT = 'furniture-builder-research'
export const RESEARCH_SCHEMA = 1

/** Inclusive 1-based line range in the source document. */
export type Lines = [number, number]

export interface ResearchDocument {
  /** Stable across versions of the same paper. */
  id: string
  title: string
  /** Bump for every changed edition of the same paper; the same id + version must have the same content. */
  version: number
  /** Research snapshot date, ISO `YYYY-MM-DD`. */
  date: string
  question?: string
  /** Where the copy sits in the repository, when it ships with the app. */
  file?: string
  sha256?: string
  /** Full text, so excerpts quote the source itself. Optional for imported papers. */
  text?: string
}

export interface ResearchSection {
  id: string
  title: string
  lines: Lines
  /** Enclosing section; a line belongs to the most specific section that holds it. */
  parent?: string
}

export type FindingKind =
  | 'question' | 'conclusion' | 'claim' | 'recommendation' | 'principle' | 'requirement' | 'workflow' | 'example'
  | 'feature' | 'competitor' | 'praise' | 'complaint' | 'request' | 'adoption' | 'pricing'
  | 'technical' | 'architecture' | 'methodology' | 'limitation' | 'caveat' | 'estimate' | 'strategy' | 'source'

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  question: 'Research question', conclusion: 'Conclusion', claim: 'Finding', recommendation: 'Recommendation',
  principle: 'Design principle', requirement: 'Requirement', workflow: 'Workflow', example: 'Example',
  feature: 'Ranked feature', competitor: 'Competitor capability', praise: 'Praise', complaint: 'Complaint / pain point',
  request: 'User request', adoption: 'Adoption / usage', pricing: 'Pricing', technical: 'Technical finding',
  architecture: 'Architecture', methodology: 'Method', limitation: 'Limitation', caveat: 'Caveat', estimate: 'Estimate',
  strategy: 'Strategy', source: 'Source note',
}

/** One statement from the paper, at the smallest practical unit (a row, a paragraph, a code block). */
export interface ResearchFinding {
  id: string
  section: string
  lines: Lines
  kind: FindingKind
  /** Normalised wording. The verbatim excerpt is the document text at `lines`. */
  statement: string
  /** Citation ids beyond those written in the excerpt (`[^ref-N]` in the excerpt are found automatically). */
  refs?: string[]
  competitors?: string[]
  /** Evidence quality as the paper states it. */
  quality?: string
  polarity?: 'positive' | 'negative' | 'mixed'
}

/**
 * A footnote of the paper: one or more URLs plus the original citation ids. The two lists are kept as written;
 * the original ids are often not in URL order, so they must never be paired by position.
 */
export interface Citation {
  id: string
  line: number
  urls: string[]
  originalIds: string[]
}

/** A listed source with the paper's own note on it. */
export interface BibEntry {
  id: string
  group: string
  title: string
  url: string
  note: string
  line: number
}

export interface Competitor {
  /** Global id (`c.<name>`): the same product in another paper adds to the same record. */
  id: string
  name: string
  group: string
  behaviour: string
  signal: string
  commercial: string
  confidence: string
  line: number
}

export type FeatureOrigin = 'explicit' | 'inferred'

export interface ResearchFeature {
  /** Stable id (`<doc prefix>.f.<slug>`). A later paper may reuse it to add evidence. */
  id: string
  name: string
  description: string
  category: string
  subcategory: string
  parent?: string
  /** explicit: named in the research. inferred: an opportunity read from findings (`inferredFrom`), not a conclusion. */
  origin: FeatureOrigin
  inferredFrom?: string[]
  userProblem: string
  userBenefit: string
  useCases: string[]
  workflow: string[]
  requirements: string[]
  technical: string[]
  dependencies: string[]
  related: string[]
  competitors: string[]
  /** Ratings as the paper writes them; `not evaluated` when it gives none. */
  demand: string
  appreciation: string
  /** The paper's "competitor adoption" = how broadly products implement it, not measured usage. */
  adoption: string
  impact: string
  complexity: string
  confidence: string
  priority: string
  rank?: number
  recommendationRank?: number
  mvp?: string
  phase?: string
  /** Findings that support, contradict or describe this feature. */
  findings: string[]
  /** Observations about this repository (backlog / ADR ids), not research. */
  appNotes?: string[]
  tags: string[]
}

export interface Contradiction {
  id: string
  title: string
  description: string
  /** paper: the paper itself states both sides. inferred: a tension read across its statements. app: research vs this app's ADRs. */
  basis: 'paper' | 'inferred' | 'app'
  findings: string[]
  features: string[]
}

/** Content that could not be turned into records, kept visible with its reason. */
export interface Unextracted {
  id: string
  lines: Lines
  reason: string
}

export interface ResearchCategory {
  id: string
  label: string
  /** true when the paper names this grouping itself. */
  fromPaper: boolean
}

export interface ResearchBundle {
  format: typeof RESEARCH_FORMAT
  schemaVersion: typeof RESEARCH_SCHEMA
  document: ResearchDocument
  categories: ResearchCategory[]
  sections: ResearchSection[]
  findings: ResearchFinding[]
  citations: Citation[]
  bibliography: BibEntry[]
  competitors: Competitor[]
  features: ResearchFeature[]
  contradictions: Contradiction[]
  unextracted: Unextracted[]
}

export const SELECTIONS = ['unreviewed', 'interested', 'shortlisted', 'approved', 'deferred', 'rejected'] as const
export type Selection = (typeof SELECTIONS)[number]
export const SELECTION_LABEL: Record<Selection, string> = {
  unreviewed: 'Unreviewed', interested: 'Interested', shortlisted: 'Shortlisted', approved: 'Approved', deferred: 'Deferred', rejected: 'Rejected',
}

export const IMPLEMENTATIONS = ['not-started', 'planned', 'in-progress', 'implemented', 'verified'] as const
export type Implementation = (typeof IMPLEMENTATIONS)[number]
export const IMPLEMENTATION_LABEL: Record<Implementation, string> = {
  'not-started': 'Not Started', planned: 'Planned', 'in-progress': 'In Progress', implemented: 'Implemented', verified: 'Verified',
}

export const USER_PRIORITIES = ['', 'P0', 'P1', 'P2', 'P3'] as const
export type UserPriority = (typeof USER_PRIORITIES)[number]

/**
 * The user's decision on one record (feature or finding), stored on this device. Selection and implementation are
 * independent; nothing here is ever set by an import.
 */
export interface ResearchMark {
  id: string
  selection: Selection
  implementation: Implementation
  priority: UserPriority
  notes: string
  /** Findings: the user has read it. */
  reviewed: boolean
  /** Feature merged into another: hidden from the list, its evidence shown on the target, nothing deleted. */
  mergedInto?: string
  /** Extra links the user added between features. */
  links: string[]
  createdAt: string
  updatedAt: string
}
