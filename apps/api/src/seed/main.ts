import {getMailer} from '../mailer/create-mailer'
import {PrismaService} from '../prisma/prisma.service'
import {seedAccess} from './seed-access'
import {seedCatalog} from './seed-catalog'
import {seedContent} from './seed-content'
import {seedDemoRcon} from './seed-rcon'

const prisma = new PrismaService()

seedCatalog(prisma)
  .then(() => seedDemoRcon(prisma))
  .then(() => seedContent(prisma))
  .then(() =>
    seedAccess(prisma, getMailer(), process.env.BETTER_AUTH_URL ?? 'http://admin.shop.localhost')
  )
  .then(({ownerInviteUrl}) => {
    console.log('seed: catalog and roles ready')
    if (ownerInviteUrl) console.log(`seed: owner invite ${ownerInviteUrl}`)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
