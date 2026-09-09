"""Zips the extension (excluding devtools) so it can be shared easily.
Chrome loads the unpacked folder directly; the zip is for distribution."""
import os, zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(os.path.dirname(root), 'video-pip-pro.zip')
skip = {'devtools'}

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, dns, fns in os.walk(root):
        rel = os.path.relpath(dp, root)
        if rel == '.' or rel.split(os.sep)[0] in skip:
            if rel != '.':
                dns[:] = []
            continue
        for fn in fns:
            p = os.path.join(dp, fn)
            z.write(p, os.path.relpath(p, root))
print('zip written:', out)
