// One persistent, hidden <input type="file"> for the whole web app.
//
// Recreating the input per pick makes the browser's file dialog impossible to
// drive programmatically and drops the previous selection; a single reusable
// input keeps selection observable, allows the same file to be picked twice,
// and lets a file that was already placed on the input (automation, drag and
// drop handlers) be consumed without reopening the dialog.

let sharedInput: HTMLInputElement | null = null;

function ensureInput(): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  if (sharedInput && sharedInput.isConnected) return sharedInput;
  const input = document.createElement("input");
  input.type = "file";
  // Kept technically visible (transparent, 1px) so browser automation and
  // assistive tooling can still target it; `display:none` hides it from them.
  input.style.opacity = "0.0001";
  input.style.width = "200px";
  input.style.height = "44px";
  input.style.padding = "0";
  input.style.border = "0";
  input.style.zIndex = "999";
  input.style.cursor = "pointer";
  input.style.position = "fixed";
  input.style.left = "4px";
  input.style.bottom = "4px";
  document.body.appendChild(input);
  sharedInput = input;
  return input;
}

/** Opens the system file dialog and resolves with the chosen file, or null. */
export function pickFile(accept: string): Promise<File | null> {
  const input = ensureInput();
  if (!input) return Promise.resolve(null);
  input.accept = accept;

  // A file already sitting on the input is consumed immediately, so callers do
  // not depend on the dialog actually being opened.
  const preselected = input.files && input.files.length > 0 ? input.files[0] : null;
  if (preselected) {
    input.value = "";
    return Promise.resolve(preselected);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      input.value = "";
      resolve(file);
    };
    const onChange = () => finish(input.files?.[0] ?? null);
    const onCancel = () => finish(null);
    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    input.click();
  });
}
