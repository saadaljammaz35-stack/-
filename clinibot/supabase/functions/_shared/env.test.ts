import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { cleanSecret, ConfigError, optionalSecret, requireSecret } from "./env.ts";

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const before = Deno.env.get(name);
  if (value === undefined) Deno.env.delete(name);
  else Deno.env.set(name, value);
  try {
    fn();
  } finally {
    if (before === undefined) Deno.env.delete(name);
    else Deno.env.set(name, before);
  }
}

const KEY = "sk-ant-api03-AbC_dEf-123";

Deno.test("cleanSecret removes marks, zero-width characters and line breaks", () => {
  assertEquals(cleanSecret(`‏${KEY}‎`), KEY);
  assertEquals(cleanSecret(`${KEY.slice(0, 8)}​${KEY.slice(8)}`), KEY);
  assertEquals(cleanSecret(`﻿ ${KEY}\r\n`), KEY);
  assertEquals(cleanSecret(`${KEY.slice(0, 5)}\n${KEY.slice(5)}`), KEY);
  assertEquals(cleanSecret(KEY), KEY);
});

Deno.test("optionalSecret returns the cleaned value", () => {
  withEnv("CLINIBOT_TEST_SECRET", `‏${KEY}\n`, () => {
    assertEquals(optionalSecret("CLINIBOT_TEST_SECRET"), KEY);
  });
});

Deno.test("optionalSecret treats missing, blank and non-ASCII secrets as not configured", () => {
  withEnv("CLINIBOT_TEST_SECRET", undefined, () => assertEquals(optionalSecret("CLINIBOT_TEST_SECRET"), undefined));
  withEnv("CLINIBOT_TEST_SECRET", " ‏\n", () => assertEquals(optionalSecret("CLINIBOT_TEST_SECRET"), undefined));
  withEnv("CLINIBOT_TEST_SECRET", `${KEY}ا`, () => assertEquals(optionalSecret("CLINIBOT_TEST_SECRET"), undefined));
});

Deno.test("requireSecret throws ConfigError naming the variable", () => {
  withEnv("CLINIBOT_TEST_SECRET", "مفتاح", () => {
    const error = assertThrows(() => requireSecret("CLINIBOT_TEST_SECRET"), ConfigError);
    assertEquals(error.variable, "CLINIBOT_TEST_SECRET");
  });
  withEnv("CLINIBOT_TEST_SECRET", `${KEY}‏`, () => assertEquals(requireSecret("CLINIBOT_TEST_SECRET"), KEY));
});
