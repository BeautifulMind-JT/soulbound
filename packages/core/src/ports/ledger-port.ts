/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * P0 main implementation: NoopLedgerAdapter ONLY.
 * Do NOT implement any concrete-chain ledger adapter on main. Do NOT import any
 * concrete chain SDK on main. Any external settlement ledger lives ONLY on the
 * option branch (Task 10). (INV-21)
 */
import type {
  ChainReceipt,
  IssueActivationStakeInput,
  IssueAdmissionTicketInput,
  IssueMembershipCredentialInput,
} from "../domain/ledger/types";

export interface LedgerPort {
  issueAdmissionTicket(input: IssueAdmissionTicketInput): Promise<ChainReceipt>;
  issueMembershipCredential(input: IssueMembershipCredentialInput): Promise<ChainReceipt>;
  /**
   * Issues locked Activation SOUL as DefaultStakedSoul. Not liquid, not reward,
   * not airdrop, not yield. Funded only by Review Tolls / reserves, never minted.
   */
  issueActivationStake(input: IssueActivationStakeInput): Promise<ChainReceipt>;
}
