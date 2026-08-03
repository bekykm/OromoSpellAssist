/// <reference types="office-js" />

/** Reads the word currently selected in the Word document, expanding the
 * selection to word boundaries first. Returns "" if nothing is selected. */
export async function getSelectedWord(): Promise<string> {
  return new Promise((resolve, reject) => {
    Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();
      resolve(range.text.trim());
    }).catch(reject);
  });
}
