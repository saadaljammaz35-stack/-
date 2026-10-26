// Pins and verifies the hadith collections; see hadith-books.mjs.
import { prepareHadithBooks } from './hadith-books.mjs';

prepareHadithBooks().catch((err) => {
  console.error(err);
  process.exit(1);
});
