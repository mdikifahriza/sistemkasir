function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapKeysDeep<T>(input: T, mapper: (value: string) => string): T {
  if (Array.isArray(input)) {
    return input.map((item) => mapKeysDeep(item, mapper)) as T;
  }

  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const output: Record<string, any> = {};
    Object.entries(input as Record<string, any>).forEach(([key, value]) => {
      output[mapper(key)] = mapKeysDeep(value, mapper);
    });
    return output as T;
  }

  return input;
}

export const mapToCamel = <T>(input: T) => mapKeysDeep(input, toCamelCase);
export const mapToSnake = <T>(input: T) => mapKeysDeep(input, toSnakeCase);
