/**
 * ⛔ CONTRACT-FROZEN signatures — owned by Cowork.
 * Cline implements the method BODIES in Task 2 to make the frozen tests green.
 * Cline must NOT change: the interface, the deps shape, or the return types.
 * To change, say "unfreeze contract".
 *
 * Required implementation order for the decision methods (enforced by tests):
 *   1. role guard       -> Err(FORBIDDEN)                 if !canReview(actor.role)   (INV-11)
 *   2. load             -> Err(NOT_FOUND)                 if application missing
 *   3. state guard      -> Err(INVALID_STATE_TRANSITION)  if status not allowed
 *   4. atomic rpc        -> admissionRepo.*Tx(...)         (INV-05/06/18, INV-22)
 *   5. post-step (approve only): if deps.flags.externalLedgerEnabled, enqueue outbox
 *      inside try/catch so a failure NEVER rolls back the committed approval (INV-13).
 */
import type { Result } from "../../application/result";
import type { AppError } from "../../application/errors";
import type { FeatureFlags } from "../../config/feature-flags";
import type { AdmissionRepository, ApproveOutcome } from "../../ports/admission-repository";
import type { OutboxRepository } from "../../ports/outbox-repository";
import type { LedgerPort } from "../../ports/ledger-port";
import type {
  AdmissionApplication,
  ReviewDecisionCommand,
  StartReviewCommand,
  SubmitApplicationCommand,
} from "./types";

export interface AdmissionServiceDeps {
  readonly admissionRepo: AdmissionRepository;
  readonly outboxRepo: OutboxRepository;
  readonly ledger: LedgerPort;
  readonly flags: FeatureFlags;
  /** optional injectables for deterministic tests */
  readonly idgen?: () => string;
  readonly clock?: () => Date;
}

export interface AdmissionService {
  submitApplication(
    cmd: SubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  startReview(
    cmd: StartReviewCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  approveApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<ApproveOutcome, AppError>>;

  rejectApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  requestMoreInfo(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;
}

const NOT_IMPLEMENTED = "NOT_IMPLEMENTED: implement in Cline Task 2";

/**
 * Frozen stub. Every method throws until Task 2 implements it — so the frozen
 * tests are RED at freeze time. That is expected and correct.
 */
export class DefaultAdmissionService implements AdmissionService {
  constructor(private readonly deps: AdmissionServiceDeps) {}

  async submitApplication(
    _cmd: SubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async startReview(
    _cmd: StartReviewCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async approveApplication(
    _cmd: ReviewDecisionCommand,
  ): Promise<Result<ApproveOutcome, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async rejectApplication(
    _cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async requestMoreInfo(
    _cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
