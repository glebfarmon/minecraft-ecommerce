-- Descriptions now render mini-markdown (`**bold**`, `*italic*`, `++underline++`, `\` escapes).
-- Escape existing markup characters so old texts keep showing literally.
UPDATE "product_translations"
SET "description" = regexp_replace("description", '([\\*+\[\]()])', '\\\1', 'g')
WHERE "description" ~ '[\\*+\[\]()]';
