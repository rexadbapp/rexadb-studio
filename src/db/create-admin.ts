import { getDb } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import { bcrypt } from '@/lib/bcrypt';
import { seed } from './seed';
import crypto from 'node:crypto';

async function createAdmin() {
  await seed();

  const email = process.env.ADMIN_EMAIL ?? 'admin@rexadb.local';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ADMIN_PASSWORD environment variable is required');
    process.exit(1);
  }

  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  const passwordHash = await bcrypt.hash(password);
  const now = new Date().toISOString();

  if (existing) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    console.log(`Updated password for existing admin: ${email} (${existing.id})`);
  } else {
    const role = await db.query.roles.findFirst({
      where: (r, { eq }) => eq(r.name, 'admin'),
    });
    if (!role) {
      console.error('Admin role not found. Run seed first.');
      process.exit(1);
    }

    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email,
      name: 'Admin',
      roleId: role.id,
      passwordHash,
      isActive: true,
      createdAt: now,
    });
    console.log(`Created admin user: ${email} (${id})`);
  }
}

createAdmin()
  .then(() => {
    console.log('Admin setup completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Admin setup failed:', err);
    process.exit(1);
  });
