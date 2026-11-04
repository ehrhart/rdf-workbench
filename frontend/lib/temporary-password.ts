import crypto from 'node:crypto'

const TEMPORARY_PASSWORD_LENGTH = 16
const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generateTemporaryPassword(): string {
  const characters: string[] = []
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index++) {
    characters.push(
      TEMPORARY_PASSWORD_ALPHABET[
        crypto.randomInt(TEMPORARY_PASSWORD_ALPHABET.length)
      ]
    )
  }
  const groups: string[] = []
  for (let offset = 0; offset < characters.length; offset += 4) {
    groups.push(characters.slice(offset, offset + 4).join(''))
  }
  return groups.join('-')
}
