import { describe, it, expect } from 'vitest'
import { prismaWriteAuditEntry } from '../prismaAudit'

describe('prismaWriteAuditEntry', () => {
  it('records a create with its operation and arguments', () => {
    expect(prismaWriteAuditEntry('News', 'create', { data: { title: 'ข่าว' } })).toEqual({
      actionType: 'CREATE',
      targetTable: 'News',
      details: 'Operation: create | Args: {"data":{"title":"ข่าว"}}',
    })
  })

  it.each([
    ['upsert', 'UPDATE'],
    ['updateMany', 'UPDATE'],
    ['deleteMany', 'DELETE'],
    ['createMany', 'CREATE'],
  ])('maps %s to %s', (operation, actionType) => {
    expect(prismaWriteAuditEntry('News', operation, {})?.actionType).toBe(actionType)
  })

  it.each(['findMany', 'findUnique', 'count'])('does not audit the read %s', (operation) => {
    expect(prismaWriteAuditEntry('News', operation, {})).toBeNull()
  })

  it('writes bigint arguments as strings and falls back to "prisma" without a model', () => {
    expect(prismaWriteAuditEntry(undefined, 'delete', { where: { id: BigInt(9) } })).toEqual({
      actionType: 'DELETE',
      targetTable: 'prisma',
      details: 'Operation: delete | Args: {"where":{"id":"9"}}',
    })
  })

  it('writes no row for MemberRegistration, whose arguments hold a full citizen ID (its service audits a masked copy)', () => {
    const args = { data: { citizenId: '1234567890123', firstNameTh: 'สมชาย', lastNameTh: 'ใจดี', email: 'a@b.co' } }
    expect(prismaWriteAuditEntry('MemberRegistration', 'create', args)).toBeNull()
    expect(prismaWriteAuditEntry('MemberRegistration', 'update', args)).toBeNull()
  })
})
