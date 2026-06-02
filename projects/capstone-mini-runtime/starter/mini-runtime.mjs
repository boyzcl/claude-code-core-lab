export async function runMiniRuntime({ workspace, objective = "Fix calculator add() and verify tests" } = {}) {
  if (!workspace) {
    throw new Error("workspace is required");
  }

  return {
    objective,
    status: "unverified",
    trace: [],
    finalAnswer: "TODO: implement Search -> Read -> Edit -> Bash -> Verify before claiming success."
  };
}
