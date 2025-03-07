export default {
  concurrency: 10,
  nodeResolve: true,
  watch: true,
  testFramework: {
    config: {
      ui: "bdd",
      timeout: "2000",
    },
  },
};
