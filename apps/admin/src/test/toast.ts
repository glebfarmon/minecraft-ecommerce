import {waitFor} from '@testing-library/react'

/**
 * The toast on screen: `role="status"` for a success, `role="alert"` for an error. Other live regions
 * (dnd-kit adds its own `role="status"`) are left out by looking inside sonner's container only.
 */
export async function findToast(kind: 'status' | 'alert' = 'status'): Promise<HTMLElement> {
  let found: HTMLElement | null = null
  await waitFor(() => {
    found = document.querySelector<HTMLElement>(`[data-sonner-toaster] [role="${kind}"]`)
    expect(found).not.toBeNull()
  })
  return found as unknown as HTMLElement
}

export function queryToast(kind: 'status' | 'alert' = 'status'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-sonner-toaster] [role="${kind}"]`)
}
