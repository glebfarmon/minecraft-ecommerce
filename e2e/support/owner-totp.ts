import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {test} from '@playwright/test'

/**
 * The owner's TOTP secret and the last step admin.spec.ts used, handed to refund.spec.ts. The
 * `refund` project depends on the `admin` one (playwright.config.ts), so the file is written
 * before it is read; it lives in the output folder, which every run starts empty.
 */
export type OwnerTotp = {secret: string; lastStep: number}

const file = () => join(test.info().project.outputDir, 'owner-totp.json')

export function saveOwnerTotp(totp: OwnerTotp) {
  mkdirSync(test.info().project.outputDir, {recursive: true})
  writeFileSync(file(), JSON.stringify(totp))
}

export function loadOwnerTotp(): OwnerTotp {
  return JSON.parse(readFileSync(file(), 'utf8')) as OwnerTotp
}
