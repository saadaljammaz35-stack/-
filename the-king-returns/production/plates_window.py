import numpy as np, cv2
from lib import *
a = load('01'); b = load('06')
ga = cv2.cvtColor((a * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
gb = cv2.cvtColor((b * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
# align on the clean right-hand wall + window frame, where neither photo has the person
y0, y1, x0, x1 = 950, 1450, 1000, 1440
shift, resp = cv2.phaseCorrelate(ga[y0:y1, x0:x1], gb[y0:y1, x0:x1])
print('shift p06->p01', shift, resp)
M = np.float32([[1, 0, -shift[0]], [0, 1, -shift[1]]])
b2 = cv2.warpAffine(b, M, (b.shape[1], b.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
ref = (slice(950, 1450), slice(1100, 1440))
gain = a[ref].reshape(-1, 3).mean(0) / b2[ref].reshape(-1, 3).mean(0)
print('p06 gain', gain)
b2 = b2 * gain
H, Wd = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:Wd].astype(np.float32)
# weight of p06 (left side clean in p06, right side clean in p01); seam at x=745 above y=1270, x=640 below
seam = np.where(yy < 1270, 742.0, 640.0)
wb_ = smooth(seam + 30, seam - 30, xx)[..., None]
comp = b2 * wb_ + a * (1 - wb_)
# bottom-middle hole (x 630-875, y 1265-1460) is hidden in both photos: clone from the right (+235px) in p01
hx0, hx1, hy0, hy1, dx = 600, 905, 1255, 1600, 250
patch = a[hy0:hy1, hx0 + dx:hx1 + dx].copy()
m = np.zeros((hy1 - hy0, hx1 - hx0), np.float32)
m[14:-10, 24:-24] = 1
m = cv2.GaussianBlur(m, (0, 0), 9)[..., None]
comp[hy0:hy1, hx0:hx1] = patch * m + comp[hy0:hy1, hx0:hx1] * (1 - m)
cv2.imwrite('plate_window.png', (np.clip(comp, 0, 1)[..., ::-1] * 255).astype(np.uint8))

