import * as v from 'valibot'

import {SLUG_PATTERN} from '@shop/shared/catalog-admin'

export const SlugField = v.pipe(
  v.string(),
  v.trim(),
  v.regex(SLUG_PATTERN, 'Use 1–40 lowercase letters, digits or dashes')
)
const Name = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Enter a name'),
  v.maxLength(40, 'Use at most 40 characters')
)

export const CategoryFormSchema = v.object({slug: SlugField, en: Name, pl: Name})
export type CategoryForm = v.InferOutput<typeof CategoryFormSchema>
