import type { PublicUser, ServiceResult, Wallet } from '../../types'
import { fail, ok } from '../../types'
import { createUser, getUserByUsername, toPublicUser } from '../user/userStore'
import { provisionWallet } from '../wallet/walletService'
import { hashPassword, verifyPassword } from './password'
import { signToken } from './token'

export interface AuthResult {
  token: string
  user: PublicUser
  wallet: Wallet
}

/** Register a unique-username account, hash the password, provision a wallet. */
export function register(input: { username: string; password: string; displayName?: string }): ServiceResult<AuthResult> {
  const displayName = input.displayName?.trim() || input.username
  const user = createUser({
    username: input.username,
    displayName,
    passwordHash: hashPassword(input.password),
  })
  if (!user) return fail('Username is already taken', 409)

  const wallet = provisionWallet(user.id)
  return ok({ token: signToken(user.id), user: toPublicUser(user), wallet })
}

/** Verify username + password. Generic error for either failure (no user
 *  enumeration). */
export function login(input: { username: string; password: string }): ServiceResult<AuthResult> {
  const user = getUserByUsername(input.username)
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return fail('Invalid username or password', 401)
  }
  const wallet = provisionWallet(user.id)
  return ok({ token: signToken(user.id), user: toPublicUser(user), wallet })
}
