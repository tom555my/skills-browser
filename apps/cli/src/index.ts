import * as p from "@clack/prompts";

export async function main() {
  const { version } = await import("../package.json", {
    with: { type: "json" },
  });

  p.intro(`Skills Browser CLI v${version}`);

  const name = await p.text({
    message: "What's your name?",
    placeholder: "Anonymous",
  });

  if (p.isCancel(name)) {
    p.cancel("Goodbye!");
    process.exit(0);
  }

  const action = await p.select({
    message: `Hi ${name}! What would you like to do?`,
    options: [
      { value: "browse", label: "Browse skills" },
      { value: "search", label: "Search skills" },
      { value: "info", label: "Show info" },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const s = p.spinner();
  s.start(`Running "${action}"...`);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  s.stop("Done!");

  p.outro("Thanks for using Skills Browser CLI");
}

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
