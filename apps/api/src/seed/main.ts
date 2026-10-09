import {PrismaService} from '../prisma/prisma.service'
import {seedCatalog} from './seed-catalog'

const prisma = new PrismaService()

seedCatalog(prisma)
  .then(() => {
    console.log('seed: catalog ready')
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
