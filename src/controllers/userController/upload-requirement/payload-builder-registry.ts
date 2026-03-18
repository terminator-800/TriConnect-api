// payload-builder-registry.ts
// OCP: Add a new role by registering a new builder — zero changes to existing code
// DIP: Controller depends on this abstraction, not on concrete builders directly

import { ROLE } from '../../../utils/roles.js';
import type { PayloadBuilder } from './payload-builders.js';
import {
  JobseekerPayloadBuilder,
  IndividualEmployerPayloadBuilder,
  BusinessEmployerPayloadBuilder,
  ManpowerProviderPayloadBuilder,
} from './payload-builders.js';

// Allowed roles are derived from the registry itself — no separate array needed
const builderRegistry = new Map<string, PayloadBuilder>([
  [ROLE.JOBSEEKER,           new JobseekerPayloadBuilder()],
  [ROLE.INDIVIDUAL_EMPLOYER, new IndividualEmployerPayloadBuilder()],
  [ROLE.BUSINESS_EMPLOYER,   new BusinessEmployerPayloadBuilder()],
  [ROLE.MANPOWER_PROVIDER,   new ManpowerProviderPayloadBuilder()],
]);

export const getPayloadBuilder = (role: string): PayloadBuilder | undefined =>
  builderRegistry.get(role);

export const isAllowedRole = (role: string): boolean =>
  builderRegistry.has(role);