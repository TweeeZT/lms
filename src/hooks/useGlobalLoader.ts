export function showGlobalLoader() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("prime-loader:show"));
  }
}

export function hideGlobalLoader() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("prime-loader:hide"));
  }
}
