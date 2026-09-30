import { commands } from "./bindings";

export async function ping(message: string): Promise<string> {
  const result = await commands.ping({ message });
  if (result.status === "ok") {
    return `Quiro ${result.data.version} replied: ${result.data.echo}`;
  }
  switch (result.error.kind) {
    case "empty":
      return "Rust rejected an empty ping";
    case "tooLong":
      return `Rust rejected a ping longer than ${result.error.data.max} characters`;
  }
}
