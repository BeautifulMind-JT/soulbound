/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. The CONCRETE wiring (instantiating
 * services with real adapters) is built in Cline Task 5 in packages/adapters
 * or apps/web — NOT here. packages/core stays infrastructure-free (INV-03).
 * To change, say "unfreeze contract".
 */
import type { AdmissionService } from "../domain/admission/admission-service";
import type { MembershipService } from "../domain/membership/membership-service";

export interface CoreContainer {
  readonly admissionService: AdmissionService;
  readonly membershipService: MembershipService;
}
