-- SAMAT | سماط — the owner approved the new white packaging (Nov 2026).
-- Product and category photos move to the new shots under /media/menu/ (same file names, new folder,
-- so browsers and the image cache never show the old packaging). Only rows still on the old paths change.
update public.products set image_url = replace(image_url, '/media/products/', '/media/menu/') where image_url like '/media/products/%';
update public.categories set image_url = replace(image_url, '/media/products/', '/media/menu/') where image_url like '/media/products/%';
