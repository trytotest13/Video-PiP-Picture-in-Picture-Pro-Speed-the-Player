"""Generates the extension PNG icons (gradient rounded square + white play
triangle). Pure standard library - no dependencies needed."""
import math, os, struct, zlib

SS = 3            # supersampling factor for antialiasing
C0 = (99, 84, 255)   # gradient start (indigo)
C1 = (60, 200, 255)  # gradient end (cyan)


def clamp(x, a, b):
    return a if x < a else (b if x > b else x)


def render_png(size):
    W = H = size
    c = W / 2.0
    half = W / 2.0 - 1.0
    rad = W * 0.26
    A = (0.38 * W, 0.27 * H)
    B = (0.38 * W, 0.73 * H)
    C = (0.79 * W, 0.50 * H)

    def sample(u, v):
        qx = abs(u - c) - (half - rad)
        qy = abs(v - c) - (half - rad)
        ax = max(qx, 0.0)
        ay = max(qy, 0.0)
        sdf = math.hypot(ax, ay) + min(max(qx, qy), 0.0) - rad
        alpha = clamp(0.5 - sdf, 0.0, 1.0)

        def edge(p, q):
            return (p[0] - q[0]) * (v - q[1]) - (p[1] - q[1]) * (u - q[0])

        e0 = edge(A, B)
        e1 = edge(B, C)
        e2 = edge(C, A)
        inside = (e0 >= 0 and e1 >= 0 and e2 >= 0) or (e0 <= 0 and e1 <= 0 and e2 <= 0)
        return alpha, inside

    rows = bytearray()
    for y in range(H):
        rows.append(0)  # PNG filter: none
        for x in range(W):
            total = 0.0
            wsum = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    u = x + (sx + 0.5) / SS
                    v = y + (sy + 0.5) / SS
                    a, ins = sample(u, v)
                    total += a
                    if ins:
                        wsum += a
            if total <= 0.0:
                rows += bytes((0, 0, 0, 0))
                continue
            cov = total / (SS * SS)
            t = (x + y) / (2.0 * W)
            r = C0[0] + (C1[0] - C0[0]) * t
            g = C0[1] + (C1[1] - C0[1]) * t
            b = C0[2] + (C1[2] - C0[2]) * t
            wf = wsum / total  # how much of this pixel is the white triangle
            r = r + (255 - r) * wf
            g = g + (255 - g) * wf
            b = b + (255 - b) * wf
            rows += bytes((int(r + 0.5), int(g + 0.5), int(b + 0.5), int(cov * 255 + 0.5)))

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


here = os.path.dirname(os.path.abspath(__file__))
icons = os.path.join(os.path.dirname(here), 'icons')
os.makedirs(icons, exist_ok=True)
for s in (16, 32, 48, 128):
    with open(os.path.join(icons, 'icon%d.png' % s), 'wb') as f:
        f.write(render_png(s))
    print('icon%d.png written' % s)
