import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const agents = await db.agent.count()
const settings = await db.setting.count()
const knowledge = await db.knowledge.count()
const campaigns = await db.campaign.count()
console.log({ agents, settings, knowledge, campaigns })
await db.$disconnect()
