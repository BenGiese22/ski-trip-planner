import { databaseUrl, managesOwnDatabase, migrateSchema, startDatabase } from "./database";

export default async function globalSetup() {
  if (managesOwnDatabase) startDatabase();
  await migrateSchema(databaseUrl);
}
