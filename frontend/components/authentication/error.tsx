export function isErrorWithMessage(error: unknown): error is { message: {detail:string} } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "object" &&
    error.message !== null &&
    "detail" in error.message
  );
}