import {PrismaService} from '../prisma/prisma.service'
import {seedContent} from './seed-content'

// Content only: for a live shop that predates site content. Never touches the catalog, roles or
// anything an admin edited (`main.ts` would bring back deleted demo products).
const prisma = new PrismaService()

seedContent(prisma)
  .then(() => {
    console.log('seed: site content ready')
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
