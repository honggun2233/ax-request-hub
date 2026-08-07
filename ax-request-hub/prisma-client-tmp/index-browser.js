
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.19.1
 * Query Engine version: 69d742ee20b815d88e17e54db4a2a7a3b30324e3
 */
Prisma.prismaVersion = {
  client: "5.19.1",
  engine: "69d742ee20b815d88e17e54db4a2a7a3b30324e3"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  title: 'title',
  department: 'department',
  requesterName: 'requesterName',
  requesterEmail: 'requesterEmail',
  source: 'source',
  status: 'status',
  description: 'description',
  asIs: 'asIs',
  expectedBenefit: 'expectedBenefit',
  confidentialityLevel: 'confidentialityLevel',
  championName: 'championName',
  estimatedUsers: 'estimatedUsers',
  totalScore: 'totalScore',
  autoApproved: 'autoApproved',
  approvedBy: 'approvedBy',
  decisionNote: 'decisionNote',
  techHasApiSpec: 'techHasApiSpec',
  techHasDataClassification: 'techHasDataClassification',
  techHasAuditLogging: 'techHasAuditLogging',
  techHasTestCoverage: 'techHasTestCoverage',
  techStandardsPassed: 'techStandardsPassed',
  techStandardsFailedItems: 'techStandardsFailedItems',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  expectedBenefitValue: 'expectedBenefitValue',
  expectedBenefitUnit: 'expectedBenefitUnit',
  isEssentialBusiness: 'isEssentialBusiness'
};

exports.Prisma.ScoreCardScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  impactScore: 'impactScore',
  roiScore: 'roiScore',
  confidentialityScore: 'confidentialityScore',
  difficultyScore: 'difficultyScore',
  readinessScore: 'readinessScore',
  strategyScore: 'strategyScore',
  totalScore: 'totalScore',
  evaluationRationale: 'evaluationRationale',
  evaluatedAt: 'evaluatedAt'
};

exports.Prisma.ChatSessionScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  messages: 'messages',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  name: 'name',
  email: 'email',
  department: 'department',
  jobTitle: 'jobTitle',
  role: 'role',
  currentLevel: 'currentLevel',
  levelGrantedAt: 'levelGrantedAt',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DepartmentQuotaScalarFieldEnum = {
  id: 'id',
  department: 'department',
  toolType: 'toolType',
  totalQuota: 'totalQuota',
  aiDensity: 'aiDensity',
  managedBy: 'managedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ToolAccountScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  quotaId: 'quotaId',
  toolType: 'toolType',
  toolTier: 'toolTier',
  status: 'status',
  requestReason: 'requestReason',
  assignedByEmail: 'assignedByEmail',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  activatedAt: 'activatedAt',
  lastUsedAt: 'lastUsedAt',
  returnedAt: 'returnedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LevelApplicationScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  requestedLevel: 'requestedLevel',
  currentLevel: 'currentLevel',
  selfIntro: 'selfIntro',
  trainingCompleted: 'trainingCompleted',
  utilizationPlan: 'utilizationPlan',
  recommendationNote: 'recommendationNote',
  status: 'status',
  reviewNote: 'reviewNote',
  reviewedById: 'reviewedById',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LevelHistoryScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  fromLevel: 'fromLevel',
  toLevel: 'toLevel',
  reason: 'reason',
  changedById: 'changedById',
  createdAt: 'createdAt'
};

exports.Prisma.DistributionPolicyScalarFieldEnum = {
  id: 'id',
  level: 'level',
  serviceName: 'serviceName',
  serviceDescription: 'serviceDescription',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ServiceAllocationScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  policyId: 'policyId',
  status: 'status',
  accountInfo: 'accountInfo',
  grantedAt: 'grantedAt',
  revokedAt: 'revokedAt',
  expiresAt: 'expiresAt',
  grantedById: 'grantedById',
  createdAt: 'createdAt'
};

exports.Prisma.TokenPolicyScalarFieldEnum = {
  id: 'id',
  scope: 'scope',
  level: 'level',
  employeeId: 'employeeId',
  service: 'service',
  monthlyLimit: 'monthlyLimit',
  singleCallLimit: 'singleCallLimit',
  warningThreshold: 'warningThreshold',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UsageRecordScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  service: 'service',
  yearMonth: 'yearMonth',
  tokenUsed: 'tokenUsed',
  costKrw: 'costKrw',
  inputById: 'inputById',
  createdAt: 'createdAt'
};

exports.Prisma.UsageAlertScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  service: 'service',
  yearMonth: 'yearMonth',
  alertType: 'alertType',
  acknowledged: 'acknowledged',
  sentAt: 'sentAt',
  createdAt: 'createdAt'
};

exports.Prisma.AgentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  department: 'department',
  description: 'description',
  status: 'status',
  deprecatedAt: 'deprecatedAt',
  retiredAt: 'retiredAt',
  deprecationReason: 'deprecationReason',
  retirementNote: 'retirementNote',
  successorAgentId: 'successorAgentId',
  dataRetentionYears: 'dataRetentionYears',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  kpiName: 'kpiName',
  kpiTarget: 'kpiTarget',
  kpiType: 'kpiType',
  kpiMeasureMethod: 'kpiMeasureMethod',
  kpiMeasureCycle: 'kpiMeasureCycle',
  lastUsedAt: 'lastUsedAt',
  kpiMissCount: 'kpiMissCount',
  kpiLastScore: 'kpiLastScore',
  performanceFlag: 'performanceFlag'
};

exports.Prisma.AgentKpiRecordScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  recordMonth: 'recordMonth',
  actualValue: 'actualValue',
  targetValue: 'targetValue',
  achieveRate: 'achieveRate',
  tokenCost: 'tokenCost',
  performMatrix: 'performMatrix',
  note: 'note',
  recordedBy: 'recordedBy',
  createdAt: 'createdAt'
};

exports.Prisma.AgentArtifactScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  artifactType: 'artifactType',
  title: 'title',
  contentPath: 'contentPath',
  createdAt: 'createdAt',
  retainUntil: 'retainUntil',
  transferredTo: 'transferredTo',
  archived: 'archived'
};

exports.Prisma.AgentKnowledgeExtractScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  promptPatterns: 'promptPatterns',
  failureCases: 'failureCases',
  useCaseSummary: 'useCaseSummary',
  lessonsLearned: 'lessonsLearned',
  extractedBy: 'extractedBy',
  extractedAt: 'extractedAt'
};

exports.Prisma.LiteracyCourseScalarFieldEnum = {
  id: 'id',
  title: 'title',
  level: 'level',
  description: 'description',
  durationMin: 'durationMin',
  isRequired: 'isRequired',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.LiteracyEnrollmentScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  courseId: 'courseId',
  status: 'status',
  completedAt: 'completedAt',
  score: 'score',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  action: 'action',
  actorEmail: 'actorEmail',
  detail: 'detail',
  createdAt: 'createdAt'
};

exports.Prisma.AgentRegistryScalarFieldEnum = {
  id: 'id',
  agentName: 'agentName',
  agentKey: 'agentKey',
  version: 'version',
  purpose: 'purpose',
  dataSource: 'dataSource',
  owner: 'owner',
  status: 'status',
  realDataConnected: 'realDataConnected',
  fallbackRate: 'fallbackRate',
  gate1Passed: 'gate1Passed',
  gate2Passed: 'gate2Passed',
  gate3Passed: 'gate3Passed',
  lifecycleStage: 'lifecycleStage',
  gate1PassedAt: 'gate1PassedAt',
  gate2PassedAt: 'gate2PassedAt',
  gate3PassedAt: 'gate3PassedAt',
  operatorTrustScore: 'operatorTrustScore',
  operatorComment: 'operatorComment',
  sam30dAccuracy: 'sam30dAccuracy',
  degradedSince: 'degradedSince',
  retiredAt: 'retiredAt',
  retireReason: 'retireReason',
  lastEvaluatedAt: 'lastEvaluatedAt',
  nextReviewAt: 'nextReviewAt',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  projectId: 'projectId',
  phase: 'phase',
  devStage: 'devStage',
  prodStatus: 'prodStatus',
  trustScore: 'trustScore',
  pilotKpiTarget: 'pilotKpiTarget',
  prodKpiTarget: 'prodKpiTarget',
  retireFlag: 'retireFlag',
  lastUsedAt: 'lastUsedAt',
  productionAt: 'productionAt'
};

exports.Prisma.AXProjectScalarFieldEnum = {
  id: 'id',
  key: 'key',
  name: 'name',
  domain: 'domain',
  description: 'description',
  owner: 'owner',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentProjectLinkScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  projectId: 'projectId',
  role: 'role',
  addedAt: 'addedAt'
};

exports.Prisma.AgentScoreScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  ticker: 'ticker',
  score: 'score',
  rationale: 'rationale',
  dataType: 'dataType',
  recordedAt: 'recordedAt',
  phase: 'phase',
  month: 'month',
  kpiActual: 'kpiActual',
  achieveRate: 'achieveRate'
};

exports.Prisma.SkillScalarFieldEnum = {
  id: 'id',
  skillId: 'skillId',
  name: 'name',
  version: 'version',
  category: 'category',
  author: 'author',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  status: 'status',
  targetUsers: 'targetUsers',
  securityLevel: 'securityLevel',
  purpose: 'purpose',
  instructions: 'instructions',
  promptText: 'promptText',
  examples: 'examples',
  cautions: 'cautions',
  usageCount: 'usageCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SkillRatingScalarFieldEnum = {
  id: 'id',
  skillId: 'skillId',
  employeeEmail: 'employeeEmail',
  score: 'score',
  comment: 'comment',
  createdAt: 'createdAt'
};

exports.Prisma.CouncilMeetingScalarFieldEnum = {
  id: 'id',
  meetingNo: 'meetingNo',
  heldAt: 'heldAt',
  notes: 'notes'
};

exports.Prisma.CouncilAgendaItemScalarFieldEnum = {
  id: 'id',
  meetingId: 'meetingId',
  agentId: 'agentId',
  itemType: 'itemType',
  packageMeta: 'packageMeta',
  decision: 'decision',
  decisionNote: 'decisionNote',
  conditions: 'conditions',
  decidedAt: 'decidedAt',
  dataRequestId: 'dataRequestId'
};

exports.Prisma.DataAssetScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  ownerDept: 'ownerDept',
  classification: 'classification',
  schemaMeta: 'schemaMeta',
  deliveryModes: 'deliveryModes',
  updateCycle: 'updateCycle',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sourceSystem: 'sourceSystem',
  externalId: 'externalId',
  syncedAt: 'syncedAt',
  snowflakeDb: 'snowflakeDb',
  snowflakeSchema: 'snowflakeSchema',
  dataOwnerId: 'dataOwnerId'
};

exports.Prisma.DataRequestScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  projectId: 'projectId',
  agentId: 'agentId',
  assetId: 'assetId',
  requesterId: 'requesterId',
  purpose: 'purpose',
  requestedSpec: 'requestedSpec',
  classification: 'classification',
  periodMonths: 'periodMonths',
  forProduction: 'forProduction',
  rejectReason: 'rejectReason',
  reviewerId: 'reviewerId',
  prevRequestId: 'prevRequestId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  trackType: 'trackType',
  accessType: 'accessType',
  isAnonymized: 'isAnonymized',
  anonNote: 'anonNote'
};

exports.Prisma.DataProvisionScalarFieldEnum = {
  id: 'id',
  requestId: 'requestId',
  deliveryMode: 'deliveryMode',
  connectionRef: 'connectionRef',
  providedAt: 'providedAt',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  revokeReason: 'revokeReason'
};

exports.Prisma.ProjectAppealScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  requesterEmail: 'requesterEmail',
  reason: 'reason',
  evidenceNote: 'evidenceNote',
  status: 'status',
  reviewedBy: 'reviewedBy',
  reviewNote: 'reviewNote',
  resolvedAt: 'resolvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GovernanceDocScalarFieldEnum = {
  id: 'id',
  docId: 'docId',
  fileName: 'fileName',
  type: 'type',
  level: 'level',
  title: 'title',
  version: 'version',
  author: 'author',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  securityLevel: 'securityLevel',
  status: 'status',
  description: 'description',
  relatedDocs: 'relatedDocs',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  recipientEmail: 'recipientEmail',
  title: 'title',
  body: 'body',
  link: 'link',
  readAt: 'readAt',
  createdAt: 'createdAt'
};

exports.Prisma.BenefitRecordScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  agentId: 'agentId',
  period: 'period',
  realizedValue: 'realizedValue',
  unit: 'unit',
  note: 'note',
  recordedBy: 'recordedBy',
  createdAt: 'createdAt'
};

exports.Prisma.AgentDataLinkScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  dataAssetId: 'dataAssetId',
  purpose: 'purpose',
  accessLevel: 'accessLevel',
  createdAt: 'createdAt'
};

exports.Prisma.EmployeeAgentLinkScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  agentId: 'agentId',
  role: 'role',
  since: 'since'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Project: 'Project',
  ScoreCard: 'ScoreCard',
  ChatSession: 'ChatSession',
  Employee: 'Employee',
  DepartmentQuota: 'DepartmentQuota',
  ToolAccount: 'ToolAccount',
  LevelApplication: 'LevelApplication',
  LevelHistory: 'LevelHistory',
  DistributionPolicy: 'DistributionPolicy',
  ServiceAllocation: 'ServiceAllocation',
  TokenPolicy: 'TokenPolicy',
  UsageRecord: 'UsageRecord',
  UsageAlert: 'UsageAlert',
  Agent: 'Agent',
  AgentKpiRecord: 'AgentKpiRecord',
  AgentArtifact: 'AgentArtifact',
  AgentKnowledgeExtract: 'AgentKnowledgeExtract',
  LiteracyCourse: 'LiteracyCourse',
  LiteracyEnrollment: 'LiteracyEnrollment',
  AuditLog: 'AuditLog',
  AgentRegistry: 'AgentRegistry',
  AXProject: 'AXProject',
  AgentProjectLink: 'AgentProjectLink',
  AgentScore: 'AgentScore',
  Skill: 'Skill',
  SkillRating: 'SkillRating',
  CouncilMeeting: 'CouncilMeeting',
  CouncilAgendaItem: 'CouncilAgendaItem',
  DataAsset: 'DataAsset',
  DataRequest: 'DataRequest',
  DataProvision: 'DataProvision',
  ProjectAppeal: 'ProjectAppeal',
  GovernanceDoc: 'GovernanceDoc',
  Notification: 'Notification',
  BenefitRecord: 'BenefitRecord',
  AgentDataLink: 'AgentDataLink',
  EmployeeAgentLink: 'EmployeeAgentLink'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
