# Task 1 Brief: Database Model & Prisma Schema Migration

## Target Files
- Modify: `prisma/schema.prisma`
- Create / Test: `src/lib/__tests__/memberPermissionDb.test.ts`

## Requirements
1. In `prisma/schema.prisma`, add `MemberPermission` model:
```prisma
model MemberPermission {
  id            Int      @id @default(autoincrement())
  memberId      Int      @map("member_id")
  permissionKey String   @map("permission_key") @db.VarChar(100)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  createdBy     String?  @map("created_by") @db.VarChar(100)

  member        Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, permissionKey], map: "uq_member_permission")
  @@index([memberId], map: "idx_member_perm_id")
  @@index([permissionKey], map: "idx_member_perm_key")
  @@map("member_permissions")
}
```
2. In `model Member`, add relation:
```prisma
  member_permissions       MemberPermission[]
```
3. Run `cmd.exe /c "npx prisma db push && npx prisma generate"` to synchronize with `thoen_hos_web_dev` on 192.168.1.7.
4. Create test `src/lib/__tests__/memberPermissionDb.test.ts` verifying `prisma.memberPermission` querying and constraints.
5. Run `cmd.exe /c "npx vitest run src/lib/__tests__/memberPermissionDb.test.ts"` and verify it passes.
6. Commit changes with `git commit -m "feat(db): add MemberPermission model and schema migration"`.
7. Write output report to `.superpowers/sdd/2026-10-09-member-level-permissions/task-1-report.md`.
