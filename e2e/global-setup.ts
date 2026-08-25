import { databaseUrl, managesOwnDatabase, pushSchema, startDatabase } from "./database";

export default function globalSetup() {
  if (managesOwnDatabase) startDatabase();
  pushSchema(databaseUrl);
}
