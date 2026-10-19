/** Frame controls live in the frame's context menu; the handle itself toggles collapse. */
export async function frameAction(page, frame, name) {
  await frame.locator(".ui-frame-handle").first().click({ button: "right" });
  await page
    .getByRole("menu", { name: "UI frame settings" })
    .getByRole("button", { name, exact: true })
    .click();
}
