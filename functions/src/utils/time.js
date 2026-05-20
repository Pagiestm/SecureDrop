const isExpired = (expiresAt) => {
  if (typeof expiresAt === 'number') return expiresAt < Date.now();
  if (expiresAt && typeof expiresAt.toMillis === 'function') return expiresAt.toMillis() < Date.now();
  return true;
};

module.exports = { isExpired };
