import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

const stellarAddress = z
  .string()
  .refine((v) => StrKey.isValidEd25519PublicKey(v), 'Not a valid Stellar public key (must start with G)');

export const createCharitySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  mission: z.string().trim().min(1, 'mission is required').max(2000),
  category: z.string().trim().min(1).max(50).default('general'),
  walletAddress: stellarAddress,
  verified: z.boolean().default(false),
});

export const verifySchema = z.object({
  verified: z.boolean(),
});

export const donationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.coerce.date().optional(), // return donations older than this timestamp
});

/**
 * Express middleware factory: validates req.body against a zod schema,
 * replaces req.body with the parsed/defaulted result, or responds 400.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query || {});
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}
