async function deleteIndexedDbDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export async function clearAllIndexedDbDatabases(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return;
  }

  const idbFactory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  const databaseNames = new Set<string>(['POSProOfflineDB']);

  if (typeof idbFactory.databases === 'function') {
    try {
      const databases = await idbFactory.databases();
      for (const database of databases) {
        if (database.name) {
          databaseNames.add(database.name);
        }
      }
    } catch {
      // Ignore enumeration errors and fall back to the legacy known name.
    }
  }

  for (const databaseName of databaseNames) {
    await deleteIndexedDbDatabase(databaseName);
  }
}
