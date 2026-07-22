type SquareModule = {
  SquareClient: new (...args: any[]) => {
    payments: { create: (args: any) => Promise<any> };
    customers: { create: (args: any) => Promise<any> };
    cards: { create: (args: any) => Promise<any>; disable: (cardId: string) => Promise<any> };
  };
  SquareEnvironment: { Sandbox: any; Production: any };
  SquareError: new (...args: any[]) => Error;
};

let cachedSquare: Promise<SquareModule | null> | null = null;

export async function getSquareModule(): Promise<SquareModule | null> {
  if (!cachedSquare) {
    cachedSquare = Promise.resolve().then(() => {
      try {
        // Load Square at runtime so Next does not try to resolve it during build.
        return new Function("return require('square')")() as SquareModule;
      } catch {
        return null;
      }
    });
  }
  return cachedSquare;
}
