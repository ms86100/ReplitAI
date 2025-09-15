const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

const runWithContext = (initial = {}, next) => {
  return als.run(initial, next);
};

const setUserId = (userId) => {
  const store = als.getStore() || {};
  store.userId = userId;
};

const getUserId = () => {
  const store = als.getStore();
  return store?.userId || null;
};

module.exports = {
  runWithContext,
  setUserId,
  getUserId,
};