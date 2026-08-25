import { managesOwnDatabase, stopDatabase } from "./database";

export default function globalTeardown() {
  // Leave a Postgres we didn't start alone.
  if (managesOwnDatabase) stopDatabase();
}
