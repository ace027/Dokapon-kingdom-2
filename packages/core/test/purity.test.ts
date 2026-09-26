import { describe, expect, it } from "vitest";

type DynamicCtor = new (body: string) => unknown;

describe("runtime purity backstop (core test project)", () => {
  it("runs with --disallow-code-generation-from-strings", () => {
    // Reached the same way the lint-bypass did: via `.constructor`, not the `Function` global.
    const FunctionCtor = (() => 0).constructor as DynamicCtor;
    const generatorProto = Object.getPrototypeOf(function* () {
      yield 0;
    }) as { constructor: DynamicCtor };
    const GeneratorCtor = generatorProto.constructor;
    expect(() => new FunctionCtor("return 1")).toThrow(EvalError);
    expect(() => new GeneratorCtor("yield 1")).toThrow(EvalError);
  });
});
