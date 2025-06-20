// This is a dummy implementation for client-side imports
// It throws an error if actually used

class DummyPrismaClient {
  constructor() {
    return new Proxy(this, {
      get: function (target, prop) {
        if (
          typeof prop === "string" &&
          !["then", "catch", "finally"].includes(prop)
        ) {
          throw new Error(
            "PrismaClient is unable to run in the browser.\n" +
              "Use server actions or API routes for database operations instead.",
          );
        }
        return undefined;
      },
    });
  }
}

module.exports = {
  PrismaClient: DummyPrismaClient,
};
