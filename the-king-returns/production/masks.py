import sys, numpy as np
from PIL import Image
from rembg import new_session, remove
model = sys.argv[1]; ids = sys.argv[2].split(',')
sess = new_session(model)
for p in ids:
    im = Image.open(f'src/p{p}.jpg').convert('RGB')
    m = remove(im, session=sess, only_mask=True, post_process_mask=False)
    m.save(f'masks/p{p}_{model}.png')
    print(p, model, np.asarray(m).mean())
