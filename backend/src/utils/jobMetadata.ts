type MetadataLike = {
  toObject?: (options?: Record<string, unknown>) => Record<string, unknown>;
} & Record<string, unknown>;

const stripUndefinedDeep = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)]);

    return Object.fromEntries(entries);
  }

  return value;
};

export const mergeJobMetadata = (
  currentMetadata: MetadataLike | null | undefined,
  patch: Record<string, unknown>
) => {
  const base =
    currentMetadata && typeof currentMetadata.toObject === 'function'
      ? currentMetadata.toObject({ minimize: false })
      : { ...(currentMetadata || {}) };

  return stripUndefinedDeep({
    ...base,
    ...patch
  });
};
