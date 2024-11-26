import numpy as np
import colour
import colour.utilities

def colour_wheel(samples=1024, clip_circle=True):
    xx, yy = np.meshgrid(
        np.linspace(-1, 1, samples), np.linspace(-1, 1, samples))

    S = np.sqrt(xx ** 2 + yy ** 2)    
    H = (np.arctan2(xx, yy) + np.pi) / (np.pi * 2)
    H = ((np.arctan2(yy, xx) + np.pi) % (np.pi*2)) / (np.pi * 2)

    HSV = colour.utilities.tstack([H, S, np.ones(H.shape)])
    RGB = colour.HSV_to_RGB(HSV)

    if clip_circle == True:
        RGB[S > 1] = 0
        A = np.where(S > 1, 0, 1)
    else:
        A = np.ones(S.shape)

    R, G, B = colour.utilities.tsplit(RGB)
    
    return colour.utilities.tstack([R, G, B, A])

wheel = colour_wheel(256, True, 'Colour')
# print(repr(wheel))
# print(repr(wheel[len(wheel)//2]))


from PIL import Image
im = Image.fromarray(np.uint8(wheel*255)).convert('RGBA')
im.save('favicon.png')
im.save('favicon.ico')

for size in (16, 32, 96, 128):
    small_im = im.resize((size, size), Image.Resampling.LANCZOS)
    small_im.save(f"favicon-{size}x{size}.png")
