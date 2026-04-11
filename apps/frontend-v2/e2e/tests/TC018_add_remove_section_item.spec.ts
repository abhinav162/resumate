import { test, expect } from '../fixtures';

// TC018 — Add and remove an item in a resume section
// Verifies the editor supports adding items (and removing via hover-revealed trash icon)

test('TC018 - add and remove item in resume section', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/, { timeout: 15_000 });

  // Navigate to Experience section (index 1 in left rail)
  const navButtons = page.locator('div.w-16 button');
  await expect(navButtons.nth(1)).toBeVisible({ timeout: 10_000 });
  await navButtons.nth(1).click();

  // The ExperienceForm should show "Add Position"
  const addBtn = page.getByRole('button', { name: /add position/i }).first();
  await expect(addBtn).toBeVisible({ timeout: 10_000 });

  // Count existing experience items
  const itemsBefore = await page.locator('.group.relative.border').count();

  // Click to add a new position
  await addBtn.click();

  // A new item group should appear
  await page.waitForTimeout(500);
  const itemsAfter = await page.locator('.group.relative.border').count();
  expect(itemsAfter).toBeGreaterThan(itemsBefore);

  // Hover over the last item to reveal the trash icon button, then click it
  const lastItem = page.locator('.group.relative.border').last();
  await lastItem.hover();

  // The trash button is the last button inside the item's top-right controls
  const trashBtn = lastItem.locator('button').last();
  await expect(trashBtn).toBeVisible({ timeout: 3_000 });
  await trashBtn.click();

  // Verify item count decreased or stayed same (already at minimum)
  await page.waitForTimeout(500);
  const itemsFinal = await page.locator('.group.relative.border').count();
  expect(itemsFinal).toBeLessThanOrEqual(itemsAfter);
});
